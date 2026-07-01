import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, nowTimestamp, resolveTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, session_id, lat, lng , client_timestamp } = await req.json();
    if (!employee_id || !session_id) {
      return errorResponse("employee_id, session_id required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = resolveTimestamp(client_timestamp);

    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id, project_id, employee_id, travel_start_time, site_arrival_time, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Session already ended", 400);
    if (!session.travel_start_time) return errorResponse("Must start travel before arriving at site", 400);
    // Idempotent: if already recorded (replayed offline action), return success
    if (session.site_arrival_time) {
      return jsonResponse({ success: true, timestamp: session.site_arrival_time, deduped: true });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("site_latitude, site_longitude, site_gps_radius")
      .eq("id", session.project_id)
      .single();

    let valid = false;
    let distance = 0;
    if (project?.site_latitude && project?.site_longitude) {
      distance = haversineDistance(lat, lng, Number(project.site_latitude), Number(project.site_longitude));
      valid = distance <= (project.site_gps_radius ?? 100);
    }

    const { error } = await supabase
      .from("project_work_sessions")
      .update({
        site_arrival_time: now,
        site_arrival_lat: lat,
        site_arrival_lng: lng,
        site_arrival_distance_m: Math.round(distance),
        site_arrival_valid: valid,
      })
      .eq("id", session_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, gps_valid: valid, distance_meters: Math.round(distance), timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
