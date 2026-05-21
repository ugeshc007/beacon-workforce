import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, nowTimestamp, todayDate, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, project_id } = await req.json();
    if (!employee_id) return errorResponse("employee_id required");
    if (!session_id && !project_id) return errorResponse("session_id or project_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    // -------- IN-HOUSE PATH: no session yet, create one immediately at "working" state --------
    if (!session_id && project_id) {
      // Must have punched in at office
      const { data: log } = await supabase
        .from("attendance_logs")
        .select("id, office_punch_in")
        .eq("employee_id", employee_id)
        .eq("date", today)
        .maybeSingle();
      if (!log?.office_punch_in) return errorResponse("Must punch in at office first", 400);

      // Verify assignment for this project today (and read its per-assignment work_location)
      const { data: assignment } = await supabase
        .from("project_assignments")
        .select("id, work_location")
        .eq("employee_id", employee_id)
        .eq("project_id", project_id)
        .eq("date", today)
        .maybeSingle();
      if (!assignment) return errorResponse("No assignment for this project today", 403);

      // In-house if EITHER the per-employee assignment.work_location is 'in_house'
      // OR the project-wide day location is 'in_house'. The per-assignment value
      // takes priority because the schedule page sets it per employee.
      let isInHouse = assignment.work_location === "in_house";
      if (!isInHouse) {
        const { data: dayLoc } = await supabase
          .from("project_day_work_locations")
          .select("location")
          .eq("project_id", project_id)
          .eq("date", today)
          .maybeSingle();
        isInHouse = dayLoc?.location === "in_house";
      }
      if (!isInHouse) {
        return errorResponse(
          "This project is scheduled at site today. Start travel first, then arrive at site before starting work.",
          400,
        );
      }

      // Auto-close any stale open sessions from previous days
      await supabase
        .from("project_work_sessions")
        .update({ work_end_time: now, status: "completed" })
        .eq("employee_id", employee_id)
        .is("work_end_time", null)
        .lt("date", today);

      // Block if another active session today
      const { data: activeToday } = await supabase
        .from("project_work_sessions")
        .select("id, project_id")
        .eq("employee_id", employee_id)
        .eq("date", today)
        .is("work_end_time", null)
        .maybeSingle();
      if (activeToday) {
        if (activeToday.project_id === project_id) {
          // Idempotent: return the existing session
          return jsonResponse({ success: true, session_id: activeToday.id, timestamp: now, resumed: true });
        }
        return errorResponse("Finish your current project before starting another", 409);
      }

      // Create the session pre-filled for in-house (no travel, no site arrival)
      const { data: inserted, error: insertErr } = await supabase
        .from("project_work_sessions")
        .insert({
          employee_id,
          project_id,
          date: today,
          attendance_log_id: log.id,
          work_start_time: now,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (insertErr) return errorResponse(insertErr.message, 500);
      return jsonResponse({ success: true, session_id: inserted.id, timestamp: now });
    }

    // -------- NORMAL SITE PATH: requires existing session with site_arrival_time --------
    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id, site_arrival_time, work_start_time, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Session already ended", 400);
    if (!session.site_arrival_time) return errorResponse("Must arrive at site before starting work", 400);
    if (session.work_start_time) return errorResponse("Work already started", 400);

    const { error } = await supabase
      .from("project_work_sessions")
      .update({ work_start_time: now })
      .eq("id", session_id)
      .eq("employee_id", employee_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
