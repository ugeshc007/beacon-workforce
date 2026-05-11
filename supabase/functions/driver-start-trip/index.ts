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

    // Driver must have punched in
    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();
    if (!log?.office_punch_in) return errorResponse("Must punch in at office first", 400);
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);

    // No active leg allowed
    const { data: activeLeg } = await supabase
      .from("driver_trip_legs")
      .select("id, status, project_id")
      .eq("driver_id", employee_id)
      .eq("date", today)
      .neq("status", "completed")
      .maybeSingle();
    if (activeLeg) {
      return errorResponse("Finish your current trip before starting a new one", 409);
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
