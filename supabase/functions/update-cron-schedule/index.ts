import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    const { time_uae, job } = await req.json();
    if (!time_uae || !/^\d{2}:\d{2}$/.test(time_uae)) {
      return errorResponse("Invalid time format. Use HH:MM (24h)", 400);
    }

    const [hours, minutes] = time_uae.split(":").map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return errorResponse("Invalid time values", 400);
    }

    // Convert UAE time (UTC+4) to UTC
    let utcHours = hours - 4;
    if (utcHours < 0) utcHours += 24;
    const cronExpression = `${minutes} ${utcHours} * * *`;

    // Determine which cron to update
    const rpcName = job === "morning-briefing"
      ? "update_morning_briefing_cron"
      : "update_absent_check_cron";

    const { error: cronError } = await supabase.rpc(rpcName as any, {
      cron_expr: cronExpression,
    });

    if (cronError) {
      console.error("Cron update error:", cronError);
      return errorResponse(`Failed to update schedule: ${cronError.message}`, 500);
    }

    // Save to settings
    const settingKey = job === "morning-briefing"
      ? "cron_morning_briefing_time"
      : "cron_absent_check_time";

    await supabase.from("settings").upsert({
      key: settingKey,
      value: time_uae,
      is_encrypted: false,
    }, { onConflict: "key" });

    return jsonResponse({
      success: true,
      job: job ?? "check-absent",
      time_uae,
      cron_expression: cronExpression,
    });
  } catch (err) {
    console.error("Error:", err);
    return errorResponse(err, 500);
  }
});
