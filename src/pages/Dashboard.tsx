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
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const stats = [
  { title: "Active Projects", value: 5, icon: FolderKanban, variant: "brand" as const },
  { title: "Today's Assigned", value: 32, icon: Users, variant: "default" as const, subtitle: "Across 5 projects" },
  { title: "Present", value: 28, icon: UserCheck, variant: "success" as const, trend: { value: "87.5%", positive: true } },
  { title: "Absent", value: 2, icon: UserX, variant: "destructive" as const },
  { title: "Traveling", value: 3, icon: Car, variant: "warning" as const },
  { title: "Working", value: 22, icon: Wrench, variant: "brand" as const },
  { title: "Today's Labor Cost", value: "AED 4,280", icon: DollarSign, variant: "default" as const, subtitle: "Estimated" },
  { title: "Total OT Hours", value: "12.5h", icon: Clock, variant: "default" as const, trend: { value: "3h vs yesterday", positive: false } },
];

const mockTeam = [
  { name: "Ahmed Al Rashid", project: "Marina Mall LED Wall", status: "present" as const, punchIn: "07:15", arrival: "07:45", workStart: "08:00", ot: "1.5h" },
  { name: "Omar Hassan", project: "Business Bay Tower", status: "traveling" as const, punchIn: "07:20", arrival: "—", workStart: "—", ot: "—" },
  { name: "Fatima Said", project: "Marina Mall LED Wall", status: "present" as const, punchIn: "07:00", arrival: "07:30", workStart: "07:45", ot: "2h" },
  { name: "Khalid Ibrahim", project: "JBR Display Install", status: "absent" as const, punchIn: "—", arrival: "—", workStart: "—", ot: "—" },
  { name: "Youssef Nabil", project: "DIFC Screen Setup", status: "present" as const, punchIn: "07:10", arrival: "07:50", workStart: "08:05", ot: "0h" },
];

const mockAlerts = [
  { type: "absent", message: "Khalid Ibrahim marked absent — Marina Mall needs replacement", time: "2 min ago", priority: "high" },
  { type: "late", message: "Omar Hassan travel time exceeding threshold (45 min)", time: "5 min ago", priority: "normal" },
  { type: "overtime", message: "Fatima Said approaching OT limit (7.5h worked)", time: "12 min ago", priority: "normal" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Today's Team */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Today's Team</CardTitle>
            </CardHeader>
            <CardContent>
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
                    {mockTeam.map((m, i) => (
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
            </CardContent>
          </Card>
        </div>

        {/* Alerts Panel */}
        <div>
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-foreground">Alerts</CardTitle>
                <Badge variant="destructive" className="text-[10px]">3</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockAlerts.map((alert, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-accent/30 animate-fade-in" style={{ animationDelay: `${i * 100}ms` }}>
                  <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${alert.priority === "high" ? "text-destructive" : "text-warning"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Projects Mini */}
          <Card className="glass-card mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Active Projects</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { name: "Marina Mall LED Wall", client: "Emaar", staff: "8/10", health: 85 },
                { name: "Business Bay Tower", client: "Damac", staff: "6/6", health: 95 },
                { name: "JBR Display Install", client: "Meraas", staff: "4/5", health: 72 },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-foreground">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.client} · {p.staff} staff</p>
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
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
