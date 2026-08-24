import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, dateFromTimestamp, resolveTimestamp, authenticateEmployee, checkIdempotency, recordIdempotencyResult, pickLogForTimestamp, findContinuingOpenLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, project_id, lat, lng, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !project_id) {
      return errorResponse("employee_id, project_id required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "project-start-travel");
    if (dup) return dup;

    const now = resolveTimestamp(client_timestamp);
    const today = dateFromTimestamp(now);

    // Check whether office punch-in is mandatory before travel
    const { data: mandatorySetting } = await supabase
      .from("settings").select("value").eq("key", "office_punch_in_mandatory").maybeSingle();
    const officeMandatory = (mandatorySetting?.value ?? "") === "true";

    // Find the log this action belongs to. We load ALL logs for the day and
    // match by time window so a second (night) shift's travel never attaches
    // to the earlier shift's log — that merged both shifts in the timeline.
    const { data: logs } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today);
    let log = pickLogForTimestamp(logs, now);

    if (!log) {

      // Continue an already-open shift even if the Dubai date rolled over past

      // midnight — a night shift must never split into a second log.

      log = await findContinuingOpenLog(supabase, employee_id, "id, office_punch_in", now) as typeof log;

    }

    if (!log) {

      if (officeMandatory) return errorResponse("Must punch in at office first", 400);

      // Never create a bare log without a punch-in: stamp punch-in at the action

      // time so the shift always shows where it started.

      const { data: created, error: createErr } = await supabase

        .from("attendance_logs")

        .insert({ employee_id, date: today, office_punch_in: now })

        .select("id, office_punch_in")

        .single();

      if (createErr) return errorResponse(createErr.message, 500);

      log = created as typeof log;

    }

    if (officeMandatory && !log.office_punch_in) {

      return errorResponse("Must punch in at office first", 400);

    }
    // Auto-close any stale open sessions from previous days (>12h old).
    // Keep night-shift sessions that started yesterday but are still within
    // the 12-hour window.
    const staleSessionCutoff = new Date(new Date(now).getTime() - 12 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("project_work_sessions")
      .update({ work_end_time: now, status: "completed" })
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .lt("date", today)
      .lt("travel_start_time", staleSessionCutoff);

    // Block if there is an active session today
    const { data: activeToday } = await supabase
      .from("project_work_sessions")
      .select("id, project_id, travel_start_time, site_arrival_time, work_start_time")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .is("work_end_time", null)
      .maybeSingle();

    if (activeToday) {
      // Idempotent: if same project and only travel started (no arrival yet), return existing session
      if (
        activeToday.project_id === project_id &&
        activeToday.travel_start_time &&
        !activeToday.site_arrival_time &&
        !activeToday.work_start_time
      ) {
        return jsonResponse({ success: true, session_id: activeToday.id, timestamp: activeToday.travel_start_time, resumed: true });
      }
      return errorResponse(
        activeToday.project_id === project_id
          ? "Session already in progress for this project"
          : "Finish your current project before starting another",
        409
      );
    }

    // Verify assignment and block accidental travel flow for in-house work.
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("id, work_location")
      .eq("employee_id", employee_id)
      .eq("project_id", project_id)
      .eq("date", today)
      .maybeSingle();
    if (!assignment) return errorResponse("No assignment for this project today", 403);

    // Match mobile/admin priority exactly:
    // assignment.work_location → project-day override → project GPS inference.
    // If the schedule explicitly says "site", missing project GPS coords must
    // NOT convert the job back to in-house.
    const { data: dayLoc } = await supabase
      .from("project_day_work_locations")
      .select("location")
      .eq("project_id", project_id)
      .eq("date", today)
      .maybeSingle();

    const { data: proj } = await supabase
      .from("projects")
      .select("site_latitude, site_longitude")
      .eq("id", project_id)
      .maybeSingle();

    const inferredLocation = proj && (proj.site_latitude == null || proj.site_longitude == null)
      ? "in_house"
      : "site";
    const effectiveLocation = assignment.work_location ?? dayLoc?.location ?? inferredLocation;
    const isInHouse = effectiveLocation === "in_house";
    if (isInHouse) {
      return errorResponse("This project is scheduled in-house today. Start work directly from the project screen.", 400);
    }

    const { data: inserted, error } = await supabase
      .from("project_work_sessions")
      .insert({
        employee_id,
        project_id,
        date: today,
        attendance_log_id: log.id,
        travel_start_time: now,
        travel_start_lat: hasGps ? lat : null,
        travel_start_lng: hasGps ? lng : null,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error) return errorResponse(error.message, 500);
    const out = { success: true, session_id: inserted.id, timestamp: now };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
