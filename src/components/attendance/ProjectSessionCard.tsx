import { Badge } from "@/components/ui/badge";
import { MapPinOff } from "lucide-react";
import type { ProjectWorkSession } from "@/hooks/useProjectSessions";

export function ProjectSessionCard({
  session,
  index,
  fallbackReturnTravelTime,
  fallbackOfficeArrivalTime,
  fallbackOfficeArrivalDistance,
  fallbackOfficeArrivalValid,
}: {
  session: ProjectWorkSession;
  index: number;
  fallbackReturnTravelTime?: string | null;
  fallbackOfficeArrivalTime?: string | null;
  fallbackOfficeArrivalDistance?: number | null;
  fallbackOfficeArrivalValid?: boolean | null;
}) {
  const returnTravel = session.return_travel_start_time ?? fallbackReturnTravelTime ?? null;
  const officeArrival = fallbackOfficeArrivalTime ?? null;
  // In-house sessions never travel — detect when work started without any travel/arrival timestamp.
  const isInHouse = !session.travel_start_time && !session.site_arrival_time && !returnTravel;
  const allSteps: { label: string; time: string | null; distance?: number | null; valid?: boolean | null }[] = [
    { label: "Travel Start", time: session.travel_start_time },
    { label: "Site Arrival", time: session.site_arrival_time, distance: session.site_arrival_distance_m, valid: session.site_arrival_valid },
    { label: "Work Start", time: session.work_start_time },
    { label: "Break Start", time: session.break_start_time },
    { label: "Break End", time: session.break_end_time },
    { label: "Work End", time: session.work_end_time },
    { label: "Return Travel", time: returnTravel },
    { label: "At Office", time: officeArrival, distance: fallbackOfficeArrivalDistance ?? null, valid: fallbackOfficeArrivalValid ?? null },
  ];
  const hiddenInHouse = new Set(["Travel Start", "Site Arrival", "Return Travel", "At Office"]);
  const steps = isInHouse ? allSteps.filter((s) => !hiddenInHouse.has(s.label)) : allSteps;


  const totalH = session.total_work_minutes != null ? (session.total_work_minutes / 60).toFixed(1) : "—";
  const otH = session.overtime_minutes != null ? (session.overtime_minutes / 60).toFixed(1) : "0";

  return (
    <div className="rounded-lg border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Session {index}</p>
          <p className="text-sm font-semibold text-foreground">{session.projects?.name ?? "Project"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">{session.status ?? "—"}</Badge>
          <span className="text-[11px] font-mono text-muted-foreground">{totalH}h · OT {otH}h</span>
        </div>
      </div>
      <div className="relative pl-5">
        <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-border" />
        {steps.map((step, i) => {
          const completed = !!step.time;
          return (
            <div key={i} className="relative mb-2.5 last:mb-0">
              <div className={`absolute left-[-19px] top-1 h-3.5 w-3.5 rounded-full border-2 ${completed ? "border-primary bg-card" : "border-border bg-card"}`}>
                <div className={`h-1 w-1 m-auto mt-[3px] rounded-full ${completed ? "bg-primary" : "bg-muted"}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${completed ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {step.time ? new Date(step.time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—"}
                </span>
                {step.distance != null && step.valid === false && (
                  <Badge className="bg-status-absent/20 text-status-absent border-status-absent/30 text-[9px] gap-1">
                    <MapPinOff className="h-2.5 w-2.5" />{Math.round(Number(step.distance))}m
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
