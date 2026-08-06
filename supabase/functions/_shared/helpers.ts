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

export function errorResponse(message: unknown, status = 400) {
  const msg =
    message instanceof Error
      ? message.message
      : typeof message === "string"
      ? message
      : (message as { message?: string })?.message ?? "Unknown error";
  return jsonResponse({ error: msg }, status);
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

export function dateFromTimestamp(clientTimestamp?: string | null): string {
  const t = clientTimestamp ? Date.parse(clientTimestamp) : NaN;
  const base = Number.isNaN(t) ? new Date() : new Date(t);
  const uae = new Date(base.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().split("T")[0];
}

export function nowTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Resolve the effective timestamp for a mutating action.
 * Prefers a client-supplied timestamp (set when an action was queued offline)
 * over the server clock, so attendance/leg minutes stay accurate even when
 * sync happens hours later. Falls back to server now if missing, invalid,
 * in the future, or > 24h old.
 */
export function resolveTimestamp(clientTimestamp?: string | null): string {
  if (!clientTimestamp) return nowTimestamp();
  const t = Date.parse(clientTimestamp);
  if (Number.isNaN(t)) return nowTimestamp();
  const now = Date.now();
  if (t > now + 60_000) return nowTimestamp();
  // Allow retroactive entries up to 30 days back (covers forgotten stale shifts
  // where employee finishes yesterday/last-week flow today and back-dates each step).
  if (now - t > 30 * 24 * 60 * 60 * 1000) return nowTimestamp();
  return new Date(t).toISOString();
}


/** Maximum elapsed hours since punch-in for a shift to remain open/active. */
export const SHIFT_WINDOW_HOURS = 12;

/** Return true if punchIn is within `hours` of now (default 12h shift window). */
export function isWithinShiftWindow(
  punchInIso: string | null | undefined,
  nowIso?: string,
  hours = SHIFT_WINDOW_HOURS
): boolean {
  if (!punchInIso) return true; // no punch-in yet (blank log) — keep it open
  const punchIn = new Date(punchInIso).getTime();
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  return now - punchIn <= hours * 60 * 60 * 1000;
}

/**
 * Find the currently active (open) attendance log for an employee.
 * Looks at today first, then yesterday — so night shifts that started before
 * midnight and continue into the next UAE day still resolve to the same log.
 * "Open" = office_punch_out IS NULL AND punch-in is within SHIFT_WINDOW_HOURS.
 * Returns null if none found.
 *
 * `columns` must always include `id`, `date`, and `office_punch_in`; callers
 * should add `office_punch_out` only if they need to read it (the helper
 * already filters on it).
 */
export async function findOpenAttendanceLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  columns: string,
  nowIso?: string
) {
  const today = todayDate();
  const yesterday = new Date(new Date(today + "T00:00:00Z").getTime() - 86_400_000)
    .toISOString()
    .split("T")[0];

  const { data } = await supabase
    .from("attendance_logs")
    .select(columns)
    .eq("employee_id", employeeId)
    .in("date", [today, yesterday])
    .is("office_punch_out", null)
    .order("date", { ascending: false })
    .order("office_punch_in", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const punchIn = (data as any).office_punch_in as string | null;
  if (!isWithinShiftWindow(punchIn, nowIso, SHIFT_WINDOW_HOURS)) return null;
  return data;
}

/**
 * Resolve which attendance log an action should target.
 * If the client passes an explicit `attendance_log_id` (e.g. user is closing
 * a stale shift from a previous day via the unfinished-shift banner), honor
 * that log as long as it belongs to the employee and is still open.
 * Otherwise fall back to findOpenAttendanceLog (today/yesterday).
 */
export async function resolveAttendanceLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  explicitLogId: string | undefined | null,
  columns: string
) {
  if (explicitLogId) {
    const { data } = await supabase
      .from("attendance_logs")
      .select(columns)
      .eq("id", explicitLogId)
      .eq("employee_id", employeeId)
      .is("office_punch_out", null)
      .maybeSingle();
    if (data) return data;
  }
  return findOpenAttendanceLog(supabase, employeeId, columns);
}

/**
 * Idempotency check for replayed offline actions.
 * Returns a cached success response if the key was already processed,
 * otherwise reserves the key and returns null (caller should proceed
 * then call recordIdempotencyResult on success).
 */
export async function checkIdempotency(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  key: string | undefined | null,
  employeeId: string,
  action: string
): Promise<Response | null> {
  if (!key) return null;
  const { data } = await supabase
    .from("idempotency_keys")
    .select("response")
    .eq("key", key)
    .maybeSingle();
  if (data?.response) {
    return jsonResponse({ ...(data.response as Record<string, unknown>), deduped: true });
  }
  if (!data) {
    await supabase.from("idempotency_keys").insert({
      key, employee_id: employeeId, action, response: null,
    });
  }
  return null;
}

export async function recordIdempotencyResult(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  key: string | undefined | null,
  response: Record<string, unknown>
): Promise<void> {
  if (!key) return;
  await supabase.from("idempotency_keys").update({ response }).eq("key", key);
}

/** Verify JWT and resolve employee_id, ensuring it matches the authenticated user */
export async function authenticateEmployee(
  req: Request,
  supabase: ReturnType<typeof createSupabaseAdmin>,
  requestedEmployeeId: string
): Promise<{ error?: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return { error: errorResponse("Unauthorized", 401) };

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: errorResponse("Unauthorized", 401) };

  // Verify the authenticated user owns this employee_id
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("id", requestedEmployeeId)
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!emp) return { error: errorResponse("Forbidden: employee mismatch", 403) };

  return {};
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
