// Per-project workflow state machine (runs PER project, after office punch-in)
export type ProjectStep =
  | "idle"            // No session yet
  | "traveling"       // Travel to site started
  | "at_site"         // Arrived at site
  | "working"         // Work in progress
  | "on_break"        // Break in progress
  | "completed";      // Work ended

export type ProjectAction =
  | "start_travel"
  | "arrive_site"
  | "start_work"
  | "start_break"
  | "end_break"
  | "end_work";

const transitions: Record<ProjectStep, ProjectAction[]> = {
  idle: ["start_travel"],
  traveling: ["arrive_site"],
  at_site: ["start_work"],
  working: ["start_break", "end_work"],
  on_break: ["end_break"],
  completed: [],
};

export function getProjectActions(step: ProjectStep): ProjectAction[] {
  return transitions[step] || [];
}

export function getNextProjectStep(current: ProjectStep, action: ProjectAction): ProjectStep | null {
  if (!transitions[current].includes(action)) return null;
  const map: Record<ProjectAction, ProjectStep> = {
    start_travel: "traveling",
    arrive_site: "at_site",
    start_work: "working",
    start_break: "on_break",
    end_break: "working",
    end_work: "completed",
  };
  return map[action];
}

export function deriveProjectStep(session: {
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  work_start_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  work_end_time?: string | null;
} | null): ProjectStep {
  if (!session) return "idle";
  if (session.work_end_time) return "completed";
  if (session.break_start_time && !session.break_end_time) return "on_break";
  if (session.work_start_time) return "working";
  if (session.site_arrival_time) return "at_site";
  if (session.travel_start_time) return "traveling";
  return "idle";
}

export const projectActionLabels: Record<ProjectAction, string> = {
  start_travel: "Start Travel to Site",
  arrive_site: "Arrived at Site",
  start_work: "Start Work",
  start_break: "Take Break",
  end_break: "End Break",
  end_work: "Finish Project",
};

export const projectStepLabels: Record<ProjectStep, string> = {
  idle: "Not Started",
  traveling: "Traveling",
  at_site: "At Site",
  working: "Working",
  on_break: "On Break",
  completed: "Completed",
};

export const projectStepColors: Record<ProjectStep, string> = {
  idle: "text-muted-foreground",
  traveling: "text-amber-400",
  at_site: "text-cyan-400",
  working: "text-green-400",
  on_break: "text-orange-400",
  completed: "text-purple-400",
};
