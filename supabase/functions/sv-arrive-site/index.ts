import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, resolveTimestamp, checkIdempotency, recordIdempotencyResult, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, lat, lng, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !session_id) {
      return errorResponse("employee_id, session_id required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "sv-arrive-site");
    if (dup) return dup;

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id, employee_id, travel_start_time, site_arrival_time, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Visit already ended", 400);
    if (!session.travel_start_time) return errorResponse("Must start travel before arriving at site", 400);
    if (session.site_arrival_time) {
      const out = { success: true, timestamp: session.site_arrival_time, deduped: true };
      await recordIdempotencyResult(supabase, idempotency_key, out);
      return jsonResponse(out);
    }

    const { data: visit } = await supabase
      .from("site_visits")
      .select("site_latitude, site_longitude")
      .eq("id", session.site_visit_id)
      .single();

    let valid = false;
    let distance = 0;
    if (visit?.site_latitude && visit?.site_longitude) {
      distance = haversineDistance(lat, lng, Number(visit.site_latitude), Number(visit.site_longitude));
      valid = distance <= 200;
    } else {
      valid = true;
    }

    let now = resolveTimestamp(client_timestamp);
    if (new Date(now).getTime() < new Date(session.travel_start_time).getTime()) {
      now = session.travel_start_time;
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

    const out = { success: true, gps_valid: valid, distance_meters: Math.round(distance), timestamp: now };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
