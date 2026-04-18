import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

// Stores a periodic GPS ping during employee travel
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    // Authenticate employee
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { data: emp } = await supabase
      .from("employees")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!emp) return errorResponse("Employee not found", 404);

    const { attendance_log_id, lat, lng, accuracy } = await req.json();
    if (!attendance_log_id || lat == null || lng == null) {
      return errorResponse("attendance_log_id, lat, lng are required");
    }

    // Verify log belongs to this employee and a travel leg is active
    // (either morning travel-to-site OR return travel-to-office)
    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, employee_id, travel_start_time, site_arrival_time, return_travel_start_time, office_arrival_time")
      .eq("id", attendance_log_id)
      .eq("employee_id", emp.id)
      .single();
    if (!log) return errorResponse("Attendance log not found or not yours", 404);

    const morningLegActive = log.travel_start_time && !log.site_arrival_time;
    const returnLegActive = log.return_travel_start_time && !log.office_arrival_time;
    if (!morningLegActive && !returnLegActive) {
      return errorResponse("No active travel leg to ping");
    }

    const { error: insertErr } = await supabase
      .from("travel_pings")
      .insert({
        attendance_log_id,
        employee_id: emp.id,
        lat,
        lng,
        accuracy: accuracy ?? null,
      });
    if (insertErr) return errorResponse(insertErr.message, 500);

    return jsonResponse({ success: true });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
});
