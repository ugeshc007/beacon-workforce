import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- FCM V1 Auth helpers ---

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJwt(serviceAccount: { client_email: string; private_key: string; token_uri: string }): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = base64UrlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(enc.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import PEM private key
  const pemBody = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(unsignedToken))
  );

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const jwt = await createJwt(serviceAccount);
  const res = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to get access token: ${errText}`);
  }
  const data = await res.json();
  return data.access_token;
}

// --- Main handler ---

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

    // Parse service account JSON
    const saJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!saJson) {
      // Fallback: save notification to DB only
      await supabaseAdmin.from("employee_notifications").insert({
        employee_id,
        title,
        message: message || null,
        type: data?.type || "info",
        priority: data?.priority || "normal",
      });

      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "FCM_SERVICE_ACCOUNT_JSON not configured, notification saved to DB only" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(saJson);
    const accessToken = await getAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    let sent = 0;
    const failedTokens: string[] = [];

    for (const { fcm_token } of tokens) {
      try {
        const fcmRes = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token: fcm_token,
              notification: { title, body: message || "" },
              data: data ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k, String(v)])
              ) : undefined,
            },
          }),
        });

        if (fcmRes.ok) {
          sent++;
        } else {
          const errBody = await fcmRes.json().catch(() => ({}));
          const errCode = errBody?.error?.details?.[0]?.errorCode;
          // Remove invalid/unregistered tokens
          if (errCode === "UNREGISTERED" || errCode === "INVALID_ARGUMENT") {
            failedTokens.push(fcm_token);
          }
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

    // Save notification to DB
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
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
