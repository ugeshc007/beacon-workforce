import { useState } from "react";
import { useExecutiveData } from "@/hooks/useReports";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  ChevronLeft, ChevronRight, Users, FolderKanban, Clock,
  DollarSign, TrendingUp, TrendingDown, Gauge, Download,
  Bell, Building2, UserCheck,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line, Legend,
} from "recharts";

const ALERT_LABELS: Record<string, string> = {
  absent_alert: "Absent",
  overtime_alert: "Overtime",
  gps_spoofing: "GPS Spoof",
  late_arrival: "Late Arrival",
  assignment_gap: "Understaffed",
};

export default function Executive() {
  const navigate = useNavigate();
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const startDate = `${month}-01`;
  const endDate = new Date(target.getFullYear(), target.getMonth() + 1, 0).toISOString().slice(0, 10);
  const { data, isLoading } = useExecutiveData(startDate, endDate);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Executive Summary</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>This Month</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => {
              const rows: (string | number)[][] = [
                ["Active Projects", data.activeProjects],
                ["Deployed Today", data.deployedToday],
                ["Company Utilization %", data.companyUtilization],
                ["Total Spend (AED)", data.totalLaborCost],
                ["Last Month Spend (AED)", data.prevMonthSpend],
                ["Change %", data.spendChange],
                ["Total Hours", data.totalHours],
                ["OT Hours", data.totalOtHours],
              ];
              downloadCsv(`executive-${month}.csv`, ["Metric", "Value"], rows);
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Executive Summary",
                subtitle: monthLabel,
                filename: `executive-${month}.pdf`,
                summaryCards: [
                  { label: "Active Projects", value: String(data.activeProjects) },
                  { label: "Deployed Today", value: String(data.deployedToday) },
                  { label: "Utilization", value: `${data.companyUtilization}%` },
                  { label: "Month Spend", value: `AED ${data.totalLaborCost.toLocaleString()}` },
                ],
                tables: [
                  {
                    title: "Key Metrics",
                    headers: ["Metric", "Value"],
                    rows: [
                      ["Active Projects", data.activeProjects],
                      ["Deployed Today", data.deployedToday],
                      ["Company Utilization", `${data.companyUtilization}%`],
                      ["Total Spend (AED)", `AED ${data.totalLaborCost.toLocaleString()}`],
                      ["Last Month Spend", `AED ${data.prevMonthSpend.toLocaleString()}`],
                      ["Spend Change", `${data.spendChange}%`],
                      ["Total Hours", `${data.totalHours}h`],
                      ["OT Hours", `${data.totalOtHours}h`],
                    ],
                  },
                  ...(data.branchStats.length > 0 ? [{
                    title: "Branch Comparison",
                    headers: ["Branch", "Staff", "Hours", "Cost (AED)", "Utilization %"],
                    rows: data.branchStats.map((b) => [b.name, b.employees, `${b.hours}h`, `AED ${b.cost.toLocaleString()}`, `${b.utilization}%`]),
                  }] : []),
                ],
              });
            }}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          </>)}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : !data ? null : (
        <>
          {/* KPI Cards — clickable drill-through */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => navigate("/projects")}>
              <StatCard title="Active Projects" value={data.activeProjects} icon={FolderKanban} variant="brand" subtitle="View projects →" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate("/attendance/daily")}>
              <StatCard title="Deployed Today" value={data.deployedToday} icon={UserCheck} variant="success" subtitle="View daily team →" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate("/reports/utilization")}>
              <StatCard title="Utilization" value={`${data.companyUtilization}%`} icon={Gauge} variant={data.companyUtilization >= 70 ? "success" : data.companyUtilization >= 40 ? "warning" : "destructive"} subtitle="View detail →" />
            </div>
            <div className="cursor-pointer" onClick={() => navigate("/reports/costs")}>
              <StatCard
                title="This Month Spend"
                value={`AED ${data.totalLaborCost.toLocaleString()}`}
                icon={DollarSign}
                variant="default"
                trend={data.prevMonthSpend > 0 ? {
                  value: `${Math.abs(data.spendChange)}% vs last month`,
                  positive: data.spendChange <= 0,
                } : undefined}
              />
            </div>
          </div>

          {/* Row 1: Top 5 Projects + Utilization Trend */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Top 5 Projects by Cost</CardTitle>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 text-brand" onClick={() => navigate("/reports/costs")}>
                    View all →
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart layout="vertical" data={data.top5Projects}>
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Bar dataKey="labor" stackId="a" fill="hsl(var(--brand))" name="Labor" />
                    <Bar dataKey="ot" stackId="a" fill="hsl(var(--status-overtime))" name="OT" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">12-Week Utilization Trend</CardTitle>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 text-brand" onClick={() => navigate("/reports/utilization")}>
                    View detail →
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.weeklyUtilization}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Line type="monotone" dataKey="utilization" stroke="hsl(var(--brand))" strokeWidth={2} dot={{ r: 3 }} name="Utilization %" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Daily Cost Trend */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Daily Labor Cost Trend</CardTitle>
                <Button variant="ghost" size="sm" className="text-[10px] h-6 text-brand" onClick={() => navigate("/timesheets")}>
                  View timesheets →
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {data.costTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No cost data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.costTrend}>
                    <defs>
                      <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--brand))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--brand))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.split("-")[2]} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} labelFormatter={(l) => `Date: ${l}`} />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--brand))" strokeWidth={2} fill="url(#costGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Row 3: Branch Comparison + Alerts */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Branch Comparison */}
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand" /> Branch Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.branchStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No branch data available</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={data.branchStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} unit="%" domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: number, name: string) => name === "utilization" ? `${v}%` : `AED ${v.toLocaleString()}`} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="utilization" fill="hsl(var(--brand))" name="Utilization %" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cost" fill="hsl(var(--status-traveling))" name="Cost (AED)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <table className="w-full text-sm mt-4">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 font-medium">Branch</th>
                          <th className="text-center py-1.5 font-medium">Staff</th>
                          <th className="text-right py-1.5 font-medium">Hours</th>
                          <th className="text-right py-1.5 font-medium">Cost</th>
                          <th className="text-right py-1.5 font-medium">Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.branchStats.map((b) => (
                          <tr key={b.id} className="border-b border-border/30">
                            <td className="py-1.5 font-medium text-foreground">{b.name}</td>
                            <td className="py-1.5 text-center font-mono text-xs">{b.employees}</td>
                            <td className="py-1.5 text-right font-mono text-xs">{b.hours}h</td>
                            <td className="py-1.5 text-right font-mono text-xs">AED {b.cost.toLocaleString()}</td>
                            <td className="py-1.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${b.utilization >= 70 ? "bg-status-present" : b.utilization >= 40 ? "bg-brand" : "bg-status-absent"}`}
                                    style={{ width: `${Math.min(b.utilization, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs font-medium">{b.utilization}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Unresolved Alerts */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bell className="h-4 w-4 text-warning" /> Unresolved Alerts
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px]">
                    {data.unresolvedAlerts.reduce((s, a) => s + a.count, 0)} total
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {data.unresolvedAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="h-8 w-8 mx-auto mb-2 text-status-present opacity-50" />
                    <p className="text-sm text-muted-foreground">All clear — no unresolved alerts</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data.unresolvedAlerts.map((a) => (
                      <div key={a.type} className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-accent/20 transition-colors">
                        <span className="text-sm text-foreground">{ALERT_LABELS[a.type] ?? a.type.replace(/_/g, " ")}</span>
                        <Badge className={`text-xs ${a.count >= 5 ? "bg-status-absent/20 text-status-absent border-status-absent/30" : "bg-warning/20 text-warning border-warning/30"}`}>
                          {a.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Operational KPIs */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="glass-card cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all" onClick={() => navigate("/timesheets")}>
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Daily Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  AED {data.costTrend.length > 0 ? Math.round(data.costTrend.reduce((s, c) => s + c.cost, 0) / data.costTrend.length).toLocaleString() : 0}
                </p>
                <p className="text-xs text-muted-foreground">Per working day</p>
              </CardContent>
            </Card>
            <Card className="glass-card cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all" onClick={() => navigate("/attendance")}>
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">OT Ratio</p>
                <p className="text-2xl font-bold text-status-overtime">
                  {data.totalHours > 0 ? Math.round((data.totalOtHours / data.totalHours) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">{data.totalOtHours}h overtime of {data.totalHours}h total</p>
              </CardContent>
            </Card>
            <Card className="glass-card cursor-pointer hover:ring-1 hover:ring-brand/30 transition-all" onClick={() => navigate("/employees")}>
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cost per Hour</p>
                <p className="text-2xl font-bold text-foreground">
                  AED {data.totalHours > 0 ? Math.round(data.totalLaborCost / data.totalHours) : 0}
                </p>
                <p className="text-xs text-muted-foreground">Average blended rate</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
