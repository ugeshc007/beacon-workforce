// Idle-time calculator.
// "Idle time" = minutes inside a paid shift where the employee produced
// no work and was not travelling. Big gaps between workflow steps count
// as idle, and shifts with no work_start_time or no project assignment
// count the entire shift as idle.

export const PRE_TRAVEL_IDLE_MIN = 30;   // punch-in -> travel start
export const SITE_IDLE_MIN = 30;         // site arrival -> work start
export const POST_WORK_IDLE_MIN = 30;    // work end -> return travel
export const RETURN_IDLE_MIN = 30;       // at office -> punch out
export const IN_HOUSE_PRE_WORK_IDLE_MIN = 30; // punch in -> work start (no travel)

export type IdleReason =
  | "no_assignment"
  | "no_work_started"
  | "pre_travel_gap"
  | "site_idle_gap"
  | "post_work_gap"
  | "return_gap"
  | "in_house_pre_work_gap"
  | "driver_standby"
  | "in_progress";

export type IdleGap = {
  reason: IdleReason;
  from: string | null;
  to: string | null;
  minutes: number;
  label: string;
};

export type IdleSession = {
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  return_travel_start_time?: string | null;
};

/** One driver trip leg (drop off / pick up / wait) for standby crediting. */
export type IdleDriverLeg = {
  travel_start_time: string | null;
  site_arrival_time: string | null;
  leg_end_time: string | null;
};

export type IdleLogInput = {
  office_punch_in: string | null;
  office_punch_out: string | null;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  return_travel_start_time: string | null;
  office_arrival_time: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  break_minutes: number | null;
  sessions: IdleSession[];
  hasAssignment: boolean;
  /** Driver trip legs for this employee/date (pure drivers rarely log work steps). */
  driverLegs?: IdleDriverLeg[];
  /** True when the employee only drives (no technician/helper secondary skill). */
  isPureDriver?: boolean;
};

export type IdleResult = {
  shiftMin: number;
  productiveMin: number;
  breakMin: number;
  idleMin: number;
  /** Paid waiting time for pure drivers — excluded from idleMin. */
  standbyMin: number;
  reasons: IdleReason[];
  gaps: IdleGap[];
  inProgress: boolean;
};


const diffMin = (a: string | null | undefined, b: string | null | undefined): number => {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 60000));
};

const fmtGap = (label: string, min: number): string => {
  if (min < 60) return `${label} ${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${label} ${h}h ${m}m`;
};

/**
 * Compute idle stats for one attendance log (one employee, one date).
 * Callers pass merged session data (from project_work_sessions) and a flag
 * indicating whether the employee had ANY project assignment that day.
 */
export function computeIdle(log: IdleLogInput): IdleResult {
  const reasons: IdleReason[] = [];
  const gaps: IdleGap[] = [];

  if (!log.office_punch_in) {
    return {
      shiftMin: 0, productiveMin: 0, breakMin: 0, idleMin: 0, standbyMin: 0,
      reasons: [], gaps: [], inProgress: false,
    };
  }


  const inProgress = !log.office_punch_out;
  const shiftEnd = log.office_punch_out ?? new Date().toISOString();
  const shiftMin = diffMin(log.office_punch_in, shiftEnd);

  // Collect productive minutes from sessions
  let productiveMin = 0;
  let breakMin = Number(log.break_minutes ?? 0) || 0;
  let anyWorkStarted = !!log.work_start_time;

  for (const s of log.sessions ?? []) {
    if (s.work_start_time) anyWorkStarted = true;
    // Work window
    if (s.work_start_time && s.work_end_time) {
      let w = diffMin(s.work_start_time, s.work_end_time);
      if (s.break_start_time && s.break_end_time) {
        const b = diffMin(s.break_start_time, s.break_end_time);
        w = Math.max(0, w - b);
        breakMin += b;
      }
      productiveMin += w;
    }
    // Real travel: travel_start -> site_arrival
    productiveMin += diffMin(s.travel_start_time, s.site_arrival_time);
    // Return travel: work_end -> office arrival (via return_travel_start)
    // We only credit up to now: return_travel_start_time -> next event we know of.
  }

  // Log-level travel (older records that stored on the parent log)
  productiveMin += diffMin(log.travel_start_time, log.site_arrival_time);
  productiveMin += diffMin(log.return_travel_start_time, log.office_arrival_time);
  if (log.work_start_time && log.work_end_time) {
    productiveMin += Math.max(0, diffMin(log.work_start_time, log.work_end_time) - breakMin);
  }

  // Driver trip legs — a driver's productive time is travel plus time held on
  // site (drop off / pick up / wait), not work_start..work_end steps.
  const legs = log.driverLegs ?? [];
  let legMin = 0;
  for (const leg of legs) {
    legMin += diffMin(leg.travel_start_time, leg.site_arrival_time);
    legMin += diffMin(leg.site_arrival_time, leg.leg_end_time);
  }
  productiveMin += legMin;
  if (legMin > 0) anyWorkStarted = true;

  // Cap productive so it can't exceed shift
  productiveMin = Math.min(productiveMin, shiftMin);


  // Whole-shift idle cases
  if (!log.hasAssignment && log.office_punch_out) {
    reasons.push("no_assignment");
  }
  if (!anyWorkStarted && log.office_punch_out) {
    reasons.push("no_work_started");
  }

  // Gap detection — walk the earliest session's timeline
  const s0: IdleSession | undefined = (log.sessions ?? [])[0];
  const travelStart = s0?.travel_start_time ?? log.travel_start_time;
  const siteArrival = s0?.site_arrival_time ?? log.site_arrival_time;
  const workStart = s0?.work_start_time ?? log.work_start_time;
  const workEnd = (log.sessions ?? []).slice(-1)[0]?.work_end_time ?? log.work_end_time;
  const returnTravel = (log.sessions ?? []).slice(-1)[0]?.return_travel_start_time ?? log.return_travel_start_time;
  const officeArrival = log.office_arrival_time;

  if (travelStart) {
    const g = diffMin(log.office_punch_in, travelStart);
    if (g > PRE_TRAVEL_IDLE_MIN) {
      reasons.push("pre_travel_gap");
      gaps.push({ reason: "pre_travel_gap", from: log.office_punch_in, to: travelStart, minutes: g, label: fmtGap("Pre-travel idle", g) });
    }
  } else if (workStart) {
    // in-house day — punch in to work start
    const g = diffMin(log.office_punch_in, workStart);
    if (g > IN_HOUSE_PRE_WORK_IDLE_MIN) {
      reasons.push("in_house_pre_work_gap");
      gaps.push({ reason: "in_house_pre_work_gap", from: log.office_punch_in, to: workStart, minutes: g, label: fmtGap("Pre-work idle", g) });
    }
  }

  if (siteArrival && workStart) {
    const g = diffMin(siteArrival, workStart);
    if (g > SITE_IDLE_MIN) {
      reasons.push("site_idle_gap");
      gaps.push({ reason: "site_idle_gap", from: siteArrival, to: workStart, minutes: g, label: fmtGap("Site-idle gap", g) });
    }
  }

  if (workEnd && returnTravel) {
    const g = diffMin(workEnd, returnTravel);
    if (g > POST_WORK_IDLE_MIN) {
      reasons.push("post_work_gap");
      gaps.push({ reason: "post_work_gap", from: workEnd, to: returnTravel, minutes: g, label: fmtGap("Post-work idle", g) });
    }
  }

  if (officeArrival && log.office_punch_out) {
    const g = diffMin(officeArrival, log.office_punch_out);
    if (g > RETURN_IDLE_MIN) {
      reasons.push("return_gap");
      gaps.push({ reason: "return_gap", from: officeArrival, to: log.office_punch_out, minutes: g, label: fmtGap("At-office idle", g) });
    }
  }

  if (inProgress) reasons.push("in_progress");

  const idleMin = Math.max(0, shiftMin - productiveMin - breakMin);

  return { shiftMin, productiveMin, breakMin, idleMin, reasons, gaps, inProgress };
}

export const REASON_LABEL: Record<IdleReason, string> = {
  no_assignment: "No project assigned",
  no_work_started: "Never started work",
  pre_travel_gap: "Long pre-travel gap",
  site_idle_gap: "Long site-idle gap",
  post_work_gap: "Long post-work gap",
  return_gap: "Long at-office gap",
  in_house_pre_work_gap: "Late work start",
  in_progress: "Shift in progress",
};
