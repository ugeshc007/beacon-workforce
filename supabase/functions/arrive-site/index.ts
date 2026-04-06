import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, lat, lng } = await req.json();

    if (!employee_id || lat == null || lng == null) {
      return errorResponse("employee_id, lat, and lng are required");
    }

    const supabase = createSupabaseAdmin();
    const today = todayDate();
    const now = nowTimestamp();

    // Get today's attendance log
    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, project_id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);

    // Get project site coords
    let valid = false;
    let distance = 0;

    if (log.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("site_latitude, site_longitude, site_gps_radius")
        .eq("id", log.project_id)
        .single();

      if (project?.site_latitude && project?.site_longitude) {
        distance = haversineDistance(lat, lng, Number(project.site_latitude), Number(project.site_longitude));
        valid = distance <= project.site_gps_radius;
      }
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        site_arrival_time: now,
        site_arrival_lat: lat,
        site_arrival_lng: lng,
        site_arrival_distance_m: Math.round(distance),
        site_arrival_valid: valid,
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
    return errorResponse(err.message, 500);
  }
});
