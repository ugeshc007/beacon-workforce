import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate } from "../_shared/helpers.ts";

/**
 * Sends a reminder push notification to employees who punched IN but never
 * punched OUT after their standard working hours have elapsed.
 *
 * Reminder repeats every 1 hour beyond standard hours (idempotent per hour
 * bucket via employee_notifications row with reference_id = `${date}-h${overHour}`).
 *
 * Designed to be called by cron every 5 minutes.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = todayDate();
    const now = new Date();

    // Open shifts: punched in today, no punch-out yet
    const { data: openLogs } = await supabase
      .from("attendance_logs")
      .select("id, employee_id, office_punch_in, project_id, projects(name), employees(name, standard_hours_per_day)")
      .eq("date", today)
      .not("office_punch_in", "is", null)
      .is("office_punch_out", null);

    if (!openLogs?.length) {
      return jsonResponse({ checked: 0, reminded: 0 });
    }

    // Already reminded buckets today
    const { data: alreadyReminded } = await supabase
      .from("employee_notifications")
      .select("employee_id, reference_id")
      .eq("type", "punch_out_reminder")
      .like("reference_id", `${today}-h%`);
    const remindedKeys = new Set(
      (alreadyReminded ?? []).map((r: { employee_id: string; reference_id: string }) => `${r.employee_id}:${r.reference_id}`),
    );

    let reminded = 0;
    const errors: string[] = [];

    for (const log of openLogs) {
      const empId = (log as any).employee_id as string;
      const punchIn = (log as any).office_punch_in as string;
      if (!empId || !punchIn) continue;

      const stdHours = Number((log as any).employees?.standard_hours_per_day ?? 8);
      // Add 1h default unpaid break to standard working time
      const expectedMinutes = stdHours * 60 + 60;

      const elapsedMin = (now.getTime() - new Date(punchIn).getTime()) / 60000;
      if (elapsedMin < expectedMinutes) continue;

      // Hour bucket past expected end (1, 2, 3, ...)
      const overHour = Math.floor((elapsedMin - expectedMinutes) / 60) + 1;
      const refId = `${today}-h${overHour}`;
      if (remindedKeys.has(`${empId}:${refId}`)) continue;

      const empName = (log as any).employees?.name ?? "there";
      const projectName = (log as any).projects?.name ?? "your shift";
      const overHoursLabel = overHour === 1 ? "1 hour" : `${overHour} hours`;

      try {
        await supabase.functions.invoke("send-push", {
          body: {
            employee_id: empId,
            title: "Are you still working?",
            message: `Hi ${empName}, you've been on the clock at ${projectName} for ${overHoursLabel} past your standard hours. Please punch out if you've finished.`,
            data: {
              type: "punch_out_reminder",
              priority: "high",
              reference_id: refId,
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
      checked: openLogs.length,
      reminded,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
