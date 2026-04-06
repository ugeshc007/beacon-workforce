import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  useAvailableEmployees,
  useAddAssignment,
  useRemoveAssignment,
  useToggleLock,
  type ScheduleAssignment,
} from "@/hooks/useSchedule";
import { Lock, LockOpen, Plus, Trash2, AlertTriangle, Zap, User } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
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
  const { data: employees, isLoading: empLoading } = useAvailableEmployees(date, projectId);
  const addAssignment = useAddAssignment();
  const removeAssignment = useRemoveAssignment();
  const toggleLock = useToggleLock();
  const [addingSkill, setAddingSkill] = useState<string | null>(null);
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
      await addAssignment.mutateAsync({ project_id: projectId, employee_id: employeeId, date });
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
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
          {assignments.map((a) => (
            <div key={a.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 transition-colors group">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1 truncate">{a.employee_name}</span>
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
          ))}
        </div>

        {/* Add employee */}
        {addingSkill ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Add {addingSkill}:</p>
            {empLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : availableForSkill(addingSkill).length === 0 ? (
              <p className="text-xs text-muted-foreground">No available {addingSkill}s</p>
            ) : (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {availableForSkill(addingSkill).map((e) => (
                  <button
                    key={e.id}
                    className="w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                    onClick={() => handleAdd(e.id)}
                  >
                    {e.name}
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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Auto-fill assignments?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>The engine will assign up to <strong>{totalToFill}</strong> employees for <strong>{projectName}</strong> on {new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}:</p>
                <ul className="list-disc pl-5 space-y-0.5 text-sm">
                  {needTech > 0 && <li>{needTech} technician{needTech > 1 ? "s" : ""}</li>}
                  {needHelp > 0 && <li>{needHelp} helper{needHelp > 1 ? "s" : ""}</li>}
                  {needSup > 0 && <li>{needSup} supervisor{needSup > 1 ? "s" : ""}</li>}
                </ul>
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
