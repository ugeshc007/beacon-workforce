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



    // Get today's assignments. With multiple shifts, choose the shift matching
    // the punch time instead of relying on an unordered LIMIT 1.
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("project_id, shift_start, shift_end")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .order("shift_start", { ascending: true, nullsFirst: false });

    const now = resolveTimestamp(client_timestamp);
    const nowInUae = new Date(new Date(now).getTime() + 4 * 60 * 60 * 1000);
    const nowMinutes = nowInUae.getUTCHours() * 60 + nowInUae.getUTCMinutes();
    const toMinutes = (value: string | null | undefined) => {
      if (!value) return null;
      const [h, m] = value.split(":").map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return h * 60 + m;
    };
    const assignment = (assignments ?? []).find((a) => {
      const start = toMinutes(a.shift_start);
      const end = toMinutes(a.shift_end);
      if (start == null) return false;
      if (end == null) return nowMinutes >= start;
      return end < start
        ? nowMinutes >= start || nowMinutes <= end
        : nowMinutes >= start && nowMinutes <= end;
    }) ?? (assignments ?? []).find((a) => {
      const start = toMinutes(a.shift_start);
      return start != null && start >= nowMinutes;
    }) ?? (assignments ?? [])[0] ?? null;
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "punch-in");
    if (dup) return dup;

    // Allow multiple shifts per day, but make punch-in idempotent:
    // - A queued/offline duplicate punch-in should return success, not fail.
    // - A blank open log created by a travel/work action should be reused.
    const { data: openLogs } = await supabase
      .from("attendance_logs")
      .select("id, office_punch_in, office_punch_out")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .is("office_punch_out", null)
      .order("office_punch_in", { ascending: false, nullsFirst: false });

    const punchedInOpenLog = openLogs?.find((l) => l.office_punch_in);
    if (punchedInOpenLog) {
      return jsonResponse({
        success: true,
        attendance_id: punchedInOpenLog.id,
        gps_valid: valid,
        distance_meters: Math.round(distance),
        timestamp: punchedInOpenLog.office_punch_in,
        deduped: true,
        already_punched_in: true,
      });
    }

    const blankOpenLog = openLogs?.[0];
    const punchPayload = {
        employee_id,
        project_id: assignment?.project_id ?? null,
        date: today,
        office_punch_in: now,
        office_punch_in_lat: lat ?? null,
        office_punch_in_lng: lng ?? null,
        office_punch_in_valid: valid,
        office_punch_in_distance_m: lat != null && lng != null ? Math.round(distance) : null,
        office_punch_in_accuracy: accuracy ?? null,
        office_punch_in_spoofed: is_spoofed ?? false,
      };

    const { data: log, error } = blankOpenLog
      ? await supabase
          .from("attendance_logs")
          .update(punchPayload)
          .eq("id", blankOpenLog.id)
          .select("id")
          .single()
      : await supabase
          .from("attendance_logs")
          .insert(punchPayload)
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
