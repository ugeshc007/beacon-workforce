interface TimesheetDisplayLog {
  date?: string | null;
  total_work_minutes?: number | null;
  office_punch_in?: string | null;
  office_punch_out?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
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

function diffMinutes(start: string, end: string | Date): number {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}

export function getDisplayWorkedMinutes(log: TimesheetDisplayLog, now: Date = new Date()): number {
  const storedMinutes = log.total_work_minutes ?? 0;
  if (storedMinutes > 0) return storedMinutes;

  const isToday = !!log.date && log.date === getUaeDateKey(now);

  if (log.office_punch_in) {
    if (log.office_punch_out) {
      return diffMinutes(log.office_punch_in, log.office_punch_out);
    }

    if (isToday) {
      return diffMinutes(log.office_punch_in, now);
    }
  }

  if (log.work_start_time) {
    if (log.work_end_time) {
      return diffMinutes(log.work_start_time, log.work_end_time);
    }

    if (isToday) {
      return diffMinutes(log.work_start_time, now);
    }
  }

  return storedMinutes;
}

export function formatWorkedMinutes(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;

  if (hours === 0 && mins === 0) return "0m";
  if (hours === 0) return `${mins}m`;
  return `${hours}h ${mins}m`;
}