import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import {
  AvailableCommonTask,
  useAvailableCommonTasks,
  useCommonTaskBreak,
  useEndCommonTask,
  useMyCommonTaskSession,
  useStartCommonTask,
} from "@/hooks/useCommonTasks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ListChecks, Users, Play, Square, Coffee, Loader2, WifiOff,
} from "lucide-react";

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

function elapsed(startIso: string | null, breakMinutes: number) {
  if (!startIso) return "0m";
  const mins = Math.max(
    0,
    Math.round((Date.now() - new Date(startIso).getTime()) / 60000) - breakMinutes
  );
  const h = Math.floor(mins / 60);
  return h ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export default function MobileCommonTasks() {
  const navigate = useNavigate();
  const { employee } = useMobileAuth();
  const { attendanceLog } = useMobileWorkflow();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useAvailableCommonTasks(employee?.id);
  const { data: mySession } = useMyCommonTaskSession(employee?.id);
  const start = useStartCommonTask();
  const breakMut = useCommonTaskBreak();
  const end = useEndCommonTask();

  const online = typeof navigator === "undefined" || navigator.onLine !== false;
  const punchedIn = !!attendanceLog?.office_punch_in && !attendanceLog?.office_punch_out;

  const handleStart = async (task: AvailableCommonTask) => {
    if (!employee) return;
    setBusyId(task.id);
    try {
      await start.mutateAsync({
        taskId: task.id,
        employeeId: employee.id,
        attendanceLogId: attendanceLog?.id ?? null,
      });
      toast({ title: `Started · ${task.title}` });
    } catch (err: any) {
      toast({ title: "Could not start", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleBreak = async (action: "start" | "end") => {
    if (!mySession) return;
    setBusyId(mySession.common_task_id);
    try {
      await breakMut.mutateAsync({ sessionId: mySession.id, action });
      toast({ title: action === "start" ? "Break started" : "Break ended" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleEnd = async () => {
    if (!mySession) return;
    setBusyId(mySession.common_task_id);
    try {
      const mins = await end.mutateAsync({ sessionId: mySession.id });
      toast({ title: "Task work ended", description: `${mins} minutes logged.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const onBreak = !!mySession?.break_start_time && !mySession?.break_end_time;

  return (
    <div className="pb-24 safe-area-top">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/50 px-4 py-3 flex items-center gap-3">
        <Button size="icon" variant="ghost" onClick={() => navigate("/m")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-base font-semibold text-foreground">Common Tasks</h1>
          <p className="text-xs text-muted-foreground">Pick a shared in-house task</p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {!online && (
          <Card className="border-status-traveling/30 bg-status-traveling/10">
            <CardContent className="p-3 flex items-center gap-2 text-xs text-status-traveling">
              <WifiOff className="h-4 w-4" /> You're offline — common tasks need a connection.
            </CardContent>
          </Card>
        )}

        {!punchedIn && (
          <Card className="border-border/50 bg-card">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Punch in from the home screen first, then start a common task.
            </CardContent>
          </Card>
        )}

        {/* Active session */}
        {mySession && (
          <Card className="border-brand/40 bg-brand/5">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-brand">Currently working on</p>
                  <p className="font-semibold text-foreground">
                    {mySession.common_tasks?.title ?? "Common task"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Started {fmtTime(mySession.work_start_time)} ·{" "}
                    {elapsed(mySession.work_start_time, mySession.break_minutes ?? 0)}
                    {onBreak && " · on break"}
                  </p>
                </div>
                {onBreak && (
                  <Badge variant="outline" className="bg-status-traveling/15 text-status-traveling border-status-traveling/30">
                    On break
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="ghost"
                  className="h-11 gap-2"
                  onClick={() => handleBreak(onBreak ? "end" : "start")}
                  disabled={!!busyId || !online}
                >
                  <Coffee className="h-4 w-4" />
                  {onBreak ? "End Break" : "Take Break"}
                </Button>
                <Button
                  className="h-11 gap-2"
                  onClick={handleEnd}
                  disabled={!!busyId || !online || onBreak}
                >
                  {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  End Work
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task list */}
        {isLoading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : !tasks?.length ? (
          <Card className="border-border/50 bg-card">
            <CardContent className="p-8 text-center">
              <ListChecks className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No open common tasks right now.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => {
              const isMine = mySession?.common_task_id === task.id;
              const blocked = !punchedIn || !online || !!mySession || task.isFull;
              return (
                <Card
                  key={task.id}
                  className={`border-border/50 bg-card ${isMine ? "border-brand/40" : ""}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {task.activeCount}/{task.max_headcount} on task
                        </span>
                        {task.isFull && (
                          <Badge variant="outline" className="text-[10px]">Full</Badge>
                        )}
                      </div>
                    </div>

                    {isMine ? (
                      <p className="text-xs text-brand font-medium">You're working on this task</p>
                    ) : (
                      <Button
                        className="w-full h-11 gap-2"
                        onClick={() => handleStart(task)}
                        disabled={blocked || busyId === task.id}
                      >
                        {busyId === task.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        {mySession ? "Finish current task first" : task.isFull ? "Full" : "Start Work"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
