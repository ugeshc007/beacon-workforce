import { useState, useMemo } from "react";
import { useAttendanceReport } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Users, Clock, MapPin, CheckCircle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const STATUS_COLORS = ["hsl(var(--status-present))", "hsl(var(--status-traveling))", "hsl(var(--status-absent))", "hsl(var(--brand))"];

export default function AttendanceReport() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [branchFilter, setBranchFilter] = useState("all");
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useAttendanceReport(month, { branchId: branchFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance Report</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>This Month</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)}><ChevronRight className="h-4 w-4" /></Button>
          {data && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {data.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {data && (
            <Button variant="outline" size="sm" className="text-xs ml-1" onClick={() => {
              downloadCsv(`attendance-${month}.csv`,
                ["Employee", "Days Worked", "Avg Hours", "Late Days", "On Time %", "Punch-in Rate"],
                data.rows.map((r) => [r.name, r.daysWorked, r.avgHours, r.lateDays, r.onTimePct, r.punchInRate])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Attendance Report",
                subtitle: monthLabel,
                filename: `attendance-${month}.pdf`,
                summaryCards: [
                  { label: "Total Employees", value: String(data.totalEmployees) },
                  { label: "Avg Attendance", value: `${data.avgAttendanceRate}%` },
                  { label: "Avg Hours/Day", value: `${data.avgHoursPerDay}h` },
                  { label: "Late Arrivals", value: String(data.totalLateDays) },
                ],
                tables: [{
                  title: "Employee Attendance Detail",
                  headers: ["Employee", "Days Worked", "Avg Hours", "Late Days", "On Time %", "Punch-in Rate"],
                  rows: data.rows.map((r) => [r.name, r.daysWorked, `${r.avgHours}h`, r.lateDays, `${r.onTimePct}%`, `${r.punchInRate}%`]),
                }],
              });
            }}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Employees" value={data.totalEmployees} icon={Users} variant="brand" />
            <StatCard title="Avg Attendance Rate" value={`${data.avgAttendanceRate}%`} icon={CheckCircle} variant="success" />
            <StatCard title="Avg Hours / Day" value={`${data.avgHoursPerDay}h`} icon={Clock} variant="default" />
            <StatCard title="Total Late Arrivals" value={data.totalLateDays} icon={MapPin} variant="warning" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Attendance Count</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="present" fill="hsl(var(--status-present))" name="Present" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Punctuality Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={data.punctualityDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {data.punctualityDist.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Attendance Detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-center py-2 font-medium">Days Worked</th>
                    <th className="text-center py-2 font-medium">Avg Hours</th>
                    <th className="text-center py-2 font-medium">Late Days</th>
                    <th className="text-center py-2 font-medium">On Time %</th>
                    <th className="text-right py-2 font-medium">Punch-in Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.daysWorked}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.avgHours}h</td>
                      <td className="py-2 text-center font-mono text-xs">{r.lateDays > 0 ? <Badge variant="outline" className="text-[10px] text-status-absent border-status-absent/30">{r.lateDays}</Badge> : "0"}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.onTimePct}%</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-12 h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${r.punchInRate >= 90 ? "bg-status-present" : r.punchInRate >= 70 ? "bg-brand" : "bg-status-absent"}`} style={{ width: `${Math.min(r.punchInRate, 100)}%` }} />
                          </div>
                          <span className="font-mono text-xs">{r.punchInRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
