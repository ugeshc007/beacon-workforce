import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, lat, lng, accuracy } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");
    if (lat == null || lng == null) return errorResponse("lat and lng are required for punch out");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("No attendance record for today", 400);

    // Validate office GPS
    const { data: emp } = await supabase
      .from("employees")
      .select("branch_id")
      .eq("id", employee_id)
      .single();

    let valid = false;
    let distance = 0;

    if (emp?.branch_id) {
      const { data: office } = await supabase
        .from("offices")
        .select("latitude, longitude, gps_radius_meters")
        .eq("branch_id", emp.branch_id)
        .limit(1)
        .maybeSingle();

      if (office?.latitude && office?.longitude) {
        distance = haversineDistance(lat, lng, Number(office.latitude), Number(office.longitude));
        valid = distance <= office.gps_radius_meters;
      }
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        office_punch_out: now,
        office_punch_out_lat: lat,
        office_punch_out_lng: lng,
        office_punch_out_accuracy: accuracy ?? null,
        office_punch_out_distance_m: Math.round(distance),
        office_punch_out_valid: valid,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      gps_valid: valid,
      distance_meters: Math.round(distance),
      timestamp: now,
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
