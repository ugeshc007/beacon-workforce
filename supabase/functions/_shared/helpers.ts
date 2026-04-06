import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Shared helpers for all Android app edge functions

export function createSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

export function createSupabaseUser(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export function corsResponse() {
  return new Response("ok", { headers: corsHeaders });
}

// Haversine distance in meters
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function todayDate(): string {
  // UAE timezone UTC+4
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().split("T")[0];
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}

/** Insert a notification for all managers/admins of a branch */
export async function notifyBranchManagers(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  branchId: string,
  notification: { type: string; title: string; message: string; priority?: string; reference_id?: string; reference_type?: string }
) {
  // Get all users in the branch who are admin or manager
  const { data: users } = await supabase
    .from("users")
    .select("id")
    .eq("branch_id", branchId)
    .eq("is_active", true);

  if (!users?.length) return;

  const userIds = users.map((u: { id: string }) => u.id);

  // Filter to those with admin/manager roles
  const { data: roleUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("user_id", userIds)
    .in("role", ["admin", "manager"]);

  if (!roleUsers?.length) return;

  const notifications = roleUsers.map((ru: { user_id: string }) => ({
    user_id: ru.user_id,
    ...notification,
    priority: notification.priority ?? "normal",
  }));

  await supabase.from("notifications").insert(notifications);
}
