import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance, todayDate, nowTimestamp, notifyBranchManagers, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, lat, lng, accuracy, is_spoofed } = await req.json();

    if (!employee_id || lat == null || lng == null) {
      return errorResponse("employee_id, lat, and lng are required");
    }

    const supabase = createSupabaseAdmin();

    // Authenticate and verify employee ownership
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();

    // Get employee branch + office + name
    const { data: emp } = await supabase
      .from("employees")
      .select("id, branch_id, name")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    const { data: office } = await supabase
      .from("offices")
      .select("latitude, longitude, gps_radius_meters")
      .eq("branch_id", emp.branch_id)
      .limit(1)
      .single();

    if (!office?.latitude || !office?.longitude) {
      return errorResponse("No office configured for branch", 400);
    }

    const distance = haversineDistance(lat, lng, Number(office.latitude), Number(office.longitude));
    const valid = distance <= office.gps_radius_meters;

    // Get today's assignment for project_id and shift_start
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select("project_id, shift_start")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .limit(1)
      .maybeSingle();

    // Check if already punched in today
    const { data: existing } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      return errorResponse("Already punched in today");
    }

    const now = nowTimestamp();
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

    if (error) return errorResponse(error.message, 500);

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
