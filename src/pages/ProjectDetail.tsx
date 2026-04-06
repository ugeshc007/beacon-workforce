import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  useProject, useProjectStats, useProjectTeam, useProjectExpenses,
  useRemoveAssignment, useUpdateProject, useProjectSchedule, useProjectAttendance, useProjectCosts,
} from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, MapPin, Phone, Mail, Users, DollarSign, Clock, Wrench,
  UserPlus, Trash2, Paperclip, ExternalLink, Check, CalendarDays, BarChart3,
} from "lucide-react";
import { useState } from "react";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectCostsTab } from "@/components/projects/ProjectCostsTab";
import { TeamAssignDialog } from "@/components/projects/TeamAssignDialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const statusMap: Record<string, "planned" | "present" | "traveling" | "absent" | "overtime"> = {
  planned: "planned",
  assigned: "planned",
  in_progress: "present",
  completed: "overtime",
};

const STAGES = ["planned", "assigned", "in_progress", "completed"] as const;
const STAGE_LABELS: Record<string, string> = {
  planned: "Planned",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
};

function StageStepper({
  currentStatus,
  onStatusChange,
  isPending,
}: {
  currentStatus: string;
  onStatusChange: (status: string) => void;
  isPending: boolean;
}) {
  const currentIdx = STAGES.indexOf(currentStatus as any);

  return (
    <div className="flex items-center w-full gap-0">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isClickable = idx === currentIdx + 1 || idx === currentIdx - 1;

        return (
          <div key={stage} className="flex items-center flex-1 last:flex-none">
            <button
              disabled={!isClickable || isPending}
              onClick={() => isClickable && onStatusChange(stage)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                isCompleted && "text-status-present cursor-default",
                isCurrent && "bg-brand/15 text-brand border border-brand/30",
                !isCompleted && !isCurrent && "text-muted-foreground",
                isClickable && !isPending && "hover:bg-accent cursor-pointer",
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-bold border-2 transition-all",
                  isCompleted && "bg-status-present border-status-present text-white",
                  isCurrent && "border-brand bg-brand/10 text-brand",
                  !isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
              </span>
              <span className="hidden sm:inline">{STAGE_LABELS[stage]}</span>
            </button>
            {idx < STAGES.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-1 rounded-full transition-all",
                  idx < currentIdx ? "bg-status-present" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: stats } = useProjectStats(id ?? null);
  const { data: team } = useProjectTeam(id ?? null);
  const { data: expenses } = useProjectExpenses(id ?? null);
  const { data: schedule } = useProjectSchedule(id ?? null);
  const { data: attendance } = useProjectAttendance(id ?? null);
  const { data: costs } = useProjectCosts(id ?? null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const removeMutation = useRemoveAssignment();
  const updateMutation = useUpdateProject();
  const { toast } = useToast();
  const [uploadingExpenseId, setUploadingExpenseId] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateMutation.mutateAsync({ id: id!, status: newStatus as any });
      toast({ title: "Status updated", description: `Project moved to ${STAGE_LABELS[newStatus]}` });
    } catch (err: any) {
      toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
    }
  };

  const handleReceiptUpload = async (expenseId: string, file: File) => {
    setUploadingExpenseId(expenseId);
    const ext = file.name.split(".").pop();
    const path = `${id}/${expenseId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("receipts").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingExpenseId(null);
      return;
    }
    await supabase.from("project_expenses").update({ receipt_url: path }).eq("id", expenseId);
    toast({ title: "Receipt uploaded" });
    setUploadingExpenseId(null);
    window.location.reload();
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  const totalRequired = project.required_technicians + project.required_helpers + project.required_supervisors;

  // Group schedule by date
  const scheduleByDate = (schedule ?? []).reduce<Record<string, typeof schedule>>((acc, s) => {
    const d = (s as any).date;
    if (!acc[d]) acc[d] = [];
    acc[d]!.push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.client_name ?? "No client"} · {project.branches?.name ?? "—"}</p>
        </div>
        <StatusBadge status={statusMap[project.status] ?? "planned"} />
        <Button size="sm" onClick={() => setEditOpen(true)}>Edit</Button>
      </div>

      {/* Stage Stepper */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <StageStepper
            currentStatus={project.status}
            onStatusChange={handleStatusChange}
            isPending={updateMutation.isPending}
          />
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Today's Staff", value: `${stats?.todayStaff ?? 0}/${totalRequired}` },
          { icon: Clock, label: "Total Hours", value: `${stats?.totalHours ?? 0}h` },
          { icon: DollarSign, label: "Labor Cost", value: `AED ${(stats?.totalLaborCost ?? 0).toLocaleString()}` },
          { icon: Wrench, label: "Expenses", value: `AED ${(stats?.totalExpenses ?? 0).toLocaleString()}` },
        ].map((s) => (
          <Card key={s.label} className="glass-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-brand/10 flex items-center justify-center"><s.icon className="h-4 w-4 text-brand" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team ({team?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Project Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{project.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{project.start_date ? format(new Date(project.start_date), "dd/MM/yyyy") : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{project.end_date ? format(new Date(project.end_date), "dd/MM/yyyy") : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Budget</span><span>{project.budget ? `AED ${project.budget.toLocaleString()}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span>{project.project_value ? `AED ${project.project_value.toLocaleString()}` : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Health</span><span>{project.health_score}%</span></div>
                {project.notes && <p className="text-xs text-muted-foreground border-t pt-2">{project.notes}</p>}
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Client & Location</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                {project.client_name && <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5 text-muted-foreground" />{project.client_name}</div>}
                {project.client_phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{project.client_phone}</div>}
                {project.client_email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" />{project.client_email}</div>}
                {project.site_address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{project.site_address}</div>}
                <div className="flex justify-between"><span className="text-muted-foreground">GPS Radius</span><span>{project.site_gps_radius}m</span></div>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Staffing Requirements</p>
                  <div className="flex gap-2">
                    <Badge variant="outline">{project.required_technicians} Tech</Badge>
                    <Badge variant="outline">{project.required_helpers} Help</Badge>
                    <Badge variant="outline">{project.required_supervisors} Sup</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Team ── */}
        <TabsContent value="team">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">{team?.length ?? 0} team member{(team?.length ?? 0) !== 1 ? "s" : ""}</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAssignOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Assign Employee
                </Button>
              </div>
              {!team?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No team assigned yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Employee</th>
                      <th className="text-left py-2 font-medium">Skill</th>
                      <th className="text-left py-2 font-medium">Phone</th>
                      <th className="text-left py-2 font-medium">Shift</th>
                      <th className="text-left py-2 font-medium">Last Assigned</th>
                      <th className="text-right py-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((t) => {
                      const emp = t.employees as any;
                      return (
                        <tr key={t.id} className="border-b border-border/50 last:border-0">
                          <td className="py-2.5 font-medium">{emp?.name ?? "—"}</td>
                          <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{emp?.skill_type}</Badge></td>
                          <td className="py-2.5 text-muted-foreground font-mono text-xs">{emp?.phone ?? "—"}</td>
                          <td className="py-2.5 text-muted-foreground font-mono text-xs">{t.shift_start ?? "—"} – {t.shift_end ?? "—"}</td>
                          <td className="py-2.5 text-muted-foreground font-mono text-xs">{(t as any).date ?? "—"}</td>
                          <td className="py-2.5 text-right">
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={removeMutation.isPending}
                              onClick={async () => {
                                try {
                                  await removeMutation.mutateAsync({ assignmentId: t.id, projectId: id! });
                                  toast({ title: "Removed", description: `${emp?.name ?? "Employee"} removed.` });
                                } catch (err: any) {
                                  toast({ title: "Failed", description: err.message, variant: "destructive" });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Schedule ── */}
        <TabsContent value="schedule">
          <Card className="glass-card">
            <CardContent className="pt-4">
              {!schedule?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No schedule assignments yet. Go to the Schedule page to assign staff.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(scheduleByDate)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 14)
                    .map(([date, assignments]) => (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-2">
                          <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-medium text-foreground">{format(new Date(date), "EEE, dd/MM/yyyy")}</span>
                          <Badge variant="outline" className="text-[10px]">{assignments!.length} staff</Badge>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 ml-5">
                          {assignments!.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-2 text-xs bg-accent/30 rounded-md px-3 py-2">
                              <span className="font-medium text-foreground">{a.employees?.name ?? "—"}</span>
                              <Badge variant="outline" className="text-[9px]">{a.employees?.skill_type}</Badge>
                              <span className="text-muted-foreground ml-auto font-mono">{a.shift_start ?? "—"} – {a.shift_end ?? "—"}</span>
                              {a.is_locked && <span className="text-brand text-[10px]">🔒</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance ── */}
        <TabsContent value="attendance">
          <Card className="glass-card">
            <CardContent className="pt-4">
              {!attendance?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No attendance records for this project yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Employee</th>
                      <th className="text-left py-2 font-medium">Skill</th>
                      <th className="text-left py-2 font-medium">Punch In</th>
                      <th className="text-left py-2 font-medium">Punch Out</th>
                      <th className="text-right py-2 font-medium">Work (h)</th>
                      <th className="text-right py-2 font-medium">OT (h)</th>
                      <th className="text-right py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.slice(0, 50).map((a: any) => (
                      <tr key={a.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 font-mono text-xs">{format(new Date(a.date), "dd/MM")}</td>
                        <td className="py-2.5 font-medium">{a.employees?.name ?? "—"}</td>
                        <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{a.employees?.skill_type}</Badge></td>
                        <td className="py-2.5 text-muted-foreground font-mono text-xs">
                          {a.office_punch_in ? format(new Date(a.office_punch_in), "HH:mm") : "—"}
                        </td>
                        <td className="py-2.5 text-muted-foreground font-mono text-xs">
                          {a.office_punch_out ? format(new Date(a.office_punch_out), "HH:mm") : "—"}
                        </td>
                        <td className="py-2.5 text-right font-mono text-xs">{a.total_work_minutes ? (a.total_work_minutes / 60).toFixed(1) : "—"}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{a.overtime_minutes ? (a.overtime_minutes / 60).toFixed(1) : "—"}</td>
                        <td className="py-2.5 text-right font-mono text-xs">AED {(Number(a.regular_cost ?? 0) + Number(a.overtime_cost ?? 0)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Costs ── */}
        <TabsContent value="costs">
          <ProjectCostsTab project={project} costs={costs} />
        </TabsContent>

        {/* ── Expenses ── */}
        <TabsContent value="expenses">
          <Card className="glass-card">
            <CardContent className="pt-4">
              {!expenses?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No expenses recorded</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Date</th>
                      <th className="text-left py-2 font-medium">Category</th>
                      <th className="text-left py-2 font-medium">Description</th>
                      <th className="text-right py-2 font-medium">Amount</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 font-mono text-xs">{e.date}</td>
                        <td className="py-2.5"><Badge variant="outline" className="text-[10px]">{e.category}</Badge></td>
                        <td className="py-2.5 text-muted-foreground">{e.description ?? "—"}</td>
                        <td className="py-2.5 text-right font-mono">AED {Number(e.amount_aed ?? e.amount).toLocaleString()}</td>
                        <td className="py-2.5"><Badge variant={e.status === "approved" ? "default" : e.status === "rejected" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge></td>
                        <td className="py-2.5">
                          {e.receipt_url ? (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-brand"
                              onClick={async () => {
                                const { data } = await supabase.storage.from("receipts").createSignedUrl(e.receipt_url!, 3600);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> View
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" disabled={uploadingExpenseId === e.id}
                              onClick={() => {
                                const input = document.createElement("input");
                                input.type = "file";
                                input.accept = "image/*,.pdf";
                                input.onchange = (ev) => {
                                  const file = (ev.target as HTMLInputElement).files?.[0];
                                  if (file) handleReceiptUpload(e.id, file);
                                };
                                input.click();
                              }}
                            >
                              <Paperclip className="h-3 w-3 mr-1" />
                              {uploadingExpenseId === e.id ? "Uploading..." : "Attach"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} editProject={project as Tables<"projects">} />
      <TeamAssignDialog open={assignOpen} onOpenChange={setAssignOpen} projectId={id!} existingEmployeeIds={(team ?? []).map((t) => t.employee_id)} />
    </div>
  );
}
