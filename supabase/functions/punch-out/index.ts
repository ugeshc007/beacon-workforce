import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng, accuracy } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");
    if (lat == null || lng == null) return errorResponse("lat and lng are required for punch out");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "punch-out");
    if (dup) return dup;

    const log = await findOpenAttendanceLog(
      supabase,
      employee_id,
      "id, date, office_arrival_time, office_punch_out, travel_start_time, site_arrival_time"
    );

    if (!log) return errorResponse("No active attendance to punch out from", 400);
    if (log.office_punch_out) return errorResponse("Already punched out", 400);

    // Block punch-out if the driver still has an open trip leg from the shift's date.
    const { data: openLegs } = await supabase
      .from("driver_trip_legs")
      .select("id, leg_number, projects(name)")
      .eq("driver_id", employee_id)
      .eq("date", log.date)
      .neq("status", "completed");

    if (openLegs && openLegs.length > 0) {
      const names = openLegs
        .map((l: any) => l.projects?.name || `Leg #${l.leg_number}`)
        .join(", ");
      return errorResponse(
        `Finish your trip first before punching out. Open trip(s): ${names}. Tap 'Arrived at Site' then 'End Leg' to close them.`,
        400
      );
    }

    // Require "Arrive Office" only if the employee actually traveled today.
    // We check real evidence of travel (log OR any project work session has
    // travel/site-arrival timestamps) — NOT just the assignment's work_location,
    // because a site-tagged assignment that was never started shouldn't block
    // punch-out for an in-house workday.
    if (!log.office_arrival_time) {
      let actuallyTraveled = !!log.travel_start_time || !!log.site_arrival_time;

      if (!actuallyTraveled) {
        const { data: sessions } = await supabase
          .from("project_work_sessions")
          .select("travel_start_time, site_arrival_time, return_travel_start_time")
          .eq("attendance_log_id", log.id);
        actuallyTraveled = (sessions ?? []).some(
          (s: any) => s.travel_start_time || s.site_arrival_time || s.return_travel_start_time
        );
      }

      if (actuallyTraveled) {
        return errorResponse(
          "Can't punch out yet. You went to a site today, so you must return to the office and tap 'Arrive Office' before punching out. Steps: 1) Tap 'Start Return Travel' at the site, 2) Tap 'Arrive Office' when you reach the office, 3) Then punch out.",
          400
        );
      }
    }


    // Validate office GPS
    const { data: emp } = await supabase
      .from("employees")
      .select("branch_id")
      .eq("id", employee_id)
      .single();

    let valid = false;
    let distance = 0;

    if (emp?.branch_id) {
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
