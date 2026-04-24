import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

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
    const now = nowTimestamp();

    // Must have punched in (attendance log exists)
    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();
    if (!log?.office_punch_in) return errorResponse("Must punch in at office first", 400);

    // Block if there is an active session already
    const { data: active } = await supabase
      .from("project_work_sessions")
      .select("id, project_id")
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .maybeSingle();
    if (active) {
      return errorResponse(
        active.project_id === project_id
          ? "Session already started for this project"
          : "Finish your current project before starting another",
        409
      );
    }

    // Verify assignment
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("project_id", project_id)
      .eq("date", today)
      .maybeSingle();
    if (!assignment) return errorResponse("No assignment for this project today", 403);

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
