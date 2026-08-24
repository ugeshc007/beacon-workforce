import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CalendarClock, XCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { invokeEdge } from "@/lib/invoke-edge";
import type { TodayProject } from "@/hooks/useTodayProjects";

interface Props {
  open: boolean;
  tasks: TodayProject[];
  employeeId: string;
  /** Called when the employee is done deciding and wants to punch out. */
  onContinue: () => void;
  onOpenChange: (open: boolean) => void;
  /** Refresh today's list after a task is cancelled / postponed. */
  onResolved: () => void;
}

export function UnstartedTasksDialog({ open, tasks, employeeId, onContinue, onOpenChange, onResolved }: Props) {
  const { toast } = useToast();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, "cancel" | "postpone">>({});

  const resolve = async (task: TodayProject, action: "cancel" | "postpone") => {
    setBusyId(task.assignmentId);
    try {
      await invokeEdge("resolve-unstarted-assignment", {
        employee_id: employeeId,
        assignment_id: task.assignmentId,
        action,
        reason: reasons[task.assignmentId]?.trim() || undefined,
      });
      setResolved((r) => ({ ...r, [task.assignmentId]: action }));
      toast({
        title: action === "cancel" ? "Task cancelled" : "Moved to tomorrow",
        description:
          action === "cancel"
            ? `${task.projectName} was cancelled for today. Your supervisor has been notified.`
            : `${task.projectName} is now scheduled for tomorrow.`,
      });
      onResolved();
    } catch (err) {
      toast({
        title: "Could not update the schedule",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const pending = tasks.filter((t) => !resolved[t.assignmentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tasks not started</DialogTitle>
          <DialogDescription>
            You have {tasks.length} scheduled {tasks.length === 1 ? "task" : "tasks"} you didn't start today. Cancel
            them or move them to tomorrow — then punch out.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[45vh] overflow-y-auto">
          {tasks.map((t) => {
            const done = resolved[t.assignmentId];
            return (
              <div key={t.assignmentId} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.projectName}</p>
                    {(t.shiftStart || t.task) && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[t.shiftStart?.slice(0, 5), t.task].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  {done && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {done === "cancel" ? "Cancelled" : "Tomorrow"}
                    </span>
                  )}
                </div>

                {!done && (
                  <>
                    <Textarea
                      value={reasons[t.assignmentId] ?? ""}
                      onChange={(e) => setReasons((r) => ({ ...r, [t.assignmentId]: e.target.value }))}
                      placeholder="Reason (optional)"
                      rows={2}
                      className="mt-2 text-sm"
                    />
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === t.assignmentId}
                        onClick={() => resolve(t, "postpone")}
                      >
                        {busyId === t.assignmentId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CalendarClock className="h-4 w-4" />
                        )}
                        Tomorrow
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === t.assignmentId}
                        onClick={() => resolve(t, "cancel")}
                      >
                        <XCircle className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <Button onClick={onContinue}>
            {pending.length ? "Punch out anyway" : "Punch out"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Not yet — go back
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
