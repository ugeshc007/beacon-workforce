// Workflow state machine for field employee daily flow
export type WorkflowStep =
  | "idle"           // Not punched in yet
  | "punched_in"     // At office, punched in
  | "traveling"      // Traveling to site
  | "at_site"        // Arrived at site
  | "working"        // Work started
  | "on_break"       // Break in progress
  | "work_done"      // Work ended
  | "returning"      // Traveling back to office
  | "at_office"      // Arrived back at office
  | "punched_out";   // Day complete

export type WorkflowAction =
  | "punch_in"
  | "start_travel"
  | "arrive_site"
  | "start_work"
  | "start_break"
  | "end_break"
  | "end_work"
  | "start_return_travel"
  | "arrive_office"
  | "punch_out";

const transitions: Record<WorkflowStep, WorkflowAction[]> = {
  idle: ["punch_in"],
  punched_in: ["start_travel", "start_break", "punch_out"],
  traveling: ["arrive_site"],
  at_site: ["start_work"],
  working: ["start_break", "end_work"],
  on_break: ["end_break"],
  work_done: ["start_return_travel"],
  returning: ["arrive_office"],
  at_office: ["punch_out"],
  punched_out: [],
};

export function getAvailableActions(step: WorkflowStep): WorkflowAction[] {
  return transitions[step] || [];
}

export function getNextStep(current: WorkflowStep, action: WorkflowAction): WorkflowStep | null {
  const allowed = transitions[current];
  if (!allowed.includes(action)) return null;

  const stepMap: Record<WorkflowAction, WorkflowStep> = {
    punch_in: "punched_in",
    start_travel: "traveling",
    arrive_site: "at_site",
    start_work: "working",
    start_break: "on_break",
    end_break: "working",
    end_work: "work_done",
    start_return_travel: "returning",
    arrive_office: "at_office",
    punch_out: "punched_out",
  };

  return stepMap[action];
}

export function deriveStepFromLog(log: {
  office_punch_in?: string | null;
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  work_start_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  work_end_time?: string | null;
  return_travel_start_time?: string | null;
  office_arrival_time?: string | null;
  office_punch_out?: string | null;
} | null): WorkflowStep {
  if (!log || !log.office_punch_in) return "idle";
  if (log.office_punch_out) return "punched_out";
  if (log.office_arrival_time) return "at_office";
  if (log.return_travel_start_time) return "returning";
  if (log.work_end_time) return "work_done";
  if (log.break_start_time && !log.break_end_time) return "on_break";
  if (log.work_start_time) return "working";
  if (log.site_arrival_time) return "at_site";
  if (log.travel_start_time) return "traveling";
  return "punched_in";
}

export const actionLabels: Record<WorkflowAction, string> = {
  punch_in: "Punch In",
  start_travel: "Start Travel",
  arrive_site: "Arrived at Site",
  start_work: "Start Work",
  start_break: "Take Break",
  end_break: "End Break",
  end_work: "End Work",
  start_return_travel: "Start Return Travel",
  arrive_office: "Arrived at Office",
  punch_out: "Punch Out",
};

export const stepLabels: Record<WorkflowStep, string> = {
  idle: "Not Started",
  punched_in: "Punched In",
  traveling: "Traveling",
  at_site: "At Site",
  working: "Working",
  on_break: "On Break",
  work_done: "Work Done",
  returning: "Returning to Office",
  at_office: "At Office",
  punched_out: "Day Complete",
};

export const stepColors: Record<WorkflowStep, string> = {
  idle: "text-muted-foreground",
  punched_in: "text-blue-400",
  traveling: "text-amber-400",
  at_site: "text-cyan-400",
  working: "text-green-400",
  on_break: "text-orange-400",
  work_done: "text-purple-400",
  returning: "text-amber-400",
  at_office: "text-blue-400",
  punched_out: "text-muted-foreground",
};
