import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import {
  useWeekAssignments, useDetectConflicts,
  useCopyPreviousWeek, useApplyToDateRange, useRecurringSchedule,
} from "@/hooks/useSchedule";
import { DayAssignmentPanel } from "@/components/schedule/DayAssignmentPanel";
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
  Copy, CalendarRange, Repeat, MoreVertical,
} from "lucide-react";

function getWeekDates(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type BulkDialog = "copy" | "apply" | "recurring" | null;

export default function Schedule() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [bulkDialog, setBulkDialog] = useState<BulkDialog>(null);

  // Apply-to-range state
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [skipWeekends, setSkipWeekends] = useState(true);

  // Recurring state
  const [recurWeeks, setRecurWeeks] = useState(4);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const prevWeekDates = useMemo(() => getWeekDates(weekOffset - 1), [weekOffset]);
  const prevWeekStart = prevWeekDates[0];
  const prevWeekEnd = prevWeekDates[6];

  const { data: projects } = useProjects({ status: "all" });
  const activeProjects = (projects ?? []).filter((p) => ["assigned", "in_progress"].includes(p.status));
  const { data: assignments, isLoading } = useWeekAssignments(weekStart, weekEnd, selectedProjectId);
  const conflicts = useDetectConflicts(assignments ?? []);

  const selectedProject = activeProjects.find((p) => p.id === selectedProjectId);
  const today = new Date().toISOString().split("T")[0];

  const copyWeek = useCopyPreviousWeek();
  const applyRange = useApplyToDateRange();
  const recurring = useRecurringSchedule();

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

          <Select value={selectedProjectId} onValueChange={(v) => { setSelectedProjectId(v); setSelectedDay(null); }}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>Today</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)}>
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
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, i) => {
            const da = dayAssignments(date);
            const dc = dayConflicts(date);
            const isToday = date === today;
            const isSelected = date === selectedDay;
            const isFriday = i === 4;

            const projectGroups = new Map<string, number>();
            for (const a of da) projectGroups.set(a.project_name, (projectGroups.get(a.project_name) ?? 0) + 1);

            return (
              <Card
                key={date}
                className={`cursor-pointer transition-all hover:border-brand/40 ${
                  isSelected ? "border-brand ring-1 ring-brand/30" : ""
                } ${isToday ? "bg-brand/5" : ""} ${isFriday ? "bg-muted/30" : ""}`}
                onClick={() => setSelectedDay(date === selectedDay ? null : date)}
              >
                <CardContent className="p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${isToday ? "text-brand" : "text-muted-foreground"}`}>
                      {dayNames[i]}
                    </span>
                    <span className={`text-xs font-mono ${isToday ? "text-brand font-bold" : "text-foreground"}`}>
                      {new Date(date + "T00:00:00").getDate()}
                    </span>
                  </div>
                  <div className="space-y-1 min-h-[60px]">
                    {da.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center pt-4">No assignments</p>
                    ) : (
                      [...projectGroups].map(([name, count]) => (
                        <div key={name} className="flex items-center gap-1 text-[10px]">
                          <Users className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                          <span className="truncate text-foreground">{name}</span>
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto">{count}</Badge>
                        </div>
                      ))
                    )}
                  </div>
                  {dc.length > 0 && (
                    <div className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-status-absent" />
                      <span className="text-[10px] text-status-absent">{dc.length} conflict{dc.length > 1 ? "s" : ""}</span>
                    </div>
                  )}
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
          requiredTech={selectedProject.required_technicians}
          requiredHelp={selectedProject.required_helpers}
          requiredSup={selectedProject.required_supervisors}
          conflicts={dayConflicts(selectedDay)}
        />
      )}

      {selectedDay && selectedProjectId === "all" && (
        <div className="space-y-4">
          {activeProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active projects</p>
          ) : (
            activeProjects
              .filter((p) => dayAssignments(selectedDay).some((a) => a.project_id === p.id) || true)
              .slice(0, 5)
              .map((p) => (
                <DayAssignmentPanel
                  key={p.id}
                  date={selectedDay}
                  projectId={p.id}
                  projectName={p.name}
                  assignments={dayAssignments(selectedDay).filter((a) => a.project_id === p.id)}
                  requiredTech={p.required_technicians}
                  requiredHelp={p.required_helpers}
                  requiredSup={p.required_supervisors}
                  conflicts={dayConflicts(selectedDay).filter((c) =>
                    c.projects.includes(p.name)
                  )}
                />
              ))
          )}
        </div>
      )}

      {!selectedDay && (
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
                <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="mt-1" />
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
    </div>
  );
}
