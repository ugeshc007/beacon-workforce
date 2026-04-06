import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, lat, lng, accuracy, is_spoofed } = await req.json();

    if (!employee_id || lat == null || lng == null) {
      return errorResponse("employee_id, lat, and lng are required");
    }

    const supabase = createSupabaseAdmin();
    const today = todayDate();

    // Get employee branch + office
    const { data: emp } = await supabase
      .from("employees")
      .select("id, branch_id")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    const { data: office } = await supabase
      .from("offices")
      .select("latitude, longitude, gps_radius_meters")
      .eq("branch_id", emp.branch_id)
      .limit(1)
      .single();

    if (!office?.latitude || !office?.longitude) {
      return errorResponse("No office configured for branch", 400);
    }

    const distance = haversineDistance(lat, lng, Number(office.latitude), Number(office.longitude));
    const valid = distance <= office.gps_radius_meters;

    // Get today's assignment for project_id
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .limit(1)
      .maybeSingle();

    // Check if already punched in today
    const { data: existing } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      return errorResponse("Already punched in today");
    }

    const now = nowTimestamp();
    const { data: log, error } = await supabase
      .from("attendance_logs")
      .insert({
        employee_id,
        project_id: assignment?.project_id ?? null,
        date: today,
        office_punch_in: now,
        office_punch_in_lat: lat,
        office_punch_in_lng: lng,
        office_punch_in_valid: valid,
        office_punch_in_distance_m: Math.round(distance),
        office_punch_in_accuracy: accuracy ?? null,
        office_punch_in_spoofed: is_spoofed ?? false,
      })
      .select("id")
      .single();

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      gps_valid: valid,
      distance_meters: Math.round(distance),
      timestamp: now,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
