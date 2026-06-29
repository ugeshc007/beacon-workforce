import { WorkflowAction } from "@/lib/workflow-engine";
import { ProjectAction } from "@/lib/project-workflow-engine";

interface AttendanceLogTimes {
  date: string;
  office_punch_in: string | null;
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
  return_travel_start_time: string | null;
  office_arrival_time: string | null;
  office_punch_out: string | null;
}

interface SessionTimes {
  travel_start_time: string | null;
  site_arrival_time: string | null;
  work_start_time: string | null;
  break_start_time: string | null;
  break_end_time: string | null;
  work_end_time: string | null;
}

function pad(n: number) { return n.toString().padStart(2, "0"); }

/** Format an ISO timestamp as local HH:mm. Returns null if not set. */
function isoToHHmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Add minutes to an HH:mm string, capping at 23:59. */
function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + mins;
  if (total > 23 * 60 + 59) total = 23 * 60 + 59;
  if (total < 0) total = 0;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** For an office workflow action on a stale log, return {minTime, defaultTime} in HH:mm. */
export function officeActionTimeHints(log: AttendanceLogTimes, action: WorkflowAction) {
  // Find the last set timestamp before this action in workflow order.
  const order: (keyof AttendanceLogTimes)[] = [
    "office_punch_in", "travel_start_time", "site_arrival_time",
    "work_start_time", "break_start_time", "break_end_time", "work_end_time",
    "return_travel_start_time", "office_arrival_time", "office_punch_out",
  ];
  // Latest non-null timestamp on the log
  let lastTs: string | null = null;
  for (const k of order) {
    const v = log[k] as string | null;
    if (v) lastTs = v;
  }
  const minTime = isoToHHmm(lastTs);
  const defaultTime = minTime ? addMinutes(minTime, action === "punch_out" ? 10 : 5) : null;
  return { minTime, defaultTime };
}

/** For a project workflow action on a stale session, return {minTime, defaultTime} in HH:mm. */
export function projectActionTimeHints(session: SessionTimes | null, action: ProjectAction) {
  const order: (keyof SessionTimes)[] = [
    "travel_start_time", "site_arrival_time", "work_start_time",
    "break_start_time", "break_end_time", "work_end_time",
  ];
  let lastTs: string | null = null;
  if (session) {
    for (const k of order) {
      const v = session[k] as string | null;
      if (v) lastTs = v;
    }
  }
  const minTime = isoToHHmm(lastTs);
  const defaultTime = minTime ? addMinutes(minTime, action === "end_work" ? 30 : 5) : null;
  return { minTime, defaultTime };
}
