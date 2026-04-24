import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, site_visit_id, lat, lng } = await req.json();
    if (!employee_id || !site_visit_id || lat == null || lng == null) {
      return errorResponse("employee_id, site_visit_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    // Must be punched in
    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();
    if (!log?.office_punch_in) return errorResponse("Must punch in at office first", 400);

    // Sequential rule: no other open site-visit session
    const { data: activeSv } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id")
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .maybeSingle();
    if (activeSv) {
      return errorResponse(
        activeSv.site_visit_id === site_visit_id
          ? "Session already started for this visit"
          : "Finish your current site visit before starting another",
        409
      );
    }

    // Also block if a project session is open
    const { data: activeProj } = await supabase
      .from("project_work_sessions")
      .select("id")
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .maybeSingle();
    if (activeProj) return errorResponse("Finish your active project before starting a site visit", 409);

    // Verify visit is assigned to this employee
    const { data: visit } = await supabase
      .from("site_visits")
      .select("id, assigned_employee_id, status")
      .eq("id", site_visit_id)
      .maybeSingle();
    if (!visit) return errorResponse("Site visit not found", 404);
    if (visit.assigned_employee_id !== employee_id) return errorResponse("Not assigned to this site visit", 403);
    if (visit.status === "completed" || visit.status === "cancelled" || visit.status === "converted") {
      return errorResponse("Visit is already closed", 400);
    }

    const { data: inserted, error } = await supabase
      .from("site_visit_work_sessions")
      .insert({
        employee_id,
        site_visit_id,
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

    // Mark visit in-progress
    await supabase.from("site_visits").update({ status: "in_progress" }).eq("id", site_visit_id);

    return jsonResponse({ success: true, session_id: inserted.id, timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
