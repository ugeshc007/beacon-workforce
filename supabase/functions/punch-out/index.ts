import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee } from "../_shared/helpers.ts";

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

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, office_arrival_time, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("No attendance record for today", 400);
    if (log.office_punch_out) return errorResponse("Already punched out", 400);

    // Block punch-out if the driver still has an open trip leg from today.
    // Drivers must explicitly end every leg before closing out the day so
    // travel/onsite minutes are accurate.
    const { data: openLegs } = await supabase
      .from("driver_trip_legs")
      .select("id, leg_number, projects(name)")
      .eq("driver_id", employee_id)
      .eq("date", today)
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


    // Skip "arrive at office" check for in-house employees (they never left the office).
    // Only require it if the employee has at least one site-based assignment today.
    if (!log.office_arrival_time) {
      const { data: todayAssignments } = await supabase
        .from("project_assignments")
        .select("work_location")
        .eq("employee_id", employee_id)
        .eq("date", today);

      const hasSiteAssignment = (todayAssignments ?? []).some(
        (a) => a.work_location === "site"
      );

      if (hasSiteAssignment) {
        return errorResponse(
          "Can't punch out yet. You were assigned to a site today, so you must return to the office and tap 'Arrive Office' before punching out. Steps: 1) Tap 'Start Return Travel' at the site, 2) Tap 'Arrive Office' when you reach the office, 3) Then punch out. (In-house employees can punch out directly without these steps.)",
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
