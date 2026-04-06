import { useState, useMemo } from "react";
import { useUtilizationData, type UtilizationRow } from "@/hooks/useReports";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ChevronLeft, ChevronRight, Users, Clock, BarChart3, TrendingUp,
  Download, Timer, BatteryLow, AlertTriangle, CalendarX,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Utilization() {
  const [dateRange, setDateRange] = useReportDateRange("This Month");
  const monthLabel = dateRange.label;

  const [skillFilter, setSkillFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [drillRow, setDrillRow] = useState<UtilizationRow | null>(null);

  const { data, isLoading } = useUtilizationData(dateRange.start, dateRange.end, {
    skillType: skillFilter,
    branchId: branchFilter,
  });

  // Horizontal bar data (employee vs hours)
  const employeeBarData = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows
      .filter((r) => r.totalHours > 0)
      .sort((a, b) => b.totalHours - a.totalHours)
      .slice(0, 20)
      .map((r) => ({
        name: r.name.length > 14 ? r.name.slice(0, 12) + "…" : r.name,
        fullName: r.name,
        regular: Math.round((r.totalHours - r.otHours) * 10) / 10,
        ot: r.otHours,
        id: r.id,
      }));
  }, [data]);

  // Doughnut data
  const doughnutData = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Utilized", value: data.totalWorkedHours, fill: "hsl(var(--brand))" },
      { name: "Idle", value: data.totalIdleHours, fill: "hsl(var(--muted))" },
    ].filter((d) => d.value > 0);
  }, [data]);

  const handleBarClick = (barData: any) => {
    if (!data || !barData?.activePayload?.[0]) return;
    const payload = barData.activePayload[0].payload;
    const row = data.rows.find((r) => r.name === payload.fullName || r.name.startsWith(payload.name));
    if (row) setDrillRow(row);
  };

  // Heatmap intensity
  const getHeatColor = (minutes: number) => {
    if (minutes === 0) return "bg-muted/30";
    if (minutes < 240) return "bg-status-traveling/30";
    if (minutes < 480) return "bg-brand/40";
    return "bg-status-present/50";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Staff Utilization</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => {
              downloadCsv(`utilization-${month}.csv`,
                ["Employee", "Skill", "Days Worked", "Hours", "OT Hours", "Idle Hours", "Capacity", "Utilization %"],
                data.rows.map((r) => [r.name, r.skill_type, r.daysWorked, r.totalHours, r.otHours, r.idleHours, r.capacity, r.utilization])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Staff Utilization Report",
                subtitle: monthLabel,
                filename: `utilization-${month}.pdf`,
                summaryCards: [
                  { label: "Avg Utilization", value: `${data.avgUtilization}%` },
                  { label: "Total Worked", value: `${data.totalWorkedHours}h` },
                  { label: "Idle Hours", value: `${data.totalIdleHours}h` },
                  { label: "OT Hours", value: `${data.totalOtHours}h` },
                ],
                tables: [{
                  title: "Employee Utilization Detail",
                  headers: ["Employee", "Skill", "Days", "Hours", "OT", "Idle", "Capacity", "Utilization %"],
                  rows: data.rows.map((r) => [r.name, r.skill_type, r.daysWorked, `${r.totalHours}h`, `${r.otHours}h`, `${r.idleHours}h`, `${r.capacity}h`, `${r.utilization}%`]),
                }],
              });
            }}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          </>)}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Skills" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
            <SelectItem value="helper">Helper</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {(data?.branches ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Avg Utilization" value={`${data.avgUtilization}%`} icon={TrendingUp} variant="brand" />
            <StatCard title="Total Worked" value={`${data.totalWorkedHours}h`} icon={Clock} variant="success" />
            <StatCard title="Idle Hours" value={`${data.totalIdleHours}h`} icon={BatteryLow} variant="warning" />
            <StatCard title="OT Hours" value={`${data.totalOtHours}h`} icon={Timer} variant="destructive" />
          </div>

          {/* Row 1: Horizontal Bar + Doughnut */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Hours (click to drill down)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, employeeBarData.length * 28)}>
                  <BarChart layout="vertical" data={employeeBarData} onClick={handleBarClick} className="cursor-pointer">
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Bar dataKey="regular" stackId="a" fill="hsl(var(--brand))" radius={[0, 0, 0, 0]} name="Regular" />
                    <Bar dataKey="ot" stackId="a" fill="hsl(var(--status-overtime))" radius={[0, 4, 4, 0]} name="Overtime" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Utilized vs Idle</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={doughnutData} innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={3} cx="50%" cy="50%">
                      {doughnutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Stacked Weekly + Skill Breakdown */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Weekly Hours Trend (Regular + OT)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Bar dataKey="regular" stackId="a" fill="hsl(var(--brand))" name="Regular" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="ot" stackId="a" fill="hsl(var(--status-overtime))" name="Overtime" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Utilization by Skill Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.bySkill.filter((s) => s.count > 0)}>
                    <XAxis dataKey="skill" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="avgUtilization" fill="hsl(var(--brand))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Heatmap Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Hours Heatmap</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[800px] p-4">
                  <table className="w-full text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left py-1 px-2 font-medium text-muted-foreground sticky left-0 bg-card z-10 min-w-[120px]">Employee</th>
                        {data.heatmapDays.map((d) => {
                          const day = parseInt(d.split("-")[2]);
                          return <th key={d} className="text-center py-1 px-0.5 font-medium text-muted-foreground min-w-[22px]">{day}</th>;
                        })}
                        <th className="text-right py-1 px-2 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.filter((r) => r.daysWorked > 0).sort((a, b) => b.utilization - a.utilization).slice(0, 30).map((r) => (
                        <tr key={r.id} className="cursor-pointer hover:bg-accent/20" onClick={() => setDrillRow(r)}>
                          <td className="py-0.5 px-2 font-medium text-foreground sticky left-0 bg-card z-10 truncate max-w-[120px]">{r.name}</td>
                          {data.heatmapDays.map((d) => {
                            const min = r.dailyMinutes[d] ?? 0;
                            return (
                              <td key={d} className="py-0.5 px-0.5 text-center">
                                <div className={`w-4 h-4 mx-auto rounded-sm ${getHeatColor(min)}`} title={`${Math.round(min / 60 * 10) / 10}h`} />
                              </td>
                            );
                          })}
                          <td className="py-0.5 px-2 text-right font-mono font-medium text-foreground">{r.totalHours}h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
                    <span>Legend:</span>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-muted/30" /> 0h</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-status-traveling/30" /> &lt;4h</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-brand/40" /> 4–8h</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-status-present/50" /> 8h+</div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Absenteeism Analytics */}
          {data.absenceRows.length > 0 && (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CalendarX className="h-4 w-4 text-status-absent" /> Absence Frequency by Employee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={Math.max(160, Math.min(data.absenceRows.length, 15) * 24)}>
                    <BarChart layout="vertical" data={data.absenceRows.slice(0, 15)}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="absentDays" fill="hsl(var(--status-absent))" radius={[0, 4, 4, 0]} name="Absent Days" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Day-of-Week Absence Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={DOW_LABELS.map((name, i) => ({ name, count: data.dowTotals[i] })).filter((d) => d.name !== "Fri")}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} name="Absences" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Employee Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Utilization Detail</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Skill</th>
                    <th className="text-right py-2 font-medium">Days</th>
                    <th className="text-right py-2 font-medium">Hours</th>
                    <th className="text-right py-2 font-medium">OT</th>
                    <th className="text-right py-2 font-medium">Idle</th>
                    <th className="text-right py-2 font-medium">Capacity</th>
                    <th className="text-right py-2 font-medium">Utilization</th>
                    <th className="py-2 font-medium w-[120px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.sort((a, b) => b.utilization - a.utilization).map((r) => (
                    <tr key={r.id} className="border-b border-border/30 cursor-pointer hover:bg-accent/20" onClick={() => setDrillRow(r)}>
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2"><Badge variant="outline" className="text-[10px]">{r.skill_type}</Badge></td>
                      <td className="py-2 text-right font-mono text-xs">{r.daysWorked}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.totalHours}h</td>
                      <td className="py-2 text-right font-mono text-xs text-status-overtime">{r.otHours > 0 ? `${r.otHours}h` : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-muted-foreground">{r.idleHours > 0 ? `${r.idleHours}h` : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-muted-foreground">{r.capacity}h</td>
                      <td className="py-2 text-right font-mono text-xs font-medium">{r.utilization}%</td>
                      <td className="py-2">
                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${r.utilization >= 80 ? "bg-status-present" : r.utilization >= 50 ? "bg-brand" : "bg-status-absent"}`}
                            style={{ width: `${Math.min(r.utilization, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Drill-down Dialog */}
          <Dialog open={!!drillRow} onOpenChange={(o) => { if (!o) setDrillRow(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{drillRow?.name} — Daily Breakdown</DialogTitle>
                <DialogDescription>
                  {monthLabel} · {drillRow?.skill_type} · {drillRow?.utilization}% utilization
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Total Hours</p>
                  <p className="text-lg font-bold">{drillRow?.totalHours}h</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
                  <p className="text-lg font-bold text-status-overtime">{drillRow?.otHours}h</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Idle</p>
                  <p className="text-lg font-bold text-warning">{drillRow?.idleHours}h</p>
                </div>
              </div>
              <ScrollArea className="max-h-[300px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-1.5 font-medium">Date</th>
                      <th className="text-left py-1.5 font-medium">Day</th>
                      <th className="text-right py-1.5 font-medium">Hours</th>
                      <th className="text-right py-1.5 font-medium">OT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillRow && data?.heatmapDays
                      .filter((d) => (drillRow.dailyMinutes[d] ?? 0) > 0)
                      .map((d) => {
                        const hrs = Math.round(((drillRow.dailyMinutes[d] ?? 0) / 60) * 10) / 10;
                        const ot = Math.round(((drillRow.dailyOtMinutes[d] ?? 0) / 60) * 10) / 10;
                        const dayName = new Date(d).toLocaleDateString("en-GB", { weekday: "short" });
                        return (
                          <tr key={d} className="border-b border-border/30">
                            <td className="py-1.5 font-mono text-xs">{d.split("-").reverse().join("/")}</td>
                            <td className="py-1.5 text-xs text-muted-foreground">{dayName}</td>
                            <td className="py-1.5 text-right font-mono text-xs font-medium">{hrs}h</td>
                            <td className="py-1.5 text-right font-mono text-xs text-status-overtime">{ot > 0 ? `${ot}h` : "—"}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
