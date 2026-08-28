interface TimesheetDisplayLog {
  date?: string | null;
  total_work_minutes?: number | null;
  // Office attendance
  office_punch_in?: string | null;
  office_punch_out?: string | null;
  office_arrival_time?: string | null;
  // Travel / site stages
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  return_travel_start_time?: string | null;
  // Work stages (project / maintenance / site visit share these names)
  work_start_time?: string | null;
  work_end_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  break_minutes?: number | null;
}

function getUaeDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function diffMinutes(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function earliestDate(values: (string | null | undefined)[]): Date | null {
  let min: Date | null = null;
  for (const v of values) {
    if (!v) continue;
    const d = new Date(v);
    if (isNaN(d.getTime())) continue;
    if (!min || d < min) min = d;
  }
  return min;
}

function latestDate(values: (string | null | undefined)[]): Date | null {
  let max: Date | null = null;
  for (const v of values) {
    if (!v) continue;
    const d = new Date(v);
    if (isNaN(d.getTime())) continue;
    if (!max || d > max) max = d;
  }
  return max;
}

/**
 * Computes worked minutes across ANY work stage:
 * office punch-in/out, travel, site arrival, work start/end, return travel.
 * Falls back to live elapsed for today if no end stamp yet.
 * Subtracts break minutes when known.
 */
export function getDisplayWorkedMinutes(log: TimesheetDisplayLog, now: Date = new Date()): number {
  const storedMinutes = log.total_work_minutes ?? 0;
  if (storedMinutes > 0) return storedMinutes;

  const isToday = !!log.date && log.date === getUaeDateKey(now);

  const start = earliestDate([
    log.office_punch_in,
    log.travel_start_time,
    log.site_arrival_time,
    log.work_start_time,
  ]);

  if (!start) return storedMinutes;

  const end = latestDate([
    log.office_punch_out,
    log.return_travel_start_time,
    log.work_end_time,
    log.break_end_time,
    log.break_start_time,
    log.office_arrival_time,
  ]);

  let endTime: Date | null = end;
  if (!endTime || endTime <= start) {
    endTime = isToday ? now : null;
  }
  if (!endTime) return storedMinutes;

  let minutes = diffMinutes(start, endTime);

  // Determine break to deduct: use recorded break if any, otherwise default 60 min
  // (org standard: 1 hour unpaid break per shift)
  const DEFAULT_BREAK_MIN = 60;
  let breakMin = log.break_minutes ?? 0;
  if (!breakMin && log.break_start_time && log.break_end_time) {
    const bs = new Date(log.break_start_time);
    const be = new Date(log.break_end_time);
    if (!isNaN(bs.getTime()) && !isNaN(be.getTime()) && be > bs) {
      breakMin = diffMinutes(bs, be);
    }
  }
  const deduct = Math.max(breakMin, DEFAULT_BREAK_MIN);
  // Only deduct if shift is long enough to warrant a break
  if (minutes > deduct) minutes -= deduct;

  return minutes;
}

/**
 * Computes overtime minutes = worked (after break) - standard hours.
 * standardHoursPerDay defaults to 8.
 */
export function getDisplayOvertimeMinutes(
  log: TimesheetDisplayLog,
  standardHoursPerDay: number = 8,
  now: Date = new Date(),
): number {
  // Prefer stored overtime when present
  const stored = (log as any).overtime_minutes;
  if (stored != null && stored > 0) return stored;

  const worked = getDisplayWorkedMinutes(log, now);
  const stdMin = Math.round((standardHoursPerDay || 8) * 60);
  return Math.max(0, worked - stdMin);
}

export function formatWorkedMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours === 0 && mins === 0) return "0m";
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}

/**
 * Aggregates multiple attendance logs for the SAME (employee, date) into
 * a single combined daily total. OT is computed against the combined worked
 * minutes vs standard hours/day (not per-shift).
 */
export function aggregateDayLogs(
  logs: TimesheetDisplayLog[],
  standardHoursPerDay: number = 8,
  now: Date = new Date(),
): { workedMin: number; otMin: number; regularMin: number } {
  let workedMin = 0;
  for (const log of logs) {
    workedMin += getDisplayWorkedMinutes(log, now);
  }
  const stdMin = Math.round((standardHoursPerDay || 8) * 60);
  const otMin = Math.max(0, workedMin - stdMin);
  const regularMin = workedMin - otMin;
  return { workedMin, otMin, regularMin };
}

/**
 * Group logs by `${employee_id}|${date}` and return aggregated daily totals.
 */
export function groupAndAggregateLogs<T extends TimesheetDisplayLog & { employee_id?: string }>(
  logs: T[],
  standardHoursPerDay: number = 8,
  now: Date = new Date(),
): Map<string, { logs: T[]; workedMin: number; otMin: number; regularMin: number }> {
  const groups = new Map<string, T[]>();
  for (const log of logs) {
    const key = `${(log as any).employee_id ?? ""}|${log.date ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }
  const result = new Map<string, { logs: T[]; workedMin: number; otMin: number; regularMin: number }>();
  for (const [key, group] of groups) {
    const agg = aggregateDayLogs(group, standardHoursPerDay, now);
    result.set(key, { logs: group, ...agg });
  }
  return result;
}


interface TimesheetDisplaySession {
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  work_start_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  work_end_time?: string | null;
  return_travel_start_time?: string | null;
  office_arrival_time?: string | null;
  break_minutes?: number | null;
  total_work_minutes?: number | null;
}

/**
 * Worked minutes for a daily log, falling back to its project work sessions
 * when the parent attendance log has no usable stamps (mobile flow writes the
 * real travel/work stamps onto project_work_sessions).
 */
export function getWorkedMinutesWithSessions(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
  now: Date = new Date(),
): number {
  const base = getDisplayWorkedMinutes(log, now);
  if (base > 0) return base;
  if (!sessions?.length) return base;

  const start = earliestDate(
    sessions.flatMap((s) => [s.travel_start_time, s.site_arrival_time, s.work_start_time]),
  );
  const end = latestDate(
    sessions.flatMap((s) => [
      s.work_end_time,
      s.return_travel_start_time,
      s.office_arrival_time,
      s.break_end_time,
    ]),
  );
  if (!start || !end || end <= start) return base;

  let breakMin = 0;
  for (const s of sessions) {
    if (s.break_minutes && s.break_minutes > 0) {
      breakMin += s.break_minutes;
    } else if (s.break_start_time && s.break_end_time) {
      const bs = new Date(s.break_start_time);
      const be = new Date(s.break_end_time);
      if (!isNaN(bs.getTime()) && !isNaN(be.getTime()) && be > bs) breakMin += diffMinutes(bs, be);
    }
  }

  return getDisplayWorkedMinutes(
    {
      date: log.date,
      work_start_time: start.toISOString(),
      work_end_time: end.toISOString(),
      break_minutes: breakMin || null,
    },
    now,
  );
}

/** Overtime derived from session-aware worked minutes. */
export function getOvertimeMinutesWithSessions(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
  standardHoursPerDay: number = 8,
  now: Date = new Date(),
): number {
  const stored = (log as any).overtime_minutes;
  if (stored != null && stored > 0) return stored;
  const worked = getWorkedMinutesWithSessions(log, sessions, now);
  const stdMin = Math.round((standardHoursPerDay || 8) * 60);
  return Math.max(0, worked - stdMin);
}

/* ──────────────────────────────────────────────────────────────
 * CANONICAL WORKED / TRAVEL / IDLE RULE
 * Single source of truth shared by reports, drawers and dashboards.
 *
 *   Working time  = work_start → work_end, minus recorded breaks.
 *                   (Preferred from project work sessions; falls back to the
 *                    parent attendance log's own work stamps.)
 *   Travel time   = travel_start → site_arrival  +  return_travel → office_arrival
 *   Idle time     = presence (punch-in → punch-out) − working − travel − break
 *
 * Anything that is neither working nor travel nor break is IDLE — it is never
 * counted as working hours.
 * ────────────────────────────────────────────────────────────── */

function spanMinutes(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}

function recordedBreakMinutes(s: TimesheetDisplaySession | TimesheetDisplayLog): number {
  if (s.break_minutes && s.break_minutes > 0) return s.break_minutes;
  return spanMinutes(s.break_start_time, s.break_end_time);
}

/**
 * Working minutes of a single work-stamp source (session or log):
 * work_start → work_end minus recorded break. Returns null when there is no
 * usable work_start (so callers can fall through to the next source).
 * An open work_start on today's row counts up to `now`.
 */
function workStampMinutes(
  s: TimesheetDisplaySession | TimesheetDisplayLog,
  isToday: boolean,
  now: Date,
): number | null {
  if (!s.work_start_time) return null;
  const end = s.work_end_time ?? (isToday ? now.toISOString() : null);
  if (!end) return null;
  const gross = spanMinutes(s.work_start_time, end);
  if (gross <= 0) return null;
  // Org rule: a shift longer than the 8h standard always carries at least a
  // 1-hour unpaid break (9h continuous on site = 8h duty). Short stints keep
  // only their recorded break.
  let deduct = recordedBreakMinutes(s);
  if (gross > 480) deduct = Math.max(deduct, 60);
  return Math.max(0, gross - deduct);
}

/**
 * Effective working minutes for one attendance log.
 * Priority: project work sessions' work stamps → the log's own work stamps →
 * stored total_work_minutes → presence (punch-in → punch-out) minus break.
 */
export function getEffectiveWorkedMinutes(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
  now: Date = new Date(),
): number {
  const isToday = !!log.date && log.date === getUaeDateKey(now);

  // 1. Per-project sessions are the authoritative record of actual work.
  if (sessions?.length) {
    let total = 0;
    let found = false;
    for (const s of sessions) {
      const m = workStampMinutes(s, isToday, now);
      if (m != null) {
        total += m;
        found = true;
      } else if (s.total_work_minutes && s.total_work_minutes > 0) {
        total += s.total_work_minutes;
        found = true;
      }
    }
    if (found) return total;
  }

  // 2. The log's own work stamps (in-house flow writes these directly).
  const own = workStampMinutes(log, isToday, now);
  if (own != null) return own;

  // 3. Server-computed value.
  if (log.total_work_minutes && log.total_work_minutes > 0) return log.total_work_minutes;

  // 4. Last resort: presence minus recorded break (no work stamps at all).
  const presence = spanMinutes(log.office_punch_in, log.office_punch_out);
  if (presence > 0) return Math.max(0, presence - recordedBreakMinutes(log));
  return 0;
}

/** Travel minutes (outbound + return), from sessions when present. */
export function getEffectiveTravelMinutes(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
): number {
  let travel = 0;
  if (sessions?.length) {
    for (const s of sessions) {
      travel += spanMinutes(s.travel_start_time, s.site_arrival_time);
      travel += spanMinutes(s.return_travel_start_time, s.office_arrival_time);
    }
  }
  if (travel > 0) return travel;
  return spanMinutes(log.travel_start_time, log.site_arrival_time)
    + spanMinutes(log.return_travel_start_time, log.office_arrival_time);
}

/** Break minutes for the day (sessions when present, else the log). */
export function getEffectiveBreakMinutes(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
): number {
  if (sessions?.length) {
    const total = sessions.reduce((sum, s) => sum + recordedBreakMinutes(s), 0);
    if (total > 0) return total;
  }
  return recordedBreakMinutes(log);
}

/**
 * Idle minutes = presence − working − travel − break.
 * Zero when the shift has no closed presence window.
 */
export function getEffectiveIdleMinutes(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
  now: Date = new Date(),
): number {
  const presence = spanMinutes(log.office_punch_in, log.office_punch_out);
  if (presence <= 0) return 0;
  const worked = getEffectiveWorkedMinutes(log, sessions, now);
  const travel = getEffectiveTravelMinutes(log, sessions);
  const breakMin = getEffectiveBreakMinutes(log, sessions);
  return Math.max(0, presence - worked - travel - breakMin);
}

/** Overtime against the employee's standard day, from effective worked time. */
export function getEffectiveOvertimeMinutes(
  log: TimesheetDisplayLog,
  sessions?: TimesheetDisplaySession[] | null,
  standardHoursPerDay: number = 8,
  now: Date = new Date(),
): number {
  const worked = getEffectiveWorkedMinutes(log, sessions, now);
  const stdMin = Math.round((standardHoursPerDay || 8) * 60);
  return Math.max(0, worked - stdMin);
}
