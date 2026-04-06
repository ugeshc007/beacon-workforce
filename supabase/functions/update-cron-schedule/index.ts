import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();

    // Validate caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return errorResponse("Unauthorized", 401);

    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    // has_role uses user_id from users table, need to look up
    const { data: userData } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!userData) return errorResponse("User not found", 403);

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userData.id,
      _role: "admin",
    });
    if (!isAdmin) return errorResponse("Admin access required", 403);

    const { time_uae } = await req.json();
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

    // Unschedule existing job
    await supabase.rpc("extensions" as any).schema("cron");
    // Use raw SQL via supabase admin
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get DB connection to update cron
    const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

    // Use the REST API to execute SQL
    const sqlUnschedule = `SELECT cron.unschedule('check-absent-daily-9am-uae');`;
    const sqlSchedule = `
      SELECT cron.schedule(
        'check-absent-daily-9am-uae',
        '${cronExpression}',
        $$
        SELECT net.http_post(
          url:='${supabaseUrl}/functions/v1/check-absent',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${anonKey}"}'::jsonb,
          body:='{}'::jsonb
        ) as request_id;
        $$
      );
    `;

    // Execute via PostgREST RPC - use pg connection
    // We'll use fetch to the management API
    const pgResp1 = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
    });

    // Better approach: use the supabase-js to call raw SQL via pg
    // Actually, let's use the postgres connection directly
    // Edge functions don't have pg driver easily, so let's use a different approach:
    // Store the setting and use a DB function to update cron

    // First, save the setting
    await supabase.from("settings").upsert({
      key: "cron_absent_check_time",
      value: time_uae,
      is_encrypted: false,
    }, { onConflict: "key" });

    // Now call a DB function to update the cron job
    const { error: cronError } = await supabase.rpc("update_absent_check_cron" as any, {
      cron_expr: cronExpression,
    });

    if (cronError) {
      console.error("Cron update error:", cronError);
      return errorResponse(`Failed to update schedule: ${cronError.message}`, 500);
    }

    return jsonResponse({ 
      success: true, 
      time_uae,
      cron_expression: cronExpression,
      message: `Absent check scheduled daily at ${time_uae} UAE time`,
    });
  } catch (err) {
    console.error("Error:", err);
    return errorResponse(err.message, 500);
  }
});
