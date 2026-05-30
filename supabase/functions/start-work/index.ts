import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, resolveTimestamp, checkIdempotency, notifyBranchManagers, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = resolveTimestamp(client_timestamp);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "start-work");
    if (dup) return dup;

    const log = await findOpenAttendanceLog(
      supabase,
      employee_id,
      "id, date, project_id, site_arrival_time, work_start_time, work_end_time, office_punch_out"
    );

    if (!log) return errorResponse("Must punch in first", 400);
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);
    if (!log.site_arrival_time) return errorResponse("Must arrive at site before starting work", 400);
    if (log.work_start_time) return errorResponse("Work already started", 400);

    const { error } = await supabase
      .from("attendance_logs")
      .update({ work_start_time: now })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    // Late work start detection
    let is_late = false;
    try {
      const { data: assignment } = await supabase
        .from("project_assignments")
        .select("shift_start")
        .eq("employee_id", employee_id)
        .eq("date", log.date)
        .maybeSingle();

      if (assignment?.shift_start) {
        const { data: setting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "late_work_start_threshold_minutes")
          .maybeSingle();
        const thresholdMin = parseInt(setting?.value ?? "15", 10);

        const shiftTimeParts = assignment.shift_start.split(":");
        const shiftDate = new Date(log.date + "T00:00:00+04:00");
        shiftDate.setHours(parseInt(shiftTimeParts[0]), parseInt(shiftTimeParts[1]), 0, 0);
        const expectedStart = new Date(shiftDate.getTime() + thresholdMin * 60000);

        if (new Date(now).getTime() > expectedStart.getTime()) {
          is_late = true;
          const lateMin = Math.round((new Date(now).getTime() - shiftDate.getTime()) / 60000);

          const { data: emp } = await supabase
            .from("employees")
            .select("name, branch_id")
            .eq("id", employee_id)
            .single();

          if (emp) {
            await notifyBranchManagers(supabase, emp.branch_id, {
              type: "late_work_start",
              title: "Late Work Start",
              message: `${emp.name} started work ${lateMin} minutes after shift start`,
              priority: "high",
              reference_id: log.id,
              reference_type: "attendance_log",
            });
          }
        }
      }
    } catch (_) {
      // Non-critical
    }

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now, is_late });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
