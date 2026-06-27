import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, notifyBranchManagers, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng, accuracy, is_spoofed } = await req.json();

    if (!employee_id) {
      return errorResponse("employee_id is required");
    }

    const supabase = createSupabaseAdmin();

    // Authenticate and verify employee ownership
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();

    // Read company-wide GPS toggle. When OFF → bypass geofence checks entirely.
    const { data: gpsSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "gps_required_on_punch")
      .maybeSingle();
    const gpsRequired = (gpsSetting?.value ?? "true") !== "false";

    if (gpsRequired && (lat == null || lng == null)) {
      return errorResponse("lat and lng are required when GPS validation is enabled");
    }

    // Get employee branch + office + name
    const { data: emp } = await supabase
      .from("employees")
      .select("id, branch_id, name")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    let distance = 0;
    let valid = true; // Default true when GPS check is bypassed

    if (lat != null && lng != null) {
      // Fetch ALL offices/warehouses for this branch. Employee can punch in
      // from any of them — we pick the nearest matching one.
      const { data: offices } = await supabase
        .from("offices")
        .select("id, name, latitude, longitude, gps_radius_meters, gps_validation_enabled")
        .eq("branch_id", emp.branch_id);

      const validOffices = (offices ?? []).filter(
        (o) => o.latitude != null && o.longitude != null
      );

      if (validOffices.length > 0) {
        const scored = validOffices.map((o) => ({
          office: o,
          distance: haversineDistance(lat, lng, Number(o.latitude), Number(o.longitude)),
        }));
        scored.sort((a, b) => a.distance - b.distance);
        const nearest = scored[0];
        distance = nearest.distance;

        const gpsValidationEnabled = nearest.office.gps_validation_enabled !== false;
        valid =
          scored.some(
            (s) =>
              s.office.gps_validation_enabled === false ||
              s.distance <= (s.office.gps_radius_meters ?? 100)
          ) || !gpsValidationEnabled;
      } else if (gpsRequired) {
        return errorResponse("No office configured for branch", 400);
      }
    }



    // Get today's assignment for project_id and shift_start
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("project_id, shift_start")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .limit(1)
      .maybeSingle();

    // Allow multiple shifts per day. Only block if there's an OPEN log
    // (employee already punched in but hasn't punched out yet).
    const { data: openLogs } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .is("office_punch_out", null);

    if (openLogs && openLogs.length > 0) {
      return errorResponse("You are already punched in. Please punch out before starting a new shift.");
    }

    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "punch-in");
    if (dup) return dup;
    const { data: log, error } = await supabase
      .from("attendance_logs")
      .insert({
        employee_id,
        project_id: assignment?.project_id ?? null,
        date: today,
        office_punch_in: now,
        office_punch_in_lat: lat,
        office_punch_in_lng: lng,
        office_punch_in_valid: valid,
        office_punch_in_distance_m: Math.round(distance),
        office_punch_in_accuracy: accuracy ?? null,
        office_punch_in_spoofed: is_spoofed ?? false,
      })
      .select("id")
      .single();

    if (error) {
      // Unique-index race: a parallel request already created an open log
      if ((error as any).code === "23505") {
        const { data: existing } = await supabase
          .from("attendance_logs")
          .select("id")
          .eq("employee_id", employee_id)
          .eq("date", today)
          .is("office_punch_out", null)
          .maybeSingle();
        return jsonResponse({
          success: true,
          attendance_id: existing?.id ?? null,
          gps_valid: valid,
          distance_meters: Math.round(distance),
          timestamp: now,
          deduped: true,
        });
      }
      return errorResponse(error.message, 500);
    }

    // Check if late — compare punch-in time against shift_start
    if (assignment?.shift_start) {
      const { data: settings } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "late_threshold_minutes")
        .maybeSingle();

      const lateThreshold = parseInt(settings?.value ?? "15", 10);
      const shiftStartStr = `${today}T${assignment.shift_start}+04:00`; // UAE timezone
      const shiftStart = new Date(shiftStartStr);
      const punchTime = new Date(now);
      const diffMinutes = (punchTime.getTime() - shiftStart.getTime()) / 60000;

      if (diffMinutes > lateThreshold) {
        const lateBy = Math.round(diffMinutes);
        await notifyBranchManagers(supabase, emp.branch_id, {
          type: "late_arrival",
          title: `${emp.name} punched in late`,
          message: `Late by ${lateBy} minutes (arrived at ${punchTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" })}, shift started at ${assignment.shift_start.slice(0, 5)})`,
          priority: lateBy > 60 ? "high" : "normal",
          reference_id: log.id,
          reference_type: "attendance",
        });
      }
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
