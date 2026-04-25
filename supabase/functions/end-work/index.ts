import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, notifyBranchManagers, authenticateEmployee } from "../_shared/helpers.ts";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id, work_start_time, break_minutes, project_id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);
    if (!log.work_start_time) return errorResponse("Work not started", 400);

    const { data: emp } = await supabase
      .from("employees")
      .select("hourly_rate, overtime_rate, standard_hours_per_day, name, branch_id, custom_skill_id")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    const workStart = new Date(log.work_start_time).getTime();
    const workEnd = new Date(now).getTime();
    const totalWorkMinutes = Math.round((workEnd - workStart) / 60000) - (log.break_minutes ?? 0);
    const standardMinutes = Number(emp.standard_hours_per_day) * 60;
    const overtimeMinutes = Math.max(0, totalWorkMinutes - standardMinutes);
    const totalHours = totalWorkMinutes / 60;
    const regularHours = Math.min(totalWorkMinutes / 60, Number(emp.standard_hours_per_day));

    // ─── Holiday detection ────────────────────────────────────
    // Check if today is a public holiday (branch-specific or global)
    const { data: holidayRows } = await supabase
      .from("public_holidays")
      .select("id, branch_id")
      .eq("date", today);

    const isPublicHoliday = (holidayRows ?? []).some(
      (h: { branch_id: string | null }) => h.branch_id === null || h.branch_id === emp.branch_id
    );

    // Check if today is the configured weekly off day
    const { data: offDaySetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "weekly_off_day")
      .maybeSingle();
    const offDay = (offDaySetting?.value ?? "sunday").toLowerCase();
    // Day-of-week in UAE (UTC+4)
    const todayDow = DAY_NAMES[new Date(new Date().getTime() + 4 * 60 * 60 * 1000).getUTCDay()];
    const isWeeklyOff = offDay !== "none" && todayDow === offDay;

    const isHoliday = isPublicHoliday || isWeeklyOff;

    let regularCost = 0;
    let overtimeCost = 0;
    let holidayPremiumCost = 0;

    if (isHoliday && totalWorkMinutes > 0) {
      // Resolve holiday rate from custom skill (default: multiplier 1.5)
      let rateType: "multiplier" | "fixed" = "multiplier";
      let rateValue = 1.5;
      if (emp.custom_skill_id) {
        const { data: skill } = await supabase
          .from("custom_skills")
          .select("holiday_rate_type, holiday_rate_value")
          .eq("id", emp.custom_skill_id)
          .maybeSingle();
        if (skill) {
          rateType = (skill.holiday_rate_type as "multiplier" | "fixed") ?? "multiplier";
          rateValue = Number(skill.holiday_rate_value ?? 1.5);
        }
      }

      // Per-hour holiday rate
      const otRate = Number(emp.overtime_rate);
      const perHourHolidayRate = rateType === "fixed" ? rateValue : otRate * rateValue;
      holidayPremiumCost = Math.round(totalHours * perHourHolidayRate * 100) / 100;
      // Store full premium in overtime_cost so existing reports/timesheets continue to reflect total pay
      overtimeCost = holidayPremiumCost;
      regularCost = 0;
    } else {
      regularCost = Math.round(regularHours * Number(emp.hourly_rate) * 100) / 100;
      overtimeCost = Math.round((overtimeMinutes / 60) * Number(emp.overtime_rate) * 100) / 100;
    }

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        work_end_time: now,
        total_work_minutes: totalWorkMinutes,
        overtime_minutes: overtimeMinutes,
        regular_cost: regularCost,
        overtime_cost: overtimeCost,
        is_holiday: isHoliday,
        holiday_premium_cost: holidayPremiumCost,
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    if (overtimeMinutes > 0 || isHoliday) {
      try {
        const { data: setting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "notification_ot_warning_hours")
          .maybeSingle();
        const otWarningHours = parseFloat(setting?.value ?? "2");
        const otHours = overtimeMinutes / 60;
        const priority = isHoliday || otHours >= otWarningHours ? "critical" : "high";

        const title = isHoliday ? "Holiday Work Recorded" : "Overtime Recorded";
        const message = isHoliday
          ? `${emp.name} worked ${Math.round(totalHours * 10) / 10}h on a holiday (AED ${Math.round(holidayPremiumCost)} premium)`
          : `${emp.name} logged ${Math.round(otHours * 10) / 10}h overtime (AED ${Math.round(overtimeCost)})`;

        await notifyBranchManagers(supabase, emp.branch_id, {
          type: isHoliday ? "holiday_alert" : "overtime_alert",
          title,
          message,
          priority,
          reference_id: log.id,
          reference_type: "attendance_log",
        });
      } catch (_) {
        // Non-critical
      }
    }

    return jsonResponse({
      success: true,
      attendance_id: log.id,
      total_work_minutes: totalWorkMinutes,
      overtime_minutes: overtimeMinutes,
      regular_cost: regularCost,
      overtime_cost: overtimeCost,
      holiday_premium_cost: holidayPremiumCost,
      is_holiday: isHoliday,
      timestamp: now,
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
