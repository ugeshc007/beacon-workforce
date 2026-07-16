import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog, resolveAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng, accuracy, attendance_log_id } = await req.json();

    if (!employee_id) {
      return errorResponse("employee_id is required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "arrive-office");
    if (dup) return dup;

    const log = await resolveAttendanceLog(
      supabase,
      employee_id,
      attendance_log_id,
      "id, date, return_travel_start_time"
    );

    if (!log) return errorResponse("No attendance record for today", 400);
    if (!log.return_travel_start_time) return errorResponse("Must start return travel first", 400);

    // Get employee's office for GPS validation
    const { data: emp } = await supabase
      .from("employees")
      .select("branch_id")
      .eq("id", employee_id)
      .single();

    let valid = false;
    let distance = 0;

    if (hasGps && emp?.branch_id) {
      const { data: offices } = await supabase
        .from("offices")
        .select("latitude, longitude, gps_radius_meters")
        .eq("branch_id", emp.branch_id);

      const candidates = (offices ?? [])
        .filter((o) => o.latitude != null && o.longitude != null)
        .map((o) => ({
          distance: haversineDistance(lat, lng, Number(o.latitude), Number(o.longitude)),
          radius: o.gps_radius_meters ?? 100,
        }));

      if (candidates.length > 0) {
        candidates.sort((a, b) => a.distance - b.distance);
        distance = candidates[0].distance;
        valid = candidates.some((c) => c.distance <= c.radius);
      }
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        office_arrival_time: now,
        ...(hasGps ? { office_arrival_lat: lat, office_arrival_lng: lng } : {}),
        office_arrival_accuracy: accuracy ?? null,
        office_arrival_distance_m: Math.round(distance),
        office_arrival_valid: valid,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    // Stamp the earliest session that has return_travel_start_time but no
    // office_arrival_time yet (matches the round trip we're closing).
    const { data: pendingSessions } = await supabase
      .from("project_work_sessions")
      .select("id, return_travel_start_time, office_arrival_time")
      .eq("employee_id", employee_id)
      .eq("date", log.date)
      .not("return_travel_start_time", "is", null)
      .is("office_arrival_time", null)
      .order("return_travel_start_time", { ascending: true })
      .limit(1);

    if (pendingSessions && pendingSessions.length > 0) {
      await supabase
        .from("project_work_sessions")
        .update({
          office_arrival_time: now,
          ...(hasGps ? { office_arrival_lat: lat, office_arrival_lng: lng } : {}),
          office_arrival_distance_m: Math.round(distance),
          office_arrival_valid: valid,
        })
        .eq("id", pendingSessions[0].id);
    }

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
