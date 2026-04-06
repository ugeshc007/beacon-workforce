import { useParams, useNavigate } from "react-router-dom";
import { useProject, useProjectStats, useProjectTeam, useProjectExpenses } from "@/hooks/useProjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowLeft, MapPin, Phone, Mail, Users, DollarSign, Clock, Wrench } from "lucide-react";
import { useState } from "react";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import type { Tables } from "@/integrations/supabase/types";

const statusMap: Record<string, "planned" | "present" | "traveling" | "absent" | "overtime"> = {
  planned: "planned",
  assigned: "planned",
  in_progress: "present",
  completed: "overtime",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(id ?? null);
  const { data: stats } = useProjectStats(id ?? null);
  const { data: team } = useProjectTeam(id ?? null);
  const { data: expenses } = useProjectExpenses(id ?? null);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="text-center py-12 text-muted-foreground">Project not found</div>;

  const totalRequired = project.required_technicians + project.required_helpers + project.required_supervisors;

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
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team ({team?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Project Details</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline">{project.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{project.start_date ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{project.end_date ?? "—"}</span></div>
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

        <TabsContent value="team">
          <Card className="glass-card">
            <CardContent className="pt-4">
              {!team?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">No team assigned today</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Employee</th>
                      <th className="text-left py-2 font-medium">Skill</th>
                      <th className="text-left py-2 font-medium">Phone</th>
                      <th className="text-left py-2 font-medium">Shift</th>
                      <th className="text-left py-2 font-medium">Last Assigned</th>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
    </div>
  );
}
