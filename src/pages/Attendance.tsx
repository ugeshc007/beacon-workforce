import { toLocalDateStr } from "@/lib/utils";
import { useState } from "react";
import { useAttendanceLogs, useAttendanceSummary, computeLiveCost, type AttendanceLog } from "@/hooks/useAttendance";
import { useCanAccess } from "@/hooks/usePermissions";
import { useProjects } from "@/hooks/useProjects";
import { AttendanceTimeline } from "@/components/attendance/AttendanceTimeline";
import { getDisplayWorkedMinutes, getDisplayOvertimeMinutes, formatWorkedMinutes } from "@/lib/timesheet-display";
import { AttendanceOverrideDialog } from "@/components/attendance/AttendanceOverrideDialog";
import { AttendanceDetailDrawer } from "@/components/attendance/AttendanceDetailDrawer";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, UserCheck, Wrench, Clock, DollarSign, Search,
  ChevronLeft, ChevronRight, MapPin, MapPinOff, ShieldAlert, Pencil, Eye,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

const fmt = (ts: string | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

function deriveStatus(log: AttendanceLog): string {
  if (log.office_punch_out) return "completed";
  if ((log as any).office_arrival_time) return "at_office";
  if ((log as any).return_travel_start_time) return "returning";
  if (log.work_end_time) return "work_ended";
  if (log.break_start_time && !log.break_end_time) return "on_break";
  if (log.work_start_time) return "working";
  if (log.site_arrival_time) return "on_site";
  if (log.travel_start_time) return "traveling";
  if (log.office_punch_in) return "punched_in";
  return "pending";
}

const statusLabel: Record<string, { text: string; className: string }> = {
  completed: { text: "Completed", className: "bg-muted text-muted-foreground" },
  at_office: { text: "At Office", className: "bg-primary/20 text-primary border-primary/30" },
  returning: { text: "Returning", className: "bg-status-traveling/20 text-status-traveling border-status-traveling/30" },
  work_ended: { text: "Work Ended", className: "bg-status-overtime/20 text-status-overtime border-status-overtime/30" },
  on_break: { text: "On Break", className: "bg-orange-400/20 text-orange-400 border-orange-400/30" },
  working: { text: "Working", className: "bg-status-present/20 text-status-present border-status-present/30" },
  on_site: { text: "On Site", className: "bg-status-present/20 text-status-present border-status-present/30" },
  traveling: { text: "Traveling", className: "bg-status-traveling/20 text-status-traveling border-status-traveling/30" },
  punched_in: { text: "Punched In", className: "bg-primary/20 text-primary border-primary/30" },
  pending: { text: "Pending", className: "bg-muted text-muted-foreground" },
};

export default function Attendance() {
  const today = toLocalDateStr(new Date());
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [gpsFilter, setGpsFilter] = useState("all");
  const [overrideLog, setOverrideLog] = useState<AttendanceLog | null>(null);
  const [detailLog, setDetailLog] = useState<AttendanceLog | null>(null);

  const { data: logs, isLoading } = useAttendanceLogs({ date, search, projectId });
  const { data: summary } = useAttendanceSummary(date);
  const { data: projects } = useProjects({});
  const { allowed: canEdit } = useCanAccess("attendance", "can_edit");

  // Apply GPS filter client-side
  const filteredLogs = (logs ?? []).filter((log) => {
    if (gpsFilter === "valid") return log.office_punch_in_valid === true;
    if (gpsFilter === "invalid") return log.office_punch_in_valid === false;
    if (gpsFilter === "spoofed") return log.office_punch_in_spoofed === true;
    return true;
  });

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(toLocalDateStr(d));
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/attendance/daily">
            <Button variant="outline" size="sm" className="text-xs"><Users className="h-3.5 w-3.5 mr-1" />Daily Team</Button>
          </Link>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDate(today)}>Today</Button>
            <DateInput value={date} onChange={setDate} className="w-[150px]" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard title="Punched In" value={summary?.punchedIn ?? 0} icon={Users} variant="default" />
        <StatCard title="On Site" value={summary?.onSite ?? 0} icon={UserCheck} variant="success" />
        <StatCard title="Working" value={summary?.working ?? 0} icon={Wrench} variant="brand" />
        <StatCard title="OT Hours" value={`${Math.round(((summary?.totalOtMin ?? 0) / 60) * 10) / 10}h`} icon={Clock} variant="warning" />
        <StatCard title="Labor Cost" value={`AED ${Math.round(summary?.totalCost ?? 0).toLocaleString()}`} icon={DollarSign} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={gpsFilter} onValueChange={setGpsFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="GPS Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All GPS</SelectItem>
            <SelectItem value="valid">GPS Valid</SelectItem>
            <SelectItem value="invalid">GPS Invalid</SelectItem>
            <SelectItem value="spoofed">Spoofed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : !filteredLogs.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No attendance records for this date</p>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Project</th>
                    <th className="text-left py-2 font-medium">GPS</th>
                    <th className="text-left py-2 font-medium">Punch In</th>
                    <th className="text-left py-2 font-medium">On Site</th>
                    <th className="text-left py-2 font-medium">Work</th>
                    <th className="text-left py-2 font-medium">Break</th>
                    <th className="text-left py-2 font-medium">Out</th>
                    <th className="text-left py-2 font-medium min-w-[180px]">Timeline</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">OT</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Cost</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const stdHours = Number((log.employees as any)?.standard_hours_per_day ?? 8);
                    const workedMin = getDisplayWorkedMinutes(log as any);
                    const otMin = getDisplayOvertimeMinutes(log as any, stdHours);
                    const totalDisplay = workedMin > 0 ? formatWorkedMinutes(workedMin) : "—";
                    const otDisplay = otMin > 0 ? formatWorkedMinutes(otMin) : "0m";
                    const cost = computeLiveCost(log);
                    const isLiveCost = cost > 0 && !log.work_end_time;
                    const status = deriveStatus(log);
                    const sl = statusLabel[status];
                    const breakMin = log.break_minutes ?? 0;

                    return (
                      <tr key={log.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => setDetailLog(log)}>
                        <td className="py-2.5">
                          <div>
                            <span className="font-medium text-foreground">{log.employees?.name ?? "—"}</span>
                            {log.is_manual_override && (
                              <Badge variant="outline" className="ml-1.5 text-[9px] border-amber-500/50 text-amber-400">Override</Badge>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{log.employees?.employee_code}</span>
                        </td>
                        <td className="py-2.5 text-muted-foreground text-xs">{log.projects?.name ?? "—"}</td>
                        <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {log.office_punch_in_valid === true ? (
                              <span title="GPS valid"><MapPin className="h-3.5 w-3.5 text-status-present" /></span>
                            ) : log.office_punch_in_valid === false ? (
                              <span title="GPS invalid"><MapPinOff className="h-3.5 w-3.5 text-status-absent" /></span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                            {log.office_punch_in_spoofed && (
                              <span title="GPS spoofing detected"><ShieldAlert className="h-3.5 w-3.5 text-amber-400" /></span>
                            )}
                            {log.office_punch_in_distance_m != null && (
                              <span className="text-[10px] text-muted-foreground font-mono">{Math.round(Number(log.office_punch_in_distance_m))}m</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(log.office_punch_in)}</td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(log.site_arrival_time)}</td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {fmt(log.work_start_time)}
                          {log.work_end_time && <span className="text-muted-foreground/50"> – {fmt(log.work_end_time)}</span>}
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {breakMin > 0 ? `${breakMin}m` : "—"}
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(log.office_punch_out)}</td>
                        <td className="py-2.5 pb-6">
                          <AttendanceTimeline log={log} />
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{totalDisplay}</td>
                        <td className="py-2.5 text-right font-mono text-xs">
                          {Number(otH) > 0 ? (
                            <span className="text-status-overtime">{otH}h</span>
                          ) : (
                            <span className="text-muted-foreground">0h</span>
                          )}
                        </td>
                        <td className="py-2.5">
                          <Badge variant="outline" className={`text-[9px] ${sl.className}`}>{sl.text}</Badge>
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">
                          {cost > 0 ? (
                            <span className={isLiveCost ? "text-status-traveling" : ""} title={isLiveCost ? "Live estimate (work in progress)" : undefined}>
                              AED {Math.round(cost)}{isLiveCost ? "*" : ""}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setDetailLog(log)}>
                                <Eye className="h-3.5 w-3.5 mr-2" />View Details
                              </DropdownMenuItem>
                              {canEdit && (
                                <DropdownMenuItem onClick={() => setOverrideLog(log)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" />Override
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <AttendanceOverrideDialog
        log={overrideLog}
        open={!!overrideLog}
        onOpenChange={(v) => { if (!v) setOverrideLog(null); }}
      />

      <AttendanceDetailDrawer
        log={detailLog}
        open={!!detailLog}
        onOpenChange={(v) => { if (!v) setDetailLog(null); }}
      />
    </div>
  );
}
