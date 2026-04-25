import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate } from "../_shared/helpers.ts";

/**
 * Sends a reminder push notification to employees who have an assignment today
 * but haven't punched in yet, once their shift started X minutes ago.
 *
 * Designed to be called by cron every 5 minutes. Idempotent — uses an
 * employee_notifications row (type='punch_in_reminder', reference_id=date)
 * as a sentinel to avoid sending duplicates on subsequent runs.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = todayDate();

    // Reminder delay (minutes after shift_start). Default 15.
    const { data: setting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "notification_punch_in_reminder_delay")
      .maybeSingle();
    const delayMinutes = parseInt(setting?.value ?? "15", 10);

    // All assignments for today
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("employee_id, shift_start, project_id, projects(name)")
      .eq("date", today);

    if (!assignments?.length) {
      return jsonResponse({ checked: 0, reminded: 0 });
    }

    // Already punched in
    const { data: punchIns } = await supabase
      .from("attendance_logs")
      .select("employee_id")
      .eq("date", today)
      .not("office_punch_in", "is", null);
    const punchedInIds = new Set((punchIns ?? []).map((p: { employee_id: string }) => p.employee_id));

    // On leave
    const { data: leaves } = await supabase
      .from("employee_leave")
      .select("employee_id")
      .lte("start_date", today)
      .gte("end_date", today);
    const onLeaveIds = new Set((leaves ?? []).map((l: { employee_id: string }) => l.employee_id));

    // Already reminded today (sentinel)
    const { data: alreadyReminded } = await supabase
      .from("employee_notifications")
      .select("employee_id")
      .eq("type", "punch_in_reminder")
      .eq("reference_id", today);
    const remindedIds = new Set((alreadyReminded ?? []).map((r: { employee_id: string }) => r.employee_id));

    const now = new Date();
    let reminded = 0;
    const errors: string[] = [];

    for (const a of assignments) {
      const empId = a.employee_id;
      if (!empId || punchedInIds.has(empId) || onLeaveIds.has(empId) || remindedIds.has(empId)) continue;
      if (!a.shift_start) continue;

      // UAE timezone (UTC+4) — same convention as check-absent
      const shiftStart = new Date(`${today}T${a.shift_start}+04:00`);
      const diffMinutes = (now.getTime() - shiftStart.getTime()) / 60000;

      // Only remind if window is between [delay, delay + 60min] so we don't
      // ping people hours later if cron was paused.
      if (diffMinutes < delayMinutes || diffMinutes > delayMinutes + 60) continue;

      const projectName = (a.projects as { name?: string } | null)?.name ?? "your project";
      const shiftStr = a.shift_start.slice(0, 5);

      try {
        await supabase.functions.invoke("send-push", {
          body: {
            employee_id: empId,
            title: "Reminder: punch in for your shift",
            message: `Your shift at ${projectName} started at ${shiftStr}. Please punch in.`,
            data: {
              type: "punch_in_reminder",
              priority: "high",
              reference_id: today,
              reference_type: "attendance",
            },
          },
        });
        reminded++;
      } catch (e) {
        errors.push(`${empId}: ${(e as Error).message}`);
      }
    }

    return jsonResponse({
      checked: assignments.length,
      reminded,
      delay_minutes: delayMinutes,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
