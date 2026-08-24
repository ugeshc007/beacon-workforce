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
