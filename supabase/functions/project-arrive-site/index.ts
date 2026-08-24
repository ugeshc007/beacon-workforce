import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, nowTimestamp, resolveTimestamp, authenticateEmployee, checkIdempotency, recordIdempotencyResult } from "../_shared/helpers.ts";

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

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "project-arrive-site");
    if (dup) return dup;

    const now = resolveTimestamp(client_timestamp);

    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id, project_id, employee_id, travel_start_time, site_arrival_time, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Session already ended", 400);
    // Never block on a missing previous step: back-fill travel start.
    const backfillTravel = !session.travel_start_time;

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
    if (hasGps && project?.site_latitude && project?.site_longitude) {
      distance = haversineDistance(lat, lng, Number(project.site_latitude), Number(project.site_longitude));
      valid = distance <= (project.site_gps_radius ?? 100);
    }

    const { error } = await supabase
      .from("project_work_sessions")
      .update({
        site_arrival_time: now,
        ...(backfillTravel ? { travel_start_time: now } : {}),
        site_arrival_lat: hasGps ? lat : null,
        site_arrival_lng: hasGps ? lng : null,
        site_arrival_distance_m: hasGps ? Math.round(distance) : null,
        site_arrival_valid: hasGps ? valid : null,
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
