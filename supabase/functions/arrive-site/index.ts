import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng } = await req.json();

    if (!employee_id) {
      return errorResponse("employee_id is required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "arrive-site");
    if (dup) return dup;

    const log = await findOpenAttendanceLog(
      supabase,
      employee_id,
      "id, date, office_punch_in, project_id, travel_start_time, site_arrival_time, work_end_time, office_punch_out",
      now
    );

    if (!log) return errorResponse("Must punch in first", 400);
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);
    if (log.site_arrival_time) return errorResponse("Site arrival already recorded", 400);
    // Never block on a missing previous step: back-fill "Start Travel" with the
    // same timestamp and flag the log so an admin can correct the times.
    const backfillTravel = !log.travel_start_time;


    let valid = false;
    let distance = 0;

    if (log.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("site_latitude, site_longitude, site_gps_radius")
        .eq("id", log.project_id)
        .single();

      if (hasGps && project?.site_latitude && project?.site_longitude) {
        distance = haversineDistance(lat, lng, Number(project.site_latitude), Number(project.site_longitude));
        valid = distance <= project.site_gps_radius;
      }
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        site_arrival_time: now,
        ...(backfillTravel ? { travel_start_time: now, is_incomplete_process: true } : {}),
        ...(hasGps ? { site_arrival_lat: lat, site_arrival_lng: lng } : {}),
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
    return errorResponse(err, 500);
  }
});
