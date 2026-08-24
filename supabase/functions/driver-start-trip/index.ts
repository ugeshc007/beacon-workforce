import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, dateFromTimestamp, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, pickLogForTimestamp, findContinuingOpenLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, project_id, lat, lng } = await req.json();
    if (!employee_id || !project_id || lat == null || lng == null) {
      return errorResponse("employee_id, project_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = resolveTimestamp(client_timestamp);
    // Derive the shift date from the punch/action time so a late-night action
    // synced after midnight stays on its own day.
    const today = dateFromTimestamp(now);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "driver-start-trip");
    if (dup) return dup;

    const { data: mandatorySetting } = await supabase
      .from("settings").select("value").eq("key", "office_punch_in_mandatory").maybeSingle();
    const officeMandatory = (mandatorySetting?.value ?? "") === "true";

    const { data: logs } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today);
    let log = pickLogForTimestamp(logs, now);
    if (!log) {
      // Continue an already-open shift even if the Dubai date rolled over past
      // midnight — a night shift must never split into a second log.
      log = await findContinuingOpenLog(supabase, employee_id, "id, office_punch_in, office_punch_out", now) as typeof log;
    }
    if (!log) {
      if (officeMandatory) return errorResponse("Must punch in at office first", 400);
      // Never create a bare log without a punch-in: stamp punch-in at the action
      // time so the shift always shows where it started.
      const { data: created, error: createErr } = await supabase
        .from("attendance_logs")
        .insert({ employee_id, date: today, office_punch_in: now })
        .select("id, office_punch_in, office_punch_out")
        .single();
      if (createErr) return errorResponse(createErr.message, 500);
      log = created as typeof log;
    }
    if (officeMandatory && !log.office_punch_in) {
      return errorResponse("Must punch in at office first", 400);
    }
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);

    // Auto-close any previously open leg from today (driver forgot to end it).
    // We consider the old leg ended at "now" — minutes computed from whichever
    // timestamps exist. A note is added so managers can see it was auto-closed.
    const { data: openLegs } = await supabase
      .from("driver_trip_legs")
      .select("id, travel_start_time, site_arrival_time, status, notes")
      .eq("driver_id", employee_id)
      .eq("date", today)
      .neq("status", "completed");

    if (openLegs && openLegs.length > 0) {
      for (const leg of openLegs) {
        const travelStart = leg.travel_start_time ? new Date(leg.travel_start_time).getTime() : null;
        const siteArrival = leg.site_arrival_time ? new Date(leg.site_arrival_time).getTime() : null;
        const endMs = new Date(now).getTime();

        let travelMin = 0;
        let onsiteMin = 0;
        if (travelStart && siteArrival) {
          travelMin = Math.max(0, Math.round((siteArrival - travelStart) / 60000));
          onsiteMin = Math.max(0, Math.round((endMs - siteArrival) / 60000));
        } else if (travelStart) {
          // Never arrived at site — treat the whole window as travel
          travelMin = Math.max(0, Math.round((endMs - travelStart) / 60000));
        }

        await supabase
          .from("driver_trip_legs")
          .update({
            status: "completed",
            leg_end_time: now,
            leg_end_lat: lat,
            leg_end_lng: lng,
            total_travel_minutes: travelMin,
            total_onsite_minutes: onsiteMin,
            notes: [leg.notes, "Auto-closed: driver started a new trip without ending this one"].filter(Boolean).join(" | "),
          })
          .eq("id", leg.id);
      }
    }

    // Verify driver assignment for this project today
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("id, assigned_role")
      .eq("employee_id", employee_id)
      .eq("project_id", project_id)
      .eq("date", today)
      .maybeSingle();
    if (!assignment) return errorResponse("No assignment for this project today", 403);
    if (assignment.assigned_role !== "driver") {
      return errorResponse("This flow is only for driver assignments", 403);
    }

    // Determine next leg number
    const { count } = await supabase
      .from("driver_trip_legs")
      .select("id", { count: "exact", head: true })
      .eq("driver_id", employee_id)
      .eq("date", today);

    const { data: inserted, error } = await supabase
      .from("driver_trip_legs")
      .insert({
        driver_id: employee_id,
        date: today,
        project_id,
        attendance_log_id: log.id,
        leg_number: (count ?? 0) + 1,
        travel_start_time: now,
        travel_start_lat: lat,
        travel_start_lng: lng,
        status: "traveling",
      })
      .select("id, leg_number")
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, leg_id: inserted.id, leg_number: inserted.leg_number, timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
