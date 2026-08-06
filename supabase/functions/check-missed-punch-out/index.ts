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
    const now = new Date();
    // Look back 14 hours so night shifts punched in on Day 1 and still open
    // on Day 2 get reminder notifications.
    const lookback = new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString();

    // Open shifts: punched in within the last 14 hours, no punch-out yet
    const { data: openLogs } = await supabase
      .from("attendance_logs")
      .select("id, employee_id, office_punch_in, project_id, projects(name), employees(name, standard_hours_per_day)")
      .not("office_punch_in", "is", null)
      .is("office_punch_out", null)
      .gte("office_punch_in", lookback);

    // Note: don't early-return when no openLogs — we still check pending
    // project-step reminders below.


    // Already reminded buckets in the lookback window. Reference key uses the
    // current UAE date so reminders for night shifts still dedupe per hour.
    const today = todayDate();
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

    for (const log of openLogs ?? []) {
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

    // ------------------------------------------------------------------
    // Pending-step reminders: employee started work on a project but never
    // tapped "End Work" after 9h of elapsed time. Fires once per session per
    // hour bucket beyond 9h.
    // ------------------------------------------------------------------
    const { data: openSessions } = await supabase
      .from("project_work_sessions")
      .select("id, employee_id, work_start_time, work_end_time, project_id, projects(name), employees(name)")
      .not("work_start_time", "is", null)
      .is("work_end_time", null)
      .gte("work_start_time", lookback);

    const { data: alreadyRemindedSteps } = await supabase
      .from("employee_notifications")
      .select("employee_id, reference_id")
      .eq("type", "pending_step_reminder")
      .like("reference_id", `${today}-s%`);
    const remindedStepKeys = new Set(
      (alreadyRemindedSteps ?? []).map((r: { employee_id: string; reference_id: string }) => `${r.employee_id}:${r.reference_id}`),
    );

    let stepReminded = 0;
    for (const sess of openSessions ?? []) {
      const empId = (sess as any).employee_id as string;
      const start = (sess as any).work_start_time as string;
      if (!empId || !start) continue;
      const elapsedMin = (now.getTime() - new Date(start).getTime()) / 60000;
      if (elapsedMin < 9 * 60) continue;
      const overHour = Math.floor((elapsedMin - 9 * 60) / 60) + 1;
      const refId = `${today}-s${(sess as any).id}-h${overHour}`;
      if (remindedStepKeys.has(`${empId}:${refId}`)) continue;

      const empName = (sess as any).employees?.name ?? "there";
      const projectName = (sess as any).projects?.name ?? "your project";
      try {
        await supabase.functions.invoke("send-push", {
          body: {
            employee_id: empId,
            title: "Did you forget to end work?",
            message: `Hi ${empName}, you've been working on ${projectName} for over 9 hours. Please tap End Work if you're done.`,
            data: {
              type: "pending_step_reminder",
              priority: "high",
              reference_id: refId,
              reference_type: "project_session",
            },
          },
        });
        stepReminded++;
      } catch (e) {
        errors.push(`${empId}(step): ${(e as Error).message}`);
      }
    }

    return jsonResponse({
      checked: openLogs?.length ?? 0,
      reminded,
      step_reminded: stepReminded,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
