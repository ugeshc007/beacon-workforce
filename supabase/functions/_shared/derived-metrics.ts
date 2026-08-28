// Canonical worked / travel / break / idle rule — server mirror of
// src/lib/timesheet-display.ts. Keep the two in sync: reports read the stored
// values produced here and fall back to the client rule for uncomputed rows.
//
//   Working = work_start → work_end minus breaks (sessions preferred)
//   Travel  = travel_start → site_arrival  +  return_travel → office_arrival
//   Idle    = presence (punch-in → punch-out) − working − travel − break

export interface MetricSession {
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  break_minutes?: number | null;
  return_travel_start_time?: string | null;
  office_arrival_time?: string | null;
  total_work_minutes?: number | null;
}

export interface MetricLog extends MetricSession {
  office_punch_in?: string | null;
  office_punch_out?: string | null;
}

export interface DerivedMetrics {
  worked: number;
  travel: number;
  breakMinutes: number;
  idle: number;
  overtime: number;
}

const STANDARD_DAY_MINUTES = 480;

function span(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}

function recordedBreak(s: MetricSession): number {
  if (s.break_minutes && s.break_minutes > 0) return s.break_minutes;
  return span(s.break_start_time, s.break_end_time);
}

function workStamp(s: MetricSession): number | null {
  if (!s.work_start_time || !s.work_end_time) return null;
  const gross = span(s.work_start_time, s.work_end_time);
  if (gross <= 0) return null;
  // Org rule: any span beyond the 8h standard carries at least a 1h unpaid
  // break (9h on site = 8h duty).
  let deduct = recordedBreak(s);
  if (gross > STANDARD_DAY_MINUTES) deduct = Math.max(deduct, 60);
  return Math.max(0, gross - deduct);
}

export function computeDerivedMetrics(
  log: MetricLog,
  sessions: MetricSession[],
  standardHoursPerDay = 8,
): DerivedMetrics {
  // Worked
  let worked = 0;
  let found = false;
  for (const s of sessions) {
    const m = workStamp(s);
    if (m != null) {
      worked += m;
      found = true;
    } else if (s.total_work_minutes && s.total_work_minutes > 0) {
      worked += s.total_work_minutes;
      found = true;
    }
  }
  if (!found) {
    const own = workStamp(log);
    if (own != null) {
      worked = own;
      found = true;
    }
  }

  // Break
  let breakMinutes = sessions.reduce((sum, s) => sum + recordedBreak(s), 0);
  if (breakMinutes <= 0) breakMinutes = recordedBreak(log);

  // Travel
  let travel = 0;
  for (const s of sessions) {
    travel += span(s.travel_start_time, s.site_arrival_time);
    travel += span(s.return_travel_start_time, s.office_arrival_time);
  }
  if (travel <= 0) {
    travel = span(log.travel_start_time, log.site_arrival_time)
      + span(log.return_travel_start_time, log.office_arrival_time);
  }

  const presence = span(log.office_punch_in, log.office_punch_out);

  // No work stamps anywhere: fall back to presence minus break.
  if (!found && presence > 0) {
    let deduct = breakMinutes;
    if (presence > STANDARD_DAY_MINUTES) deduct = Math.max(deduct, 60);
    worked = Math.max(0, presence - deduct);
  }

  const idle = presence > 0
    ? Math.max(0, presence - worked - travel - breakMinutes)
    : 0;

  const stdMin = Math.round((standardHoursPerDay || 8) * 60);
  return {
    worked,
    travel,
    breakMinutes,
    idle,
    overtime: Math.max(0, worked - stdMin),
  };
}
