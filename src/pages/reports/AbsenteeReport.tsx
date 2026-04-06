import { useState } from "react";
import { useAbsenteeReport } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, CalendarX, Users, TrendingDown, AlertTriangle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AbsenteeReport() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [branchFilter, setBranchFilter] = useState("all");
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useAbsenteeReport(month, { branchId: branchFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Absentee Report</h1>
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
              downloadCsv(`absentee-${month}.csv`,
                ["Employee", "Skill", "Absent Days", "Leave Days", "Unexcused", "Absence Rate %"],
                data.rows.map((r) => [r.name, r.skill, r.absentDays, r.leaveDays, r.unexcusedDays, r.absenceRate])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Absentee Report",
                subtitle: monthLabel,
                filename: `absentee-${month}.pdf`,
                summaryCards: [
                  { label: "Total Absent Days", value: String(data.totalAbsentDays) },
                  { label: "On Leave", value: String(data.totalLeaveDays) },
                  { label: "Unexcused", value: String(data.totalUnexcused) },
                  { label: "Avg Absence Rate", value: `${data.avgAbsenceRate}%` },
                ],
                tables: [{
                  title: "Absentee Detail",
                  headers: ["Employee", "Skill", "Absent Days", "Leave Days", "Unexcused", "Absence Rate %"],
                  rows: data.rows.map((r) => [r.name, r.skill, r.absentDays, r.leaveDays, r.unexcusedDays, `${r.absenceRate}%`]),
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
            <StatCard title="Total Absent Days" value={data.totalAbsentDays} icon={CalendarX} variant="destructive" />
            <StatCard title="On Leave" value={data.totalLeaveDays} icon={Users} variant="warning" />
            <StatCard title="Unexcused" value={data.totalUnexcused} icon={AlertTriangle} variant="destructive" />
            <StatCard title="Avg Absence Rate" value={`${data.avgAbsenceRate}%`} icon={TrendingDown} variant={data.avgAbsenceRate > 10 ? "destructive" : "default"} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Absence by Day of Week</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.dayOfWeekData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="absences" fill="hsl(var(--status-absent))" name="Absences" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top Absentees</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart layout="vertical" data={data.rows.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="absentDays" fill="hsl(var(--status-absent))" name="Absent" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Absentee Detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Skill</th>
                    <th className="text-center py-2 font-medium">Absent</th>
                    <th className="text-center py-2 font-medium">Leave</th>
                    <th className="text-center py-2 font-medium">Unexcused</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2 text-xs capitalize">{r.skill}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.absentDays}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.leaveDays}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.unexcusedDays > 0 ? <Badge variant="outline" className="text-[10px] text-status-absent">{r.unexcusedDays}</Badge> : "0"}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.absenceRate}%</td>
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
