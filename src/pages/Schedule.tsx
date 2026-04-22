import { toLocalDateStr } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { useCopyMaintenanceAssignments } from "@/hooks/useMaintenance";
import { useCanAccess } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import {
  useWeekAssignments, useWeekMaintenanceAssignments, useWeekSiteVisits, useDetectConflicts,
  useCopyPreviousWeek, useApplyToDateRange, useRecurringSchedule,
  type MaintenanceScheduleItem,
} from "@/hooks/useSchedule";
import { DayAssignmentPanel } from "@/components/schedule/DayAssignmentPanel";
import { ScheduleTaskSummary } from "@/components/schedule/ScheduleTaskSummary";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, CalendarDays, AlertTriangle, Users,
  Copy, CalendarRange, Repeat, MoreVertical, Wrench, MapPin,
} from "lucide-react";

function getDayDates(startOffset: number, count = 7) {
  const now = new Date();
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + startOffset + i);
    dates.push(toLocalDateStr(d));
  }
  return dates;
}

const shortDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type BulkDialog = "copy" | "apply" | "recurring" | null;

export default function Schedule() {
  const navigate = useNavigate();
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(toLocalDateStr(new Date()));
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);
  const [jobCardSearch, setJobCardSearch] = useState("");
  const [selectedJobCard, setSelectedJobCard] = useState("all");
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [copyMaintDialog, setCopyMaintDialog] = useState<{ callId: string; companyName: string; sourceDate: string } | null>(null);
  const [copyMaintTargetDate, setCopyMaintTargetDate] = useState("");
  const [copyProjectDialog, setCopyProjectDialog] = useState<{ projectId: string; projectName: string; sourceDate: string } | null>(null);
  const [copyProjectTargetDate, setCopyProjectTargetDate] = useState("");

  // Apply-to-range state
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [skipWeekends, setSkipWeekends] = useState(true);

  // Recurring state
  const [recurWeeks, setRecurWeeks] = useState(4);

  const weekDates = useMemo(() => getDayDates(dayOffset), [dayOffset]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // For "copy previous week" we need the 7 days before the current window
  const prevWeekDates = useMemo(() => getDayDates(dayOffset - 7), [dayOffset]);
  const prevWeekStart = prevWeekDates[0];
  const prevWeekEnd = prevWeekDates[6];

  const { user } = useAuth();
  const { data: projects } = useProjects({ status: "all", userRole: user?.role, userId: user?.id });
  const activeProjects = (projects ?? []).filter((p) => ["on_hold", "in_progress"].includes(p.status));

  // Unique job cards for filter
  const jobCards = useMemo(() => {
    const cards = activeProjects.map(p => p.job_card).filter(Boolean) as string[];
    return [...new Set(cards)].sort();
  }, [activeProjects]);

  // Filter by job card first, then use for project selector
  const filteredByJobCard = selectedJobCard === "all"
    ? activeProjects
    : activeProjects.filter(p => p.job_card === selectedJobCard);

  // Auto-select project when job card narrows to one
  const effectiveProjectId = selectedProjectId;

  const { data: assignments, isLoading } = useWeekAssignments(weekStart, weekEnd, effectiveProjectId);
  const { data: maintenanceItems } = useWeekMaintenanceAssignments(weekStart, weekEnd);
  const { data: siteVisitItems } = useWeekSiteVisits(weekStart, weekEnd);
  const conflicts = useDetectConflicts(assignments ?? []);
  const queryClient = useQueryClient();

  // Realtime subscription for assignment changes
  useEffect(() => {
    const channel = supabase
      .channel("schedule-assignments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["schedule-assignments"] });
        queryClient.invalidateQueries({ queryKey: ["available-employees"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_assignments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["schedule-maintenance-assignments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "site_visits" }, () => {
        queryClient.invalidateQueries({ queryKey: ["schedule-site-visits"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId);
  const today = toLocalDateStr(new Date());

  const copyWeek = useCopyPreviousWeek();
  const applyRange = useApplyToDateRange();
  const recurring = useRecurringSchedule();
  const copyMaint = useCopyMaintenanceAssignments();
  const { allowed: canCreate } = useCanAccess("schedule", "can_create");
  const { allowed: canEdit } = useCanAccess("schedule", "can_edit");

  const weekLabel = (() => {
    const s = new Date(weekStart + "T00:00:00");
    const e = new Date(weekEnd + "T00:00:00");
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(s)} – ${fmt(e)}, ${e.getFullYear()}`;
  })();

  const prevWeekLabel = (() => {
    const s = new Date(prevWeekStart + "T00:00:00");
    const e = new Date(prevWeekEnd + "T00:00:00");
    const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fmt(s)} – ${fmt(e)}`;
  })();

  const dayAssignments = (date: string) => (assignments ?? []).filter((a) => a.date === date);
  const dayMaintenanceItems = (date: string) => (maintenanceItems ?? []).filter((m) => m.date === date);
  const daySiteVisits = (date: string) => (siteVisitItems ?? []).filter((v) => v.date === date);
  const dayConflicts = (date: string) => conflicts.filter((c) => c.date === date);

  const handleCopyWeek = async () => {
    try {
      const count = await copyWeek.mutateAsync({
        sourceStart: prevWeekStart,
        sourceEnd: prevWeekEnd,
        targetStart: weekStart,
        projectId: selectedProjectId !== "all" ? selectedProjectId : undefined,
      });
      toast.success(`Copied ${count} assignments from previous week`);
      setBulkDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApplyRange = async () => {
    if (!selectedDay) { toast.error("Select a day first"); return; }
    if (!rangeStart || !rangeEnd) { toast.error("Set start and end dates"); return; }
    try {
      const count = await applyRange.mutateAsync({
        sourceDate: selectedDay,
        startDate: rangeStart,
        endDate: rangeEnd,
        projectId: selectedProjectId !== "all" ? selectedProjectId : undefined,
        skipWeekends,
      });
      toast.success(`Applied to ${count} assignment slots`);
      setBulkDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRecurring = async () => {
    try {
      const result = await recurring.mutateAsync({
        sourceStart: weekStart,
        sourceEnd: weekEnd,
        weeks: recurWeeks,
        projectId: selectedProjectId !== "all" ? selectedProjectId : undefined,
      });
      toast.success(`Created ${result.assignments} assignments across ${result.weeks} weeks`);
      setBulkDialog(null);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Bulk actions menu */}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs">
                  <MoreVertical className="h-3.5 w-3.5 mr-1" />Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setBulkDialog("copy")}>
                  <Copy className="h-3.5 w-3.5 mr-2" />Copy from Previous Week
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  if (!selectedDay) { toast.error("Select a day first to use as source"); return; }
                  setRangeStart(weekStart);
                  setRangeEnd(weekEnd);
                  setBulkDialog("apply");
                }}>
                  <CalendarRange className="h-3.5 w-3.5 mr-2" />Apply to Date Range
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkDialog("recurring")}>
                  <Repeat className="h-3.5 w-3.5 mr-2" />Recurring Schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Job Card filter with search */}
          <div className="relative">
            <Select
              value={selectedJobCard}
              onValueChange={(v) => {
                setSelectedJobCard(v);
                setJobCardSearch("");
                // If a specific job card is chosen, auto-select its project if only one
                if (v !== "all") {
                  const matching = activeProjects.filter(p => p.job_card === v);
                  if (matching.length === 1) {
                    setSelectedProjectId(matching[0].id);
                  } else {
                    setSelectedProjectId("all");
                  }
                }
                setSelectedDay(null);
              }}
            >
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Job Cards" /></SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-1">
                  <Input
                    placeholder="Search job card..."
                    value={jobCardSearch}
                    onChange={(e) => setJobCardSearch(e.target.value)}
                    className="h-8 text-xs"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <SelectItem value="all">All Job Cards</SelectItem>
                {jobCards
                  .filter(jc => !jobCardSearch || jc.toLowerCase().includes(jobCardSearch.toLowerCase()))
                  .map((jc) => <SelectItem key={jc} value={jc}>{jc}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>

          <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedDay(null); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {filteredByJobCard.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDayOffset((d) => d - 7)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDayOffset(0)}>Today</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setDayOffset((d) => d + 7)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Conflict banner */}
      {conflicts.length > 0 && (
        <div className="rounded-lg bg-status-absent/10 border border-status-absent/30 p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-status-absent shrink-0" />
          <p className="text-sm text-status-absent">
            {conflicts.length} scheduling conflict{conflicts.length > 1 ? "s" : ""} detected this week
          </p>
        </div>
      )}

      {/* Week grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 sm:h-32 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {weekDates.map((date, i) => {
            const da = dayAssignments(date);
            const dm = dayMaintenanceItems(date);
            const dc = dayConflicts(date);
            const isToday = date === today;
            const isSelected = date === selectedDay;
            const isFriday = new Date(date + "T00:00:00").getDay() === 5;

            const projectGroups = new Map<string, number>();
            for (const a of da) projectGroups.set(a.project_name, (projectGroups.get(a.project_name) ?? 0) + 1);

            const maintGroups = new Map<string, number>();
            for (const m of dm) maintGroups.set(m.company_name, (maintGroups.get(m.company_name) ?? 0) + 1);

            return (
              <Card
                key={date}
                className={`cursor-pointer transition-all hover:border-brand/40 ${
                  isSelected ? "border-brand ring-1 ring-brand/30" : ""
                } ${isToday ? "bg-brand/5" : ""} ${isFriday ? "bg-muted/30" : ""}`}
                onClick={() => { setSelectedDay(date === selectedDay ? null : date); setExpandedProjectId(null); }}
              >
                <CardContent className="p-2.5 sm:space-y-2">
                  {/* Mobile: horizontal row layout */}
                  <div className="flex sm:hidden items-center gap-3">
                    <div className="flex items-center gap-2 min-w-[80px]">
                      <span className={`text-sm font-medium ${isToday ? "text-brand" : "text-muted-foreground"}`}>
                        {shortDayNames[new Date(date + "T00:00:00").getDay()]}
                      </span>
                      <span className={`text-sm font-mono ${isToday ? "text-brand font-bold" : "text-foreground"}`}>
                        {new Date(date + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center gap-2 overflow-x-auto">
                      {da.length === 0 && dm.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No assignments</p>
                      ) : (
                        <>
                          {[...projectGroups].map(([name, count]) => (
                            <div key={name} className="flex items-center gap-1 text-xs shrink-0">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="text-foreground">{name}</span>
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">{count}</Badge>
                            </div>
                          ))}
                          {[...maintGroups].map(([name, count]) => (
                            <div key={`m-${name}`} className="flex items-center gap-1 text-xs shrink-0">
                              <Wrench className="h-3 w-3 text-status-overtime shrink-0" />
                              <span className="text-status-overtime">{name}</span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0 border-status-overtime/30 text-status-overtime">{count}</Badge>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {dc.length > 0 && (
                      <div className="flex items-center gap-1 shrink-0">
                        <AlertTriangle className="h-3 w-3 text-status-absent" />
                        <span className="text-[10px] text-status-absent">{dc.length}</span>
                      </div>
                    )}
                  </div>
                  {/* Desktop: original card layout */}
                  <div className="hidden sm:block space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-medium ${isToday ? "text-brand" : "text-muted-foreground"}`}>
                        {shortDayNames[new Date(date + "T00:00:00").getDay()]}
                      </span>
                      <span className={`text-xs font-mono ${isToday ? "text-brand font-bold" : "text-foreground"}`}>
                        {new Date(date + "T00:00:00").getDate()}
                      </span>
                    </div>
                    <div className="space-y-1 min-h-[60px]">
                      {da.length === 0 && dm.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center pt-4">No assignments</p>
                      ) : (
                        <>
                          {[...projectGroups].map(([name, count]) => (
                            <div key={name} className="flex items-center gap-1 text-[10px]">
                              <Users className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                              <span className="truncate text-foreground">{name}</span>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">{count}</Badge>
                            </div>
                          ))}
                          {[...maintGroups].map(([name, count]) => (
                            <div key={`m-${name}`} className="flex items-center gap-1 text-[10px]">
                              <Wrench className="h-2.5 w-2.5 text-status-overtime shrink-0" />
                              <span className="truncate text-status-overtime">{name}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto border-status-overtime/30 text-status-overtime">{count}</Badge>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                    {dc.length > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-status-absent" />
                        <span className="text-[10px] text-status-absent">{dc.length} conflict{dc.length > 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Day assignment panel */}
      {selectedDay && selectedProjectId !== "all" && selectedProject && (
        <DayAssignmentPanel
          date={selectedDay}
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          assignments={dayAssignments(selectedDay).filter((a) => a.project_id === selectedProjectId)}
          requiredTech={(selectedProject as any).required_team_members ?? selectedProject.required_technicians + selectedProject.required_helpers}
          requiredHelp={0}
          requiredSup={selectedProject.required_supervisors}
          requiredDrivers={(selectedProject as any).required_drivers ?? 0}
          conflicts={dayConflicts(selectedDay)}
          readOnly={!canEdit}
        />
      )}

      {selectedDay && selectedProjectId === "all" && !expandedProjectId && (() => {
        const da = dayAssignments(selectedDay);
        const dm = dayMaintenanceItems(selectedDay);
        const projectsWithAssignments = activeProjects
          .filter((p) => da.some((a) => a.project_id === p.id))
          .slice()
          .sort((a, b) => {
            const ta = (a as any).created_at ? new Date((a as any).created_at).getTime() : 0;
            const tb = (b as any).created_at ? new Date((b as any).created_at).getTime() : 0;
            return tb - ta; // newest first
          })
          .map((p) => ({
            id: p.id,
            name: p.name,
            site_address: p.site_address ?? null,
            assignmentCount: da.filter((a) => a.project_id === p.id).length,
          }));

        // Group maintenance by call
        const maintGroupsForDay = new Map<string, { id: string; company_name: string; location: string | null; count: number; priority: string; scope: string | null; staffNames: string[]; timeLabel: string | null }>();
        for (const m of dm) {
          if (!maintGroupsForDay.has(m.maintenance_call_id)) {
            maintGroupsForDay.set(m.maintenance_call_id, {
              id: m.maintenance_call_id,
              company_name: m.company_name,
              location: m.location,
              count: 0,
              priority: m.priority,
              scope: m.scope,
              staffNames: [],
              timeLabel: m.shift_start || m.shift_end ? `${m.shift_start?.slice(0, 5) ?? "—"} – ${m.shift_end?.slice(0, 5) ?? "—"}` : null,
            });
          }
          const group = maintGroupsForDay.get(m.maintenance_call_id)!;
          group.count++;
          if (!group.staffNames.includes(m.employee_name)) group.staffNames.push(m.employee_name);
        }

        return (
          <div className="space-y-3">
            <ScheduleTaskSummary
              date={selectedDay}
              projects={projectsWithAssignments}
              onSelectProject={(pid) => setExpandedProjectId(pid)}
              onCopyProject={canCreate ? (pid, pName) => {
                const next = new Date(selectedDay! + "T00:00:00");
                next.setDate(next.getDate() + 1);
                setCopyProjectTargetDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`);
                setCopyProjectDialog({ projectId: pid, projectName: pName, sourceDate: selectedDay! });
              } : undefined}
            />
            {dm.length > 0 && (
              <Card className="glass-card border-status-overtime/20">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-status-overtime flex items-center gap-2 mb-3">
                    <Wrench className="h-4 w-4" /> Maintenance Calls
                  </h3>
                  <div className="space-y-2">
                    {[...maintGroupsForDay.values()].map((mg) => (
                      <div
                        key={mg.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 p-2.5 hover:border-status-overtime/40 transition-colors"
                      >
                        <div className="cursor-pointer flex-1" onClick={() => navigate(`/maintenance/${mg.id}`)}>
                          <p className="text-sm font-medium text-foreground">{mg.company_name}</p>
                          {mg.scope && <p className="text-xs text-foreground/80">{mg.scope}</p>}
                          {mg.timeLabel && <p className="text-xs text-muted-foreground">{mg.timeLabel}</p>}
                          {mg.location && <p className="text-xs text-muted-foreground">{mg.location}</p>}
                          {mg.staffNames.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">Staff: {mg.staffNames.join(", ")}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-status-overtime/30 text-status-overtime">
                            {mg.count} staff
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] gap-1 border-status-overtime/30 text-status-overtime hover:bg-status-overtime/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCopyMaintDialog({ callId: mg.id, companyName: mg.company_name, sourceDate: selectedDay! });
                              // Default target to next day
                              const next = new Date(selectedDay! + "T00:00:00");
                              next.setDate(next.getDate() + 1);
                              setCopyMaintTargetDate(toLocalDateStr(next));
                            }}
                          >
                            <Copy className="h-3 w-3" /> Copy to Date
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      })()}

      {selectedDay && selectedProjectId === "all" && expandedProjectId && (() => {
        const ep = activeProjects.find((p) => p.id === expandedProjectId);
        if (!ep) return null;
        return (
          <div className="space-y-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setExpandedProjectId(null)}>
              ← Back to task summary
            </Button>
            <DayAssignmentPanel
              date={selectedDay}
              projectId={ep.id}
              projectName={ep.name}
              assignments={dayAssignments(selectedDay).filter((a) => a.project_id === ep.id)}
              requiredTech={(ep as any).required_team_members ?? ep.required_technicians + ep.required_helpers}
              requiredHelp={0}
              requiredSup={ep.required_supervisors}
              requiredDrivers={(ep as any).required_drivers ?? 0}
              conflicts={dayConflicts(selectedDay).filter((c) => c.projects.includes(ep.name))}
              readOnly={!canEdit}
            />
          </div>
        );
      })()}

      {!selectedDay && selectedProjectId !== "all" && selectedProject && (
        <DayAssignmentPanel
          date={today}
          projectId={selectedProjectId}
          projectName={selectedProject.name}
          assignments={dayAssignments(today).filter((a) => a.project_id === selectedProjectId)}
          requiredTech={(selectedProject as any).required_team_members ?? selectedProject.required_technicians + selectedProject.required_helpers}
          requiredHelp={0}
          requiredSup={selectedProject.required_supervisors}
          requiredDrivers={(selectedProject as any).required_drivers ?? 0}
          conflicts={dayConflicts(today)}
          readOnly={!canEdit}
        />
      )}

      {!selectedDay && selectedProjectId === "all" && (
        <div className="text-center py-8">
          <CalendarDays className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Click a day to view and manage assignments</p>
        </div>
      )}

      {/* Copy from Previous Week Dialog */}
      <Dialog open={bulkDialog === "copy"} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5" />Copy from Previous Week</DialogTitle>
            <DialogDescription>
              Copy all assignments from <strong>{prevWeekLabel}</strong> to current week <strong>{weekLabel}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This will duplicate {selectedProjectId !== "all" ? "selected project's" : "all"} assignments from last week into the current week.
            </p>
            <div className="rounded-lg border border-border p-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">Source: <span className="text-foreground font-medium">{prevWeekLabel}</span></p>
              <p className="text-xs text-muted-foreground mt-1">Target: <span className="text-foreground font-medium">{weekLabel}</span></p>
              {selectedProjectId !== "all" && (
                <p className="text-xs text-muted-foreground mt-1">Project: <span className="text-foreground font-medium">{selectedProject?.name}</span></p>
              )}
            </div>
            <p className="text-xs text-amber-400">⚠ Existing assignments on target dates will not be removed. Duplicates may occur.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={handleCopyWeek} disabled={copyWeek.isPending}>
              {copyWeek.isPending ? "Copying…" : "Copy Week"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply to Date Range Dialog */}
      <Dialog open={bulkDialog === "apply"} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />Apply to Date Range</DialogTitle>
            <DialogDescription>
              Copy {selectedDay && new Date(selectedDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}'s assignments to a range of dates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <DateInput value={rangeStart} onChange={setRangeStart} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <DateInput value={rangeEnd} onChange={setRangeEnd} className="mt-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="skip-weekends" checked={skipWeekends} onCheckedChange={setSkipWeekends} />
              <Label htmlFor="skip-weekends" className="text-sm">Skip weekends (Sat/Sun)</Label>
            </div>
            {selectedProjectId !== "all" && (
              <p className="text-xs text-muted-foreground">Project: <span className="text-foreground font-medium">{selectedProject?.name}</span></p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={handleApplyRange} disabled={applyRange.isPending}>
              {applyRange.isPending ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Schedule Dialog */}
      <Dialog open={bulkDialog === "recurring"} onOpenChange={(v) => { if (!v) setBulkDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5" />Recurring Schedule</DialogTitle>
            <DialogDescription>
              Repeat this week's schedule ({weekLabel}) for multiple upcoming weeks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Number of weeks to repeat</Label>
              <Select value={String(recurWeeks)} onValueChange={(v) => setRecurWeeks(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 6, 8, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} week{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
              <p>Source: <span className="text-foreground font-medium">{weekLabel}</span></p>
              <p>Will create assignments for the next <span className="text-foreground font-medium">{recurWeeks}</span> week{recurWeeks > 1 ? "s" : ""}</p>
              {selectedProjectId !== "all" && (
                <p>Project: <span className="text-foreground font-medium">{selectedProject?.name}</span></p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={handleRecurring} disabled={recurring.isPending}>
              {recurring.isPending ? "Creating…" : "Create Recurring"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Copy Maintenance Assignments Dialog */}
      <Dialog open={!!copyMaintDialog} onOpenChange={(v) => { if (!v) setCopyMaintDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Wrench className="h-5 w-5 text-status-overtime" />Copy Maintenance Staff</DialogTitle>
            <DialogDescription>
              Copy all staff assignments from <strong>{copyMaintDialog?.companyName}</strong> to another date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 bg-muted/20 text-xs text-muted-foreground space-y-1">
              <p>Source date: <span className="text-foreground font-medium">
                {copyMaintDialog?.sourceDate && new Date(copyMaintDialog.sourceDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}
              </span></p>
              <p>Company: <span className="text-foreground font-medium">{copyMaintDialog?.companyName}</span></p>
            </div>
            <div>
              <Label className="text-xs">Target Date</Label>
              <DateInput value={copyMaintTargetDate} onChange={setCopyMaintTargetDate} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyMaintDialog(null)}>Cancel</Button>
            <Button
              disabled={copyMaint.isPending || !copyMaintTargetDate}
              onClick={async () => {
                if (!copyMaintDialog) return;
                try {
                  const count = await copyMaint.mutateAsync({
                    maintenanceCallId: copyMaintDialog.callId,
                    sourceDate: copyMaintDialog.sourceDate,
                    targetDate: copyMaintTargetDate,
                  });
                  toast.success(`Copied ${count} staff to ${new Date(copyMaintTargetDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
                  setCopyMaintDialog(null);
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {copyMaint.isPending ? "Copying…" : "Copy Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Copy Project Assignments Dialog */}
      <Dialog open={!!copyProjectDialog} onOpenChange={(v) => { if (!v) setCopyProjectDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Copy className="h-5 w-5 text-brand" />Copy Project Schedule</DialogTitle>
            <DialogDescription>
              Copy all assignments for <strong>{copyProjectDialog?.projectName}</strong> from{" "}
              <strong>{copyProjectDialog?.sourceDate && new Date(copyProjectDialog.sourceDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</strong>{" "}
              to another date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Target Date</Label>
              <DateInput value={copyProjectTargetDate} onChange={setCopyProjectTargetDate} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyProjectDialog(null)}>Cancel</Button>
            <Button
              disabled={applyRange.isPending || !copyProjectTargetDate || !copyProjectDialog}
              onClick={async () => {
                if (!copyProjectDialog) return;
                try {
                  const count = await applyRange.mutateAsync({
                    sourceDate: copyProjectDialog.sourceDate,
                    startDate: copyProjectTargetDate,
                    endDate: copyProjectTargetDate,
                    projectId: copyProjectDialog.projectId,
                    skipWeekends: false,
                  });
                  toast.success(`Copied ${count} assignments to ${new Date(copyProjectTargetDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
                  setCopyProjectDialog(null);
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {applyRange.isPending ? "Copying…" : "Copy Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
