import { Link } from "react-router-dom";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  FolderKanban,
  Users,
  UserCheck,
  UserX,
  Car,
  Wrench,
  DollarSign,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TravelMapCard } from "@/components/dashboard/TravelMapCard";
import {
  useDashboardStats,
  useTodayTeam,
  useDashboardAlerts,
  useActiveProjects,
  useDashboardRealtime,
} from "@/hooks/useDashboard";

export default function Dashboard() {
  useDashboardRealtime();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: team, isLoading: teamLoading } = useTodayTeam();
  const { data: alerts } = useDashboardAlerts();
  const { data: projects } = useActiveProjects();

  const statCards = stats
    ? [
        { title: "Active Projects", value: stats.activeProjects, icon: FolderKanban, variant: "brand" as const },
        { title: "Today's Assigned", value: stats.todayAssigned, icon: Users, variant: "default" as const, subtitle: `Across ${stats.activeProjects} projects` },
        { title: "Present", value: stats.present, icon: UserCheck, variant: "success" as const, trend: stats.todayAssigned > 0 ? { value: `${Math.round((stats.present / stats.todayAssigned) * 100)}%`, positive: true } : undefined },
        { title: "Absent", value: stats.absent, icon: UserX, variant: "destructive" as const },
        { title: "Traveling", value: stats.traveling, icon: Car, variant: "warning" as const },
        { title: "Working", value: stats.working, icon: Wrench, variant: "brand" as const },
        { title: "Today's Labor Cost", value: `AED ${stats.todayLaborCost.toLocaleString()}`, icon: DollarSign, variant: "default" as const, subtitle: "Live estimate" },
        { title: "Total OT Hours", value: `${stats.totalOtHours}h`, icon: Clock, variant: "default" as const },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : statCards.map((stat) => <StatCard key={stat.title} {...stat} />)}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Team */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Today's Team</CardTitle>
                <Link to="/attendance/daily" className="text-xs text-primary hover:underline">Manage →</Link>
              </div>
            </CardHeader>
            <CardContent>
              {teamLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : !team?.length ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No assignments for today</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 font-medium">Employee</th>
                        <th className="text-left py-2 font-medium">Project</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-left py-2 font-medium">Punch-in</th>
                        <th className="text-left py-2 font-medium">Arrival</th>
                        <th className="text-left py-2 font-medium">Work Start</th>
                        <th className="text-right py-2 font-medium">OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {team.map((m, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
                          <td className="py-2.5 font-medium text-foreground">{m.name}</td>
                          <td className="py-2.5 text-muted-foreground">{m.project}</td>
                          <td className="py-2.5"><StatusBadge status={m.status} /></td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">{m.punchIn}</td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">{m.arrival}</td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">{m.workStart}</td>
                          <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{m.ot}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts + Active Projects */}
        <div>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Alerts</CardTitle>
                {(alerts?.length ?? 0) > 0 && (
                  <Badge variant="destructive" className="text-[10px]">{alerts!.length}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {!alerts?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No alerts — all clear ✓</p>
              ) : (
                alerts.map((alert, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-accent/30 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.priority === "high" ? "text-destructive" : "text-warning"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-relaxed">{alert.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{alert.time}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <TravelMapCard />

          <Card className="glass-card mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Active Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!projects?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No active projects</p>
              ) : (
                projects.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-xs font-medium text-foreground">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">{p.client} · {p.staffAssigned}/{p.staffRequired} staff</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand transition-all"
                          style={{ width: `${p.health}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.health}%</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
