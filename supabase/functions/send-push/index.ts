import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { employee_id, title, message, data } = await req.json();

    if (!employee_id || !title) {
      return new Response(
        JSON.stringify({ error: "employee_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get device tokens for this employee
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("device_tokens")
      .select("fcm_token")
      .eq("employee_id", employee_id);

    if (tokensError) throw tokensError;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No device tokens found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmKey) {
      // Still create the notification in DB even without FCM
      await supabaseAdmin.from("employee_notifications").insert({
        employee_id,
        title,
        message: message || null,
        type: data?.type || "info",
        priority: data?.priority || "normal",
      });

      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "FCM_SERVER_KEY not configured, notification saved to DB only" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send FCM push to all device tokens
    let sent = 0;
    const failedTokens: string[] = [];

    for (const { fcm_token } of tokens) {
      try {
        const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmKey}`,
          },
          body: JSON.stringify({
            to: fcm_token,
            notification: { title, body: message || "" },
            data: data || {},
          }),
        });

        const result = await fcmRes.json();
        if (result.success === 1) {
          sent++;
        } else {
          failedTokens.push(fcm_token);
        }
      } catch {
        failedTokens.push(fcm_token);
      }
    }

    // Clean up invalid tokens
    if (failedTokens.length > 0) {
      await supabaseAdmin
        .from("device_tokens")
        .delete()
        .in("fcm_token", failedTokens);
    }

    // Also save notification to DB
    await supabaseAdmin.from("employee_notifications").insert({
      employee_id,
      title,
      message: message || null,
      type: data?.type || "info",
      priority: data?.priority || "normal",
    });

    return new Response(
      JSON.stringify({ success: true, sent, total_tokens: tokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
