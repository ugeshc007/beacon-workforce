import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, resolveTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, project_id, lat, lng } = await req.json();
    if (!employee_id || !project_id || lat == null || lng == null) {
      return errorResponse("employee_id, project_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);

    // Check whether office punch-in is mandatory before travel
    const { data: mandatorySetting } = await supabase
      .from("settings").select("value").eq("key", "office_punch_in_mandatory").maybeSingle();
    const officeMandatory = (mandatorySetting?.value ?? "") === "true";

    // Find ANY existing log for today (open preferred), to avoid violating
    // the partial unique index attendance_logs_one_open_per_day.
    const { data: logs } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .order("office_punch_out", { ascending: true, nullsFirst: true })
      .limit(1);
    let log = logs?.[0] ?? null;

    if (!log) {
      if (officeMandatory) return errorResponse("Must punch in at office first", 400);
      const { data: created, error: createErr } = await supabase
        .from("attendance_logs")
        .insert({ employee_id, date: today })
        .select("id, office_punch_in")
        .single();
      if (createErr) return errorResponse(createErr.message, 500);
      log = created;
    } else if (officeMandatory && !log.office_punch_in) {
      return errorResponse("Must punch in at office first", 400);
    }

    // Auto-close any stale open sessions from previous days
    await supabase
      .from("project_work_sessions")
      .update({ work_end_time: now, status: "completed" })
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .lt("date", today);

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

    if (assignment.work_location === "in_house") {
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
        travel_start_lat: lat,
        travel_start_lng: lng,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, session_id: inserted.id, timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
