import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  ListChecks, Plus, Search, Users, Clock, MoreVertical, Pencil, Trash2,
  CheckCircle2, RotateCcw, ChevronDown,
} from "lucide-react";
import {
  CommonTask, uaeToday, useCommonTasks, useDeleteCommonTask, useUpdateCommonTask,
} from "@/hooks/useCommonTasks";
import { CommonTaskFormDialog } from "@/components/common-tasks/CommonTaskFormDialog";

const priorityBadge: Record<string, string> = {
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  normal: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

function fmtMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

export default function CommonTasks() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<CommonTask | null>(null);
  const { data: tasks, isLoading } = useCommonTasks({ search, status: statusFilter });
  const update = useUpdateCommonTask();
  const remove = useDeleteCommonTask();
  const { toast } = useToast();
  const today = uaeToday();

  const stats = useMemo(() => {
    const all = tasks ?? [];
    const sessions = all.flatMap((t) => t.common_task_sessions ?? []);
    return {
      inProgress: all.filter((t) => t.status === "in_progress").length,
      completed: all.filter((t) => t.status === "completed").length,
      workingNow: sessions.filter((s) => s.date === today && !s.work_end_time).length,
      minutesToday: sessions
        .filter((s) => s.date === today)
        .reduce((sum, s) => sum + (s.total_work_minutes ?? 0), 0),
    };
  }, [tasks, today]);

  const toggleStatus = async (task: CommonTask) => {
    const next = task.status === "completed" ? "in_progress" : "completed";
    try {
      await update.mutateAsync({ id: task.id, status: next });
      toast({ title: next === "completed" ? "Task marked completed" : "Task reopened" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      toast({ title: "Common task deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ListChecks className="h-6 w-6 text-brand" /> Common Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shared tasks any employee can pick up from the mobile app. Completion is admin-controlled.
          </p>
        </div>
        <Button onClick={() => { setEditTask(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Task
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "In Progress", value: stats.inProgress },
          { label: "Completed", value: stats.completed },
          { label: "Working now", value: stats.workingNow },
          { label: "Logged today", value: fmtMinutes(stats.minutesToday) },
        ].map((s) => (
          <Card key={s.label} className="border-border/50 bg-card">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : !tasks?.length ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-10 text-center">
            <ListChecks className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No common tasks yet. Create one so in-house teams can log their work.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const sessions = task.common_task_sessions ?? [];
            const todays = sessions.filter((s) => s.date === today);
            const activeNow = todays.filter((s) => !s.work_end_time).length;
            const totalMinutes = sessions.reduce((sum, s) => sum + (s.total_work_minutes ?? 0), 0);
            const isDone = task.status === "completed";

            return (
              <Card key={task.id} className="border-border/50 bg-card">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
                          {task.title}
                        </p>
                        <Badge variant="outline" className={priorityBadge[task.priority] ?? priorityBadge.normal}>
                          {task.priority}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={isDone
                            ? "bg-status-present/15 text-status-present border-status-present/30"
                            : "bg-status-traveling/15 text-status-traveling border-status-traveling/30"}
                        >
                          {isDone ? "Completed" : "In Progress"}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {activeNow}/{task.max_headcount} working today
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtMinutes(totalMinutes)} logged total
                        </span>
                        <span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={isDone ? "outline" : "default"}
                        className="gap-1.5"
                        onClick={() => toggleStatus(task)}
                        disabled={update.isPending}
                      >
                        {isDone ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        {isDone ? "Reopen" : "Mark Completed"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setEditTask(task); setFormOpen(true); }}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(task.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {!!sessions.length && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs px-2">
                          <ChevronDown className="h-3.5 w-3.5" /> Who worked on this
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        <div className="rounded-lg border border-border/50 divide-y divide-border/40">
                          {sessions
                            .slice()
                            .sort((a, b) => (b.date + (b.work_start_time ?? "")).localeCompare(a.date + (a.work_start_time ?? "")))
                            .map((s) => (
                              <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">
                                    {s.employees?.name ?? "Employee"}
                                    {s.employees?.employee_code && (
                                      <span className="text-muted-foreground"> · {s.employees.employee_code}</span>
                                    )}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {s.date} · {fmtTime(s.work_start_time)} → {fmtTime(s.work_end_time)}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  {s.work_end_time ? (
                                    <span className="text-foreground font-medium">
                                      {fmtMinutes(s.total_work_minutes ?? 0)}
                                    </span>
                                  ) : (
                                    <span className="text-status-traveling font-medium">Working</span>
                                  )}
                                  {!!s.break_minutes && (
                                    <p className="text-muted-foreground">break {s.break_minutes}m</p>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CommonTaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editTask} />
    </div>
  );
}
