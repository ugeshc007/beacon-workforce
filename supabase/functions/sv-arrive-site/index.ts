import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, lat, lng } = await req.json();
    if (!employee_id || !session_id || lat == null || lng == null) {
      return errorResponse("employee_id, session_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = nowTimestamp();

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id, employee_id")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);

    const { data: visit } = await supabase
      .from("site_visits")
      .select("site_latitude, site_longitude")
      .eq("id", session.site_visit_id)
      .single();

    let valid = false;
    let distance = 0;
    if (visit?.site_latitude && visit?.site_longitude) {
      distance = haversineDistance(lat, lng, Number(visit.site_latitude), Number(visit.site_longitude));
      valid = distance <= 200; // 200m tolerance for site visits
    } else {
      valid = true; // No GPS configured for visit — accept
    }

    const { error } = await supabase
      .from("site_visit_work_sessions")
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
