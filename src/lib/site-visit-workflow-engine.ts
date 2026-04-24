// Per-site-visit workflow state machine (5 steps after office punch-in)
export type SiteVisitStep =
  | "idle"
  | "traveling"
  | "at_site"
  | "surveying"
  | "on_break"
  | "completed";

export type SiteVisitAction =
  | "start_travel"
  | "arrive_site"
  | "start_survey"
  | "start_break"
  | "end_break"
  | "end_visit";

const transitions: Record<SiteVisitStep, SiteVisitAction[]> = {
  idle: ["start_travel"],
  traveling: ["arrive_site"],
  at_site: ["start_survey"],
  surveying: ["start_break", "end_visit"],
  on_break: ["end_break"],
  completed: [],
};

export function getSiteVisitActions(step: SiteVisitStep): SiteVisitAction[] {
  return transitions[step] || [];
}

export function getNextSiteVisitStep(current: SiteVisitStep, action: SiteVisitAction): SiteVisitStep | null {
  if (!transitions[current].includes(action)) return null;
  const map: Record<SiteVisitAction, SiteVisitStep> = {
    start_travel: "traveling",
    arrive_site: "at_site",
    start_survey: "surveying",
    start_break: "on_break",
    end_break: "surveying",
    end_visit: "completed",
  };
  return map[action];
}

export function deriveSiteVisitStep(session: {
  travel_start_time?: string | null;
  site_arrival_time?: string | null;
  work_start_time?: string | null;
  break_start_time?: string | null;
  break_end_time?: string | null;
  work_end_time?: string | null;
} | null): SiteVisitStep {
  if (!session) return "idle";
  if (session.work_end_time) return "completed";
  if (session.break_start_time && !session.break_end_time) return "on_break";
  if (session.work_start_time) return "surveying";
  if (session.site_arrival_time) return "at_site";
  if (session.travel_start_time) return "traveling";
  return "idle";
}

export const siteVisitActionLabels: Record<SiteVisitAction, string> = {
  start_travel: "Start Travel to Site",
  arrive_site: "Arrived at Site",
  start_survey: "Start Survey",
  start_break: "Take Break",
  end_break: "End Break",
  end_visit: "Finish Site Visit",
};

export const siteVisitStepLabels: Record<SiteVisitStep, string> = {
  idle: "Not Started",
  traveling: "Traveling",
  at_site: "At Site",
  surveying: "Surveying",
  on_break: "On Break",
  completed: "Completed",
};

export const siteVisitStepColors: Record<SiteVisitStep, string> = {
  idle: "text-muted-foreground",
  traveling: "text-amber-400",
  at_site: "text-cyan-400",
  surveying: "text-green-400",
  on_break: "text-orange-400",
  completed: "text-purple-400",
};
