import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog, findAnyOpenAttendanceLog, resolveAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng, accuracy, attendance_log_id } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "punch-out");
    if (dup) return dup;

    const resolved = await resolveAttendanceLog(
      supabase,
      employee_id,
      attendance_log_id,
      "id, date, office_punch_in, office_arrival_time, office_punch_out, travel_start_time, site_arrival_time",
      now
    );

    // No time condition on punch-out: if nothing resolves inside the normal
    // shift window, fall back to ANY still-open shift (even days old) so the
    // employee can always close it. Admins can correct the times afterwards.
    const cols = "id, date, office_punch_in, office_arrival_time, office_punch_out, travel_start_time, site_arrival_time";
    const log = resolved ?? (await findAnyOpenAttendanceLog(supabase, employee_id, cols));

    if (!log) return errorResponse("No active attendance to punch out from", 400);
    if (log.office_punch_out) return errorResponse("Already punched out", 400);

    // Punch-out is ALWAYS allowed (no time / flow conditions).
    // If steps are missing (open driver legs, no 'Arrive Office' after site travel),
    // we still close the shift but flag it so an admin can fix the times.
    let missingSteps = false;

    const { data: openLegs } = await supabase
      .from("driver_trip_legs")
      .select("id")
      .eq("driver_id", employee_id)
      .eq("date", log.date)
      .neq("status", "completed");

    if (openLegs && openLegs.length > 0) missingSteps = true;

    if (!log.office_arrival_time) {
      let actuallyTraveled = !!log.travel_start_time || !!log.site_arrival_time;
      if (!actuallyTraveled) {
        const { data: sessions } = await supabase
          .from("project_work_sessions")
          .select("travel_start_time, site_arrival_time, return_travel_start_time")
          .eq("attendance_log_id", log.id);
        actuallyTraveled = (sessions ?? []).some(
          (s: any) => s.travel_start_time || s.site_arrival_time || s.return_travel_start_time
        );
      }
      if (actuallyTraveled) missingSteps = true;
    }



    // Validate office GPS
    const { data: emp } = await supabase
      .from("employees")
      .select("branch_id")
      .eq("id", employee_id)
      .single();

    let valid = false;
    let distance = 0;

    if (hasGps && emp?.branch_id) {
      const { data: offices } = await supabase
        .from("offices")
        .select("latitude, longitude, gps_radius_meters")
        .eq("branch_id", emp.branch_id);

      const candidates = (offices ?? [])
        .filter((o) => o.latitude != null && o.longitude != null)
        .map((o) => ({
          distance: haversineDistance(lat, lng, Number(o.latitude), Number(o.longitude)),
          radius: o.gps_radius_meters ?? 100,
        }));

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance);
        distance = candidates[0].distance;
        valid = candidates.some((c) => c.distance <= c.radius);
      }
    }

    // Guard against stale offline replays: a queued punch-out can carry a
    // client_timestamp from days ago. If it is at/earlier than punch-in (or
    // absurdly far from it), ignore the device time and use server time.
    let effectiveNow = now;
    let staleClientTime = false;
    if (log.office_punch_in) {
      const inMs = new Date(log.office_punch_in).getTime();
      const outMs = new Date(effectiveNow).getTime();
      if (outMs <= inMs) {
        effectiveNow = nowTimestamp();
        staleClientTime = true;
      }
    }

    const ageMs = log.office_punch_in ? new Date(effectiveNow).getTime() - new Date(log.office_punch_in).getTime() : 0;
    const lateClose = ageMs > 12 * 60 * 60 * 1000;


    const staleNote = staleClientTime
      ? "Punch-out device time was before punch-in (stale offline replay) — server time used; admin can adjust"
      : null;

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        office_punch_out: effectiveNow,
        ...(lateClose ? { is_incomplete_process: true, notes: "Punched out late — shift open more than 12h; admin can adjust times" } : {}),
        ...(missingSteps ? { is_incomplete_process: true, notes: "Punched out with missing steps (return travel / arrive office) — admin can adjust times" } : {}),
        ...(staleNote ? { is_incomplete_process: true, notes: staleNote } : {}),
        office_punch_out_lat: hasGps ? lat : null,
        office_punch_out_lng: hasGps ? lng : null,
        office_punch_out_accuracy: accuracy ?? null,
        office_punch_out_distance_m: hasGps ? Math.round(distance) : null,
        office_punch_out_valid: hasGps ? valid : null,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    // Close any still-open work sessions on this shift so nothing dangles.
    await supabase
      .from("project_work_sessions")
      .update({ work_end_time: effectiveNow, status: "completed" })
      .eq("attendance_log_id", log.id)
      .is("work_end_time", null);

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      gps_valid: valid,
      distance_meters: Math.round(distance),
      timestamp: effectiveNow,
      stale_client_time: staleClientTime,
    });

  } catch (err) {
    return errorResponse(err, 500);
  }
});
