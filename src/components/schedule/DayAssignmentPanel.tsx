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
  useUpdateAssignment,
  useReassignEmployee,
  type ScheduleAssignment,
} from "@/hooks/useSchedule";
import { useProjects } from "@/hooks/useProjects";
import { useDailyLogs, useCreateDailyLog, type DailyLogStatus } from "@/hooks/useDailyLogs";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Lock, LockOpen, Plus, Trash2, AlertTriangle, Zap, User, Clock, Timer, Pencil, ArrowRightLeft, Check, X, Shield, Users, Share2, Copy, MessageCircle, FileText } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";

interface Props {
  date: string;
  projectId: string;
  projectName: string;
  assignments: ScheduleAssignment[];
  requiredTech: number;
  requiredHelp: number;
  requiredSup: number;
  requiredDrivers?: number;
  conflicts: { employee_id: string; employee_name: string; projects: string[] }[];
  readOnly?: boolean;
}

const skillColors: Record<string, string> = {
  team_member: "bg-brand/15 text-brand border-brand/30",
  team_leader: "bg-status-overtime/15 text-status-overtime border-status-overtime/30",
  driver: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

export function DayAssignmentPanel({
  date,
  projectId,
  projectName,
  assignments,
  requiredTech,
  requiredHelp,
  requiredSup,
  requiredDrivers = 0,
  conflicts,
  readOnly = false,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: employees, isLoading: empLoading } = useAvailableEmployees(date, projectId);
  const addAssignment = useAddAssignment();
  const removeAssignment = useRemoveAssignment();
  const toggleLock = useToggleLock();
  const updateAssignment = useUpdateAssignment();
  const reassignEmployee = useReassignEmployee();
  const { data: allProjects } = useProjects({ status: "all" });
  const activeProjects = (allProjects ?? []).filter((p) => ["on_hold", "in_progress"].includes(p.status) && p.id !== projectId);
  const { data: dailyLogs } = useDailyLogs(projectId);
  const currentProject = (allProjects ?? []).find(p => p.id === projectId);

  const [addingSkill, setAddingSkill] = useState<string | null>(null);
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [autoShiftStart, setAutoShiftStart] = useState("08:00");
  const [autoShiftEnd, setAutoShiftEnd] = useState("17:00");
  const [autoLoading, setAutoLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Daily log quick entry
  const { user } = useAuth();
  const createDailyLog = useCreateDailyLog();
  const [logOpen, setLogOpen] = useState(false);
  const [logDescription, setLogDescription] = useState("");
  const [logStatus, setLogStatus] = useState<DailyLogStatus>("in_progress");
  const [logCompletion, setLogCompletion] = useState("");
  const [logIssues, setLogIssues] = useState("");
  const [logTaskStart, setLogTaskStart] = useState("");
  const [logTaskEnd, setLogTaskEnd] = useState("");

  const resetLogForm = () => {
    setLogDescription("");
    setLogStatus("in_progress");
    setLogCompletion("");
    setLogIssues("");
    setLogTaskStart("");
    setLogTaskEnd("");
  };

  const handleSubmitLog = async () => {
    if (!logDescription.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    try {
      await createDailyLog.mutateAsync({
        project_id: projectId,
        date,
        description: logDescription.trim(),
        status: logStatus,
        completion_pct: logCompletion ? parseInt(logCompletion) : null,
        issues: logIssues.trim() || null,
        posted_by: user?.id ?? null,
        task_start_date: logTaskStart || null,
        task_end_date: logTaskEnd || null,
      });
      toast({ title: "Daily log posted" });
      resetLogForm();
      setLogOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  // Edit time state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Reassign state
  const [reassignId, setReassignId] = useState<string | null>(null);
  const [reassignEmpId, setReassignEmpId] = useState("");
  const [reassignEmpName, setReassignEmpName] = useState("");
  const [reassignProject, setReassignProject] = useState("");
  const [reassignStart, setReassignStart] = useState("");
  const [reassignEnd, setReassignEnd] = useState("17:00");
  const [reassignKeepOld, setReassignKeepOld] = useState(true);
  const [reassignOldEnd, setReassignOldEnd] = useState("");

  const memberCount = assignments.filter((a) => a.assigned_role === "team_member").length;
  const tlCount = assignments.filter((a) => a.assigned_role === "team_leader").length;
  const driverCount = assignments.filter((a) => a.assigned_role === "driver").length;

  const needMembers = Math.max(0, requiredTech - memberCount);
  const needTL = Math.max(0, requiredSup - tlCount);
  const needDrivers = Math.max(0, requiredDrivers - driverCount);
  const totalToFill = needMembers + needTL + needDrivers;

  const handleAdd = async (employeeId: string) => {
    try {
      await addAssignment.mutateAsync({
        project_id: projectId,
        employee_id: employeeId,
        date,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        assigned_role: addingSkill ?? "team_member",
      });
      toast({ title: "Employee assigned" });
      setAddingSkill(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleEditTime = (a: ScheduleAssignment) => {
    setEditingId(a.id);
    setEditStart(formatTime(a.shift_start) || "08:00");
    setEditEnd(formatTime(a.shift_end) || "17:00");
  };

  const handleSaveTime = async () => {
    if (!editingId) return;
    try {
      await updateAssignment.mutateAsync({ id: editingId, shift_start: editStart, shift_end: editEnd });
      toast({ title: "Shift time updated" });
      setEditingId(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openReassign = (a: ScheduleAssignment) => {
    setReassignId(a.id);
    setReassignEmpId(a.employee_id);
    setReassignEmpName(a.employee_name);
    const currentEnd = formatTime(a.shift_end) || "17:00";
    const currentStart = formatTime(a.shift_start) || "08:00";
    // Default: split at midpoint
    const [sh, sm] = currentStart.split(":").map(Number);
    const [eh, em] = currentEnd.split(":").map(Number);
    const midMin = Math.round((sh * 60 + sm + eh * 60 + em) / 2);
    const midH = String(Math.floor(midMin / 60)).padStart(2, "0");
    const midM = String(midMin % 60).padStart(2, "0");
    const mid = `${midH}:${midM}`;
    setReassignOldEnd(mid);
    setReassignStart(mid);
    setReassignEnd(currentEnd);
    setReassignKeepOld(true);
    setReassignProject("");
  };

  const handleReassign = async () => {
    if (!reassignId || !reassignProject) return;
    try {
      await reassignEmployee.mutateAsync({
        oldAssignmentId: reassignId,
        newProjectId: reassignProject,
        employeeId: reassignEmpId,
        date,
        shiftStart: reassignStart,
        shiftEnd: reassignEnd,
        keepOld: reassignKeepOld,
        oldShiftEnd: reassignKeepOld ? reassignOldEnd : undefined,
      });
      toast({ title: reassignKeepOld ? "Employee split across projects" : "Employee reassigned" });
      setReassignId(null);
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
      const count = data.assigned?.length ?? 0;
      const reason = data.reason;
      const doubleBooked = (data.assigned ?? []).filter((a: any) => a.doubleBooked);

      if (count === 0) {
        toast({ title: "No employees assigned", description: reason || "No eligible employees available", variant: "destructive" });
      } else if (doubleBooked.length > 0) {
        const names = doubleBooked.map((a: any) => `${a.name} (also on ${a.otherProjects?.join(", ")})`).join("; ");
        toast({ title: `${count} assigned — with conflicts`, description: `⚠️ Double-booked: ${names}${reason ? `. ${reason}` : ""}`, variant: "destructive" });
      } else {
        toast({ title: "Auto-assign complete", description: `${count} employees assigned${reason ? `. ${reason}` : ""}` });
      }
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
    (employees ?? []).filter((e) => {
      if (e.on_leave) return false;
      // Check if already assigned to this role for this project
      const alreadyInRole = assignments.some(a => a.employee_id === e.id && a.assigned_role === skill);
      if (alreadyInRole) return false;
      const matchesSkill = e.skill_type === skill || ((e as any).secondary_skills ?? []).includes(skill);
      return matchesSkill;
    });

  /** Check if selected shift overlaps with any existing slot */
  const hasOverlap = (slots: { start: string; end: string; project: string }[]) => {
    if (!slots.length) return false;
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const newStart = toMin(shiftStart);
    const newEnd = toMin(shiftEnd);
    return slots.some((s) => {
      const sStart = toMin(s.start);
      const sEnd = toMin(s.end);
      return newStart < sEnd && newEnd > sStart;
    });
  };

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

  const formatShareText = useCallback(() => {
    const lines: string[] = [];
    lines.push(`📋 *Schedule: ${projectName}*`);
    lines.push(`📅 ${dayLabel}`);
    if (currentProject?.site_address) lines.push(`📍 Location: ${currentProject.site_address}`);

    // Daily logs as "Task"
    const logsForDate = (dailyLogs ?? []).filter(l => l.date === date);
    if (logsForDate.length > 0) {
      lines.push("");
      lines.push("📝 *Task:*");
      logsForDate.forEach(l => {
        const statusLabel = l.status === "completed" ? "✅" : l.status === "in_progress" ? "🔄" : l.status === "on_hold" ? "⏸️" : "⏳";
        lines.push(`  ${statusLabel} ${l.description}${l.completion_pct !== null ? ` (${l.completion_pct}%)` : ""}${l.issues ? ` ⚠️ ${l.issues}` : ""}`);
      });
    }
    lines.push("");

    const members = assignments.filter(a => a.assigned_role === "team_member");
    const leaders = assignments.filter(a => a.assigned_role === "team_leader");
    const drivers = assignments.filter(a => a.assigned_role === "driver");

    if (members.length > 0) {
      lines.push("👷 *Team Members:*");
      members.forEach(a => lines.push(`  • ${a.employee_name} (${formatTime(a.shift_start) || "08:00"}–${formatTime(a.shift_end) || "17:00"})`));
    }
    if (leaders.length > 0) {
      lines.push("🛡️ *Team Leaders:*");
      leaders.forEach(a => lines.push(`  • ${a.employee_name} (${formatTime(a.shift_start) || "08:00"}–${formatTime(a.shift_end) || "17:00"})`));
    }
    if (drivers.length > 0) {
      lines.push("🚗 *Drivers:*");
      drivers.forEach(a => lines.push(`  • ${a.employee_name} (${formatTime(a.shift_start) || "08:00"}–${formatTime(a.shift_end) || "17:00"})`));
    }

    if (assignments.length === 0) lines.push("No assignments yet.");

    return lines.join("\n");
  }, [assignments, projectName, dayLabel, dailyLogs, date, currentProject]);

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatShareText());
      sonnerToast.success("Schedule copied to clipboard");
    } catch {
      sonnerToast.error("Failed to copy");
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(formatShareText());
    window.open(`https://wa.me/?text=${text}`, "_blank");
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
          <div className="flex items-center gap-1.5">
            {assignments.length > 0 && (
              <>
                <Button size="sm" variant="ghost" onClick={handleCopyClipboard} title="Copy to clipboard" className="h-8 w-8 p-0">
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button size="sm" variant="ghost" onClick={handleShareWhatsApp} title="Share via WhatsApp" className="h-8 w-8 p-0">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
                </Button>
            </>
            )}
            {!readOnly && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLogOpen(true)}
                title="Add daily log"
                className="h-8 px-2 gap-1 text-brand hover:text-brand"
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="text-xs hidden sm:inline">Log</span>
                {dailyLogs && dailyLogs.length > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px] border-brand/40 text-brand ml-0.5">
                    {dailyLogs.filter(l => l.date === date).length}
                  </Badge>
                )}
              </Button>
            )}
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)} disabled={autoLoading || totalToFill === 0}>
                <Zap className="h-3.5 w-3.5 mr-1" />
                {autoLoading ? "Assigning…" : "Auto-fill"}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Staffing summary */}
        <div className="flex gap-2 text-xs flex-wrap">
          <Badge variant="outline" className={memberCount >= requiredTech ? "border-status-present/50" : "border-status-absent/50"}>
            Team Members: {memberCount}/{requiredTech}
          </Badge>
          <Badge variant="outline" className={tlCount >= requiredSup ? "border-status-present/50" : "border-status-absent/50"}>
            Team Leaders: {tlCount}/{requiredSup}
          </Badge>
          {requiredDrivers > 0 && (
            <Badge variant="outline" className={driverCount >= requiredDrivers ? "border-status-present/50" : "border-status-absent/50"}>
              Drivers: {driverCount}/{requiredDrivers}
            </Badge>
          )}
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
            const isEditing = editingId === a.id;
            return (
            <div key={a.id} className="space-y-1">
              <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group">
                {a.assigned_role === "team_leader" ? (
                  <Shield className="h-3.5 w-3.5 text-status-overtime shrink-0" />
                ) : (
                  <Users className="h-3.5 w-3.5 text-brand shrink-0" />
                )}
                <span className="text-sm flex-1 truncate">{a.employee_name}</span>
                <span className={`text-[9px] flex items-center gap-0.5 ${countdownColor[countdown.status]}`}>
                  <Timer className="h-2.5 w-2.5" />
                  {countdown.label}
                </span>
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} className="h-6 text-[10px] w-20" />
                    <span className="text-[10px] text-muted-foreground">–</span>
                    <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} className="h-6 text-[10px] w-20" />
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-status-present" onClick={handleSaveTime}><Check className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatTime(a.shift_start) || "08:00"}–{formatTime(a.shift_end) || "17:00"}
                  </span>
                )}
                <Badge variant="outline" className={`text-[10px] ${skillColors[a.assigned_role] ?? ""}`}>
                  {a.assigned_role}
                </Badge>
                {a.assignment_mode !== "manual" && (
                  <Badge variant="secondary" className="text-[10px]">{a.assignment_mode}</Badge>
                )}
                {!isEditing && !readOnly && (
                  <>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" title="Edit time"
                      onClick={() => handleEditTime(a)} disabled={a.is_locked}>
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" title="Reassign / Split"
                      onClick={() => openReassign(a)} disabled={a.is_locked}>
                      <ArrowRightLeft className="h-3 w-3 text-brand" />
                    </Button>
                  </>
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={() => toggleLock.mutate({ id: a.id, is_locked: !a.is_locked })}>
                    {a.is_locked ? <Lock className="h-3 w-3 text-brand" /> : <LockOpen className="h-3 w-3 text-muted-foreground" />}
                  </Button>
                )}
                {!readOnly && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => handleRemove(a.id)} disabled={a.is_locked}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            );
          })}
        </div>

        {/* Add employee */}
        {readOnly ? null : addingSkill ? (
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
                    <div className="flex items-center justify-between gap-1">
                      <span>{e.name}</span>
                      <div className="flex items-center gap-1">
                        {e.existing_slots && hasOverlap(e.existing_slots) && (
                          <Badge variant="outline" className="text-[9px] border-status-absent/50 text-status-absent">
                            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />overlap
                          </Badge>
                        )}
                        {e.assigned_elsewhere && !hasOverlap(e.existing_slots ?? []) && (
                          <Badge variant="outline" className="text-[9px] border-status-traveling/50 text-status-traveling">
                            on other project
                          </Badge>
                        )}
                      </div>
                    </div>
                    {e.existing_slots && e.existing_slots.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {e.existing_slots.map((slot: { start: string; end: string; project: string }, i: number) => (
                          <span key={i} className={`text-[9px] rounded px-1.5 py-0.5 ${
                            hasOverlap([slot]) ? "text-status-absent bg-status-absent/10" : "text-status-traveling bg-status-traveling/10"
                          }`}>
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
          <div className="flex gap-2 flex-wrap">
            {(["team_leader", "team_member", "driver"] as const).map((skill) => (
              <Button key={skill} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setAddingSkill(skill)}>
                <Plus className="h-3 w-3 mr-1" /> {skill === "team_member" ? "Team Member" : skill === "team_leader" ? "Team Leader" : "Driver"}
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
                  {needMembers > 0 && <li>{needMembers} team member{needMembers > 1 ? "s" : ""}</li>}
                  {needTL > 0 && <li>{needTL} team leader{needTL > 1 ? "s" : ""}</li>}
                  {needDrivers > 0 && <li>{needDrivers} driver{needDrivers > 1 ? "s" : ""}</li>}
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

      {/* Reassign / Split dialog */}
      <AlertDialog open={!!reassignId} onOpenChange={(open) => { if (!open) setReassignId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign {reassignEmpName}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm">Move to another project or split shift time across sites.</p>

                <div className="space-y-2">
                  <Label className="text-xs">Target Project</Label>
                  <Select value={reassignProject} onValueChange={setReassignProject}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select project" /></SelectTrigger>
                    <SelectContent>
                      {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3">
                  <Switch id="keep-old" checked={reassignKeepOld} onCheckedChange={setReassignKeepOld} />
                  <Label htmlFor="keep-old" className="text-xs">Keep on {projectName} (split shift)</Label>
                </div>

                {reassignKeepOld && (
                  <div className="space-y-1.5 rounded-lg bg-accent/20 p-2.5">
                    <p className="text-xs font-medium">{projectName}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Ends at:</span>
                      <Input type="time" value={reassignOldEnd} onChange={(e) => { setReassignOldEnd(e.target.value); setReassignStart(e.target.value); }} className="h-7 text-xs w-24" />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 rounded-lg bg-brand/5 border border-brand/20 p-2.5">
                  <p className="text-xs font-medium">New project shift</p>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input type="time" value={reassignStart} onChange={(e) => setReassignStart(e.target.value)} className="h-7 text-xs w-24" />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input type="time" value={reassignEnd} onChange={(e) => setReassignEnd(e.target.value)} className="h-7 text-xs w-24" />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassign} disabled={!reassignProject}>
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              {reassignKeepOld ? "Split Shift" : "Reassign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Daily log quick entry */}
      <Dialog open={logOpen} onOpenChange={(o) => { setLogOpen(o); if (!o) resetLogForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              Add Daily Log
            </DialogTitle>
            <p className="text-xs text-muted-foreground">{projectName} · {dayLabel}</p>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <Textarea
              placeholder="What was done? Describe progress…"
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              rows={3}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
                <Select value={logStatus} onValueChange={(v) => setLogStatus(v as DailyLogStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Completion %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 45"
                  value={logCompletion}
                  onChange={(e) => setLogCompletion(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Task Start</Label>
                <Input type="date" value={logTaskStart} onChange={(e) => setLogTaskStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Task End</Label>
                <Input type="date" value={logTaskEnd} onChange={(e) => setLogTaskEnd(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Issues / Blockers</Label>
              <Textarea
                placeholder="Any problems or blockers?"
                value={logIssues}
                onChange={(e) => setLogIssues(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitLog} disabled={createDailyLog.isPending} className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {createDailyLog.isPending ? "Posting…" : "Post Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}