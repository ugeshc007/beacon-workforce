// Per-site-visit workflow state machine
export type SiteVisitStep =
  | "idle"
  | "traveling"
  | "at_site"
  | "surveying"
  | "on_break"
  | "work_done"
  | "returning"
  | "completed";

export type SiteVisitAction =
  | "start_travel"
  | "arrive_site"
  | "start_survey"
  | "start_break"
  | "end_break"
  | "end_visit"
  | "start_return_travel"
  | "arrive_office";

const transitions: Record<SiteVisitStep, SiteVisitAction[]> = {
  idle: ["start_travel"],
  traveling: ["arrive_site"],
  at_site: ["start_survey"],
  surveying: ["start_break", "end_visit"],
  on_break: ["end_break"],
  work_done: ["start_return_travel"],
  returning: ["arrive_office"],
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
    end_visit: "work_done",
    start_return_travel: "returning",
    arrive_office: "completed",
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
  return_travel_start_time?: string | null;
  office_arrival_time?: string | null;
} | null): SiteVisitStep {
  if (!session) return "idle";
  if (session.office_arrival_time) return "completed";
  if (session.return_travel_start_time) return "returning";
  if (session.work_end_time) return "work_done";
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
  start_return_travel: "Start Return Travel",
  arrive_office: "Arrived at Office",
};

export const siteVisitStepLabels: Record<SiteVisitStep, string> = {
  idle: "Not Started",
  traveling: "Traveling",
  at_site: "At Site",
  surveying: "Surveying",
  on_break: "On Break",
  work_done: "Work Done",
  returning: "Returning to Office",
  completed: "Completed",
};

export const siteVisitStepColors: Record<SiteVisitStep, string> = {
  idle: "text-muted-foreground",
  traveling: "text-amber-400",
  at_site: "text-cyan-400",
  surveying: "text-green-400",
  on_break: "text-orange-400",
  work_done: "text-purple-400",
  returning: "text-amber-400",
  completed: "text-blue-400",
};
