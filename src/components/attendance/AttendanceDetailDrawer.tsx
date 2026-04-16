import { lazy, Suspense } from "react";
import type { AttendanceLog } from "@/hooks/useAttendance";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MapPin, MapPinOff, ShieldAlert, Clock, CheckCircle2 } from "lucide-react";

const MiniMap = lazy(() => import("./MiniMap"));

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
                            <Suspense fallback={<div className="h-32 w-full rounded-md bg-muted animate-pulse" />}>
                              <MiniMap lat={Number(step.lat)} lng={Number(step.lng)} label={step.label} />
                            </Suspense>
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
