import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useAvailableEmployees,
  useAddAssignment,
  useRemoveAssignment,
  useToggleLock,
  type ScheduleAssignment,
} from "@/hooks/useSchedule";
import { Lock, LockOpen, Plus, Trash2, AlertTriangle, Zap, User, Clock, Timer } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  date: string;
  projectId: string;
  projectName: string;
  assignments: ScheduleAssignment[];
  requiredTech: number;
  requiredHelp: number;
  requiredSup: number;
  conflicts: { employee_id: string; employee_name: string; projects: string[] }[];
}

const skillColors: Record<string, string> = {
  technician: "bg-brand/15 text-brand border-brand/30",
  helper: "bg-status-traveling/15 text-status-traveling border-status-traveling/30",
  supervisor: "bg-status-overtime/15 text-status-overtime border-status-overtime/30",
};

export function DayAssignmentPanel({
  date,
  projectId,
  projectName,
  assignments,
  requiredTech,
  requiredHelp,
  requiredSup,
  conflicts,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees, isLoading: empLoading } = useAvailableEmployees(date, projectId);
  const addAssignment = useAddAssignment();
  const removeAssignment = useRemoveAssignment();
  const toggleLock = useToggleLock();
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [autoShiftStart, setAutoShiftStart] = useState("08:00");
  const [autoShiftEnd, setAutoShiftEnd] = useState("17:00");
  const [autoLoading, setAutoLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const techCount = assignments.filter((a) => a.employee_skill === "technician").length;
  const helpCount = assignments.filter((a) => a.employee_skill === "helper").length;
  const supCount = assignments.filter((a) => a.employee_skill === "supervisor").length;

  const needTech = Math.max(0, requiredTech - techCount);
  const needHelp = Math.max(0, requiredHelp - helpCount);
  const needSup = Math.max(0, requiredSup - supCount);
  const totalToFill = needTech + needHelp + needSup;

  const handleAdd = async (employeeId: string) => {
    try {
      await addAssignment.mutateAsync({
        project_id: projectId,
        employee_id: employeeId,
        date,
        shift_start: shiftStart,
        shift_end: shiftEnd,
      });
      toast({ title: "Employee assigned" });
      setAddingSkill(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeAssignment.mutateAsync(id);
      toast({ title: "Assignment removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAutoAssign = async () => {
    setAutoLoading(true);
    try {
      const lockedIds = assignments.filter((a) => a.is_locked).map((a) => a.employee_id);
      const { data, error } = await supabase.functions.invoke("auto-assign", {
        body: {
          projectId,
          date,
          requiredByRole: {
            technicians: requiredTech,
            helpers: requiredHelp,
            supervisors: requiredSup,
          },
          lockedEmployeeIds: lockedIds,
          shiftStart: autoShiftStart,
          shiftEnd: autoShiftEnd,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      queryClient.invalidateQueries({ queryKey: ["schedule-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["available-employees"] });
      toast({ title: "Auto-assign complete", description: `${data.assigned?.length ?? 0} employees assigned` });
    } catch (e: any) {
      toast({ title: "Auto-assign failed", description: e.message, variant: "destructive" });
    } finally {
      setAutoLoading(false);
    }
  };

  const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

  const availableForSkill = (skill: string) =>
    (employees ?? []).filter((e) => e.skill_type === skill && e.available);

  const formatTime = (t: string | null) => t ? t.slice(0, 5) : "";

  // Live countdown ticker
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const getCountdown = (shiftStart: string | null, shiftEnd: string | null) => {
    const start = shiftStart?.slice(0, 5) || "08:00";
    const end = shiftEnd?.slice(0, 5) || "17:00";
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);

    const shiftDate = new Date(date + "T00:00:00");
    const startMs = new Date(shiftDate).setHours(sh, sm, 0, 0);
    const endMs = new Date(shiftDate).setHours(eh, em, 0, 0);
    const nowMs = now.getTime();

    if (nowMs < startMs) {
      const diff = startMs - nowMs;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return { label: `Starts in ${h}h ${m}m`, status: "upcoming" as const };
    }
    if (nowMs >= startMs && nowMs < endMs) {
      const diff = endMs - nowMs;
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return { label: `${h}h ${m}m left`, status: "active" as const };
    }
    return { label: "Completed", status: "done" as const };
  };

  const countdownColor = { upcoming: "text-status-planned", active: "text-status-present", done: "text-muted-foreground" };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">{dayLabel}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{projectName}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)} disabled={autoLoading || totalToFill === 0}>
            <Zap className="h-3.5 w-3.5 mr-1" />
            {autoLoading ? "Assigning…" : "Auto-fill"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Staffing summary */}
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className={techCount >= requiredTech ? "border-status-present/50" : "border-status-absent/50"}>
            Tech: {techCount}/{requiredTech}
          </Badge>
          <Badge variant="outline" className={helpCount >= requiredHelp ? "border-status-present/50" : "border-status-absent/50"}>
            Help: {helpCount}/{requiredHelp}
          </Badge>
          <Badge variant="outline" className={supCount >= requiredSup ? "border-status-present/50" : "border-status-absent/50"}>
            Sup: {supCount}/{requiredSup}
          </Badge>
        </div>

        {/* Conflicts */}
        {conflicts.length > 0 && (
          <div className="rounded-lg bg-status-absent/10 border border-status-absent/30 p-2.5 space-y-1">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-status-absent">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>{c.employee_name} assigned to: {c.projects.join(", ")}</span>
              </div>
            ))}
          </div>
        )}

        {/* Assigned list */}
        <div className="space-y-1.5">
          {assignments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No assignments for this day</p>
          )}
          {assignments.map((a) => {
            const countdown = getCountdown(a.shift_start, a.shift_end);
            return (
            <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1 truncate">{a.employee_name}</span>
              <span className={`text-[9px] flex items-center gap-0.5 ${countdownColor[countdown.status]}`}>
                <Timer className="h-2.5 w-2.5" />
                {countdown.label}
              </span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {formatTime(a.shift_start) || "08:00"}–{formatTime(a.shift_end) || "17:00"}
              </span>
              <Badge variant="outline" className={`text-[10px] ${skillColors[a.employee_skill] ?? ""}`}>
                {a.employee_skill}
              </Badge>
              {a.assignment_mode !== "manual" && (
                <Badge variant="secondary" className="text-[10px]">{a.assignment_mode}</Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => toggleLock.mutate({ id: a.id, is_locked: !a.is_locked })}
              >
                {a.is_locked ? <Lock className="h-3 w-3 text-brand" /> : <LockOpen className="h-3 w-3 text-muted-foreground" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => handleRemove(a.id)}
                disabled={a.is_locked}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            );
          })}
        </div>

        {/* Add employee */}
        {addingSkill ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Add {addingSkill}:</p>
            {/* Shift time inputs */}
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                type="time"
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value)}
                className="h-7 text-xs w-24"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="time"
                value={shiftEnd}
                onChange={(e) => setShiftEnd(e.target.value)}
                className="h-7 text-xs w-24"
              />
            </div>
            {empLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : availableForSkill(addingSkill).length === 0 ? (
              <p className="text-xs text-muted-foreground">No available {addingSkill}s</p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {availableForSkill(addingSkill).map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                    onClick={() => handleAdd(e.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span>{e.name}</span>
                      {e.assigned_elsewhere && (
                        <Badge variant="outline" className="text-[9px] border-status-traveling/50 text-status-traveling">
                          on other project
                        </Badge>
                      )}
                    </div>
                    {e.existing_slots && e.existing_slots.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {e.existing_slots.map((slot: { start: string; end: string; project: string }, i: number) => (
                          <span key={i} className="text-[9px] text-status-traveling bg-status-traveling/10 rounded px-1.5 py-0.5">
                            {slot.start}–{slot.end} ({slot.project})
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setAddingSkill(null)}>Cancel</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            {(["technician", "helper", "supervisor"] as const).map((skill) => (
              <Button key={skill} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setAddingSkill(skill)}>
                <Plus className="h-3 w-3 mr-1" /> {skill.charAt(0).toUpperCase() + skill.slice(1, 4)}
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      {/* Auto-fill confirmation with shift time */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auto-fill assignments?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>The engine will assign up to <strong>{totalToFill}</strong> employees for <strong>{projectName}</strong> on {new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {needTech > 0 && <li>{needTech} technician{needTech > 1 ? "s" : ""}</li>}
                  {needHelp > 0 && <li>{needHelp} helper{needHelp > 1 ? "s" : ""}</li>}
                  {needSup > 0 && <li>{needSup} supervisor{needSup > 1 ? "s" : ""}</li>}
                </ul>
                {/* Shift time for auto-fill */}
                <div className="flex items-center gap-2 pt-1">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm">Shift:</span>
                  <Input
                    type="time"
                    value={autoShiftStart}
                    onChange={(e) => setAutoShiftStart(e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    value={autoShiftEnd}
                    onChange={(e) => setAutoShiftEnd(e.target.value)}
                    className="h-8 text-sm w-28"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Locked employees will be kept. Scoring considers utilization balance, hours, and recency.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); handleAutoAssign(); }}>
              <Zap className="h-3.5 w-3.5 mr-1" /> Assign {totalToFill} employees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}