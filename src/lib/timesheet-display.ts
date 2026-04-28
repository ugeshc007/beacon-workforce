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

  // Deduct breaks if recorded
  const breakMin = log.break_minutes ?? 0;
  if (breakMin > 0) {
    minutes = Math.max(0, minutes - breakMin);
  } else if (log.break_start_time && log.break_end_time) {
    const bs = new Date(log.break_start_time);
    const be = new Date(log.break_end_time);
    if (!isNaN(bs.getTime()) && !isNaN(be.getTime()) && be > bs) {
      minutes = Math.max(0, minutes - diffMinutes(bs, be));
    }
  }

  return minutes;
}

export function formatWorkedMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours === 0 && mins === 0) return "0m";
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}
