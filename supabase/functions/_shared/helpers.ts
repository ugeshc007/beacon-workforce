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

/** Max hours a shift may continue across the Dubai date boundary. */
export const CONTINUING_SHIFT_HOURS = 20;

/**
 * Find an employee's still-open, already-punched-in shift REGARDLESS of date.
 * Mid-flow actions (travel, arrive, work start) must continue that shift even
 * when the Dubai date has just rolled over past midnight — otherwise a brand
 * new log is created for the next day with no punch-in, which looks like a
 * missing punch-in and splits the night shift in two.
 */
export async function findContinuingOpenLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  columns: string,
  nowIso?: string,
  hours = CONTINUING_SHIFT_HOURS
) {
  const { data } = await supabase
    .from("attendance_logs")
    .select(columns)
    .eq("employee_id", employeeId)
    .is("office_punch_out", null)
    .not("office_punch_in", "is", null)
    .order("office_punch_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (!isWithinShiftWindow((data as any).office_punch_in, nowIso, hours)) return null;
  return data;
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
 * Find ANY still-open attendance log for an employee, regardless of date or the
 * 12-hour shift window. Used by punch-out so an employee can always close a
 * shift they forgot about, no matter how old it is.
 */
export async function findAnyOpenAttendanceLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  columns: string
) {
  const { data } = await supabase
    .from("attendance_logs")
    .select(columns)
    .eq("employee_id", employeeId)
    .is("office_punch_out", null)
    .not("office_punch_in", "is", null)
    .order("office_punch_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}


/**
 * Pick which attendance log an action timestamp belongs to, given ALL logs for
 * that employee/date. Offline replays can arrive out of order (e.g. a night
 * shift's travel action lands before its punch-in row exists), so choosing
 * "the first open log" is not enough — it merges two shifts into one.
 *
 * Priority:
 *  1. an open log whose punch-in is at/before the action time (latest one)
 *  2. a closed log whose [punch_in, punch_out] window contains the action time
 *  3. the latest log that started before the action time
 *  4. the earliest log (never leave the action unbound when logs exist)
 */
export function pickLogForTimestamp<T extends { office_punch_in?: string | null; office_punch_out?: string | null }>(
  logs: T[] | null | undefined,
  nowIso: string
): T | null {
  if (!logs || logs.length === 0) return null;
  const now = new Date(nowIso).getTime();
  const rows = logs.map((l) => ({
    l,
    start: l.office_punch_in ? new Date(l.office_punch_in).getTime() : null,
    end: l.office_punch_out ? new Date(l.office_punch_out).getTime() : null,
  }));

  const open = rows
    .filter((r) => r.end == null && (r.start == null || r.start <= now + 60_000))
    .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  if (open.length > 0) return open[open.length - 1].l;

  const containing = rows
    .filter((r) => r.start != null && r.end != null && r.start <= now && now <= r.end)
    .sort((a, b) => (a.start as number) - (b.start as number));
  if (containing.length > 0) return containing[containing.length - 1].l;

  const before = rows
    .filter((r) => r.start != null && (r.start as number) <= now)
    .sort((a, b) => (a.start as number) - (b.start as number));
  if (before.length > 0) return before[before.length - 1].l;

  return rows.sort((a, b) => (a.start ?? 0) - (b.start ?? 0))[0].l;
}

/**
 * Re-bind project work sessions to the shift they actually belong to.
 * Call after a punch-in creates/updates a log: any session for that employee
 * on that date whose first timestamp falls inside the new log's window but is
 * bound to a different (already closed) log gets moved onto the new log.
 * This keeps admin timelines from merging two shifts after an offline sync.
 */
export async function rebindSessionsToLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  date: string,
  logId: string,
  logPunchInIso: string
): Promise<void> {
  const start = new Date(logPunchInIso).getTime();
  const { data: sessions } = await supabase
    .from("project_work_sessions")
    .select("id, attendance_log_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, work_end_time")
    .eq("employee_id", employeeId)
    .eq("date", date);

  const toMove = (sessions ?? []).filter((s: any) => {
    if (s.attendance_log_id === logId) return false;
    const first = [s.travel_start_time, s.site_arrival_time, s.work_start_time, s.break_start_time, s.work_end_time]
      .filter(Boolean)
      .map((t: string) => new Date(t).getTime())
      .sort((a, b) => a - b)[0];
    if (first == null) return false;
    return first >= start - 60_000;
  });

  for (const s of toMove) {
    await supabase
      .from("project_work_sessions")
      .update({ attendance_log_id: logId })
      .eq("id", (s as any).id);
  }
}


/**
 * Resolve which attendance log an action should target.
 * If the client passes an explicit `attendance_log_id` (e.g. user is closing
 * a stale shift from a previous day via the unfinished-shift banner), honor
 * that log as long as it belongs to the employee and is still open and within
 * the 12-hour shift window.
 * Otherwise fall back to findOpenAttendanceLog (today/yesterday).
 */
export async function resolveAttendanceLog(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  employeeId: string,
  explicitLogId: string | undefined | null,
  columns: string,
  nowIso?: string
) {
  if (explicitLogId) {
    const { data } = await supabase
      .from("attendance_logs")
      .select(columns)
      .eq("id", explicitLogId)
      .eq("employee_id", employeeId)
      .is("office_punch_out", null)
      .maybeSingle();
    if (data && isWithinShiftWindow((data as any).office_punch_in, nowIso, SHIFT_WINDOW_HOURS)) return data;
  }
  return findOpenAttendanceLog(supabase, employeeId, columns, nowIso);
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
