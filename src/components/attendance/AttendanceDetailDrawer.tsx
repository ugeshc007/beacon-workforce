import type { AttendanceLog } from "@/hooks/useAttendance";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff, ShieldAlert, Clock, CheckCircle2, Briefcase } from "lucide-react";
import MiniMap from "./MiniMap";
import { useProjectSessions, type ProjectWorkSession } from "@/hooks/useProjectSessions";

interface Props {
  log: AttendanceLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtTime = (ts: string | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
};

const fmtDate = (ts: string | null) => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

interface TimelineStep {
  label: string;
  time: string | null;
  lat?: number | null;
  lng?: number | null;
  distance?: number | null;
  valid?: boolean | null;
  spoofed?: boolean | null;
  accuracy?: number | null;
  color: string;
  icon: React.ReactNode;
}

export function AttendanceDetailDrawer({ log, open, onOpenChange }: Props) {
  const { data: sessions = [] } = useProjectSessions(log?.id);
  if (!log) return null;

  const steps: TimelineStep[] = [
    {
      label: "Office Punch-in",
      time: log.office_punch_in,
      lat: log.office_punch_in_lat,
      lng: log.office_punch_in_lng,
      distance: log.office_punch_in_distance_m != null ? Number(log.office_punch_in_distance_m) : null,
      valid: log.office_punch_in_valid,
      spoofed: log.office_punch_in_spoofed,
      accuracy: log.office_punch_in_accuracy != null ? Number(log.office_punch_in_accuracy) : null,
      color: "text-primary",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Travel Start",
      time: log.travel_start_time,
      lat: log.travel_start_lat != null ? Number(log.travel_start_lat) : null,
      lng: log.travel_start_lng != null ? Number(log.travel_start_lng) : null,
      color: "text-status-traveling",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Site Arrival",
      time: log.site_arrival_time,
      lat: log.site_arrival_lat != null ? Number(log.site_arrival_lat) : null,
      lng: log.site_arrival_lng != null ? Number(log.site_arrival_lng) : null,
      distance: log.site_arrival_distance_m != null ? Number(log.site_arrival_distance_m) : null,
      valid: log.site_arrival_valid,
      color: "text-status-present",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: "Work Start",
      time: log.work_start_time,
      color: "text-status-present",
      icon: <CheckCircle2 className="h-4 w-4" />,
    },
    {
      label: "Break Start",
      time: log.break_start_time,
      color: "text-muted-foreground",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Break End",
      time: log.break_end_time,
      color: "text-muted-foreground",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Work End",
      time: log.work_end_time,
      color: "text-status-overtime",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Office Punch-out",
      time: log.office_punch_out,
      color: "text-muted-foreground",
      icon: <Clock className="h-4 w-4" />,
    },
  ];

  const totalHours = log.total_work_minutes != null ? (log.total_work_minutes / 60).toFixed(1) : "—";
  const otHours = log.overtime_minutes != null ? (log.overtime_minutes / 60).toFixed(1) : "0";
  const breakMin = log.break_minutes ?? 0;
  const cost = Number(log.regular_cost ?? 0) + Number(log.overtime_cost ?? 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{log.employees?.name ?? "Employee"}</SheetTitle>
          <SheetDescription>
            {log.employees?.employee_code} · {log.date} · {log.projects?.name ?? "No project"}
          </SheetDescription>
        </SheetHeader>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Hours</p>
            <p className="text-lg font-bold text-foreground">{totalHours}h</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overtime</p>
            <p className="text-lg font-bold text-status-overtime">{otHours}h</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Break</p>
            <p className="text-lg font-bold text-foreground">{breakMin}m</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cost</p>
            <p className="text-lg font-bold text-foreground">AED {Math.round(cost)}</p>
          </div>
        </div>

        {/* Override info */}
        {log.is_manual_override && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="text-xs font-medium text-amber-400">⚠ Manual Override</p>
            {log.override_reason && <p className="text-xs text-muted-foreground mt-1">{log.override_reason}</p>}
          </div>
        )}

        {/* Vertical Timeline */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Timeline</h3>
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

            {steps.map((step, i) => {
              const completed = !!step.time;
              return (
                <div key={i} className="relative mb-5 last:mb-0">
                  {/* Dot */}
                  <div className={`absolute left-[-24px] top-0.5 h-[22px] w-[22px] rounded-full flex items-center justify-center ${
                    completed ? "bg-card border-2 border-primary" : "bg-card border-2 border-border"
                  }`}>
                    <div className={`h-2 w-2 rounded-full ${completed ? "bg-primary" : "bg-muted"}`} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${completed ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{fmtTime(step.time)}</span>
                    </div>

                    {/* GPS details */}
                    {completed && (step.lat != null || step.distance != null) && (
                      <div className="mt-1 space-y-1">
                        {step.lat != null && step.lng != null && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-mono text-muted-foreground">
                              📍 {Number(step.lat).toFixed(6)}, {Number(step.lng).toFixed(6)}
                              {step.accuracy != null && <span className="ml-1">(±{Math.round(Number(step.accuracy))}m)</span>}
                            </p>
                            <MiniMap lat={Number(step.lat)} lng={Number(step.lng)} label={step.label} />
                          </div>
                        )}
                        {step.distance != null && (
                          <div className="flex items-center gap-1.5">
                            {step.valid === true ? (
                              <Badge className="bg-status-present/20 text-status-present border-status-present/30 text-[9px] gap-1">
                                <MapPin className="h-2.5 w-2.5" />{Math.round(step.distance)}m — Valid
                              </Badge>
                            ) : step.valid === false ? (
                              <Badge className="bg-status-absent/20 text-status-absent border-status-absent/30 text-[9px] gap-1">
                                <MapPinOff className="h-2.5 w-2.5" />{Math.round(step.distance)}m — Outside radius
                              </Badge>
                            ) : null}
                          </div>
                        )}
                        {step.spoofed && (
                          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] gap-1">
                            <ShieldAlert className="h-2.5 w-2.5" />Mock location detected
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-project sessions (when employee used Project flow) */}
        {sessions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Project Sessions ({sessions.length})
            </h3>
            <div className="space-y-4">
              {sessions.map((s, idx) => (
                <ProjectSessionCard key={s.id} session={s} index={idx + 1} />
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {log.notes && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
            <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{log.notes}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ProjectSessionCard({ session, index }: { session: ProjectWorkSession; index: number }) {
  const steps: { label: string; time: string | null; lat?: number | null; lng?: number | null; distance?: number | null; valid?: boolean | null }[] = [
    { label: "Travel Start", time: session.travel_start_time, lat: session.travel_start_lat, lng: session.travel_start_lng },
    { label: "Site Arrival", time: session.site_arrival_time, lat: session.site_arrival_lat, lng: session.site_arrival_lng, distance: session.site_arrival_distance_m, valid: session.site_arrival_valid },
    { label: "Work Start", time: session.work_start_time },
    { label: "Break Start", time: session.break_start_time },
    { label: "Break End", time: session.break_end_time },
    { label: "Work End", time: session.work_end_time },
    { label: "Return Travel", time: session.return_travel_start_time },
  ];

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
          <Badge variant="outline" className="text-[10px]">
            {session.status ?? "—"}
          </Badge>
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
