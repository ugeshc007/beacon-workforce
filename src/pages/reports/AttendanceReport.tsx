import { useState } from "react";
import { useAttendanceReport } from "@/hooks/useReports";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Users, Clock, MapPin, CheckCircle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const STATUS_COLORS = ["hsl(var(--status-present))", "hsl(var(--status-traveling))", "hsl(var(--status-absent))", "hsl(var(--brand))"];

const fmtT = (ts: string | null | undefined) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};
const TIMELINE_HEADERS = ["Employee", "Date", "Project", "Punch In", "Travel Start", "Site Arrival", "Work Start", "Break Start", "Break End", "Work End", "Return Travel", "Office Arrival", "Punch Out", "Total Hrs", "OT Hrs"];

export default function AttendanceReport() {
  const [dateRange, setDateRange] = useReportDateRange("This Month");
  const [branchFilter, setBranchFilter] = useState("all");

  const { data, isLoading } = useAttendanceReport(dateRange.start, dateRange.end, { branchId: branchFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance Report</h1>
          <p className="text-sm text-muted-foreground">{dateRange.label}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          {data && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {data.branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-1" onClick={() => {
              downloadCsv(`attendance-timeline-${dateRange.start}.csv`,
                TIMELINE_HEADERS,
                data.details.map((d) => [
                  d.name, d.date, d.project,
                  fmtT(d.office_punch_in), fmtT(d.travel_start_time), fmtT(d.site_arrival_time),
                  fmtT(d.work_start_time), fmtT(d.break_start_time), fmtT(d.break_end_time),
                  fmtT(d.work_end_time), fmtT(d.return_travel_start_time), fmtT(d.office_arrival_time),
                  fmtT(d.office_punch_out),
                  d.total_work_minutes != null ? (d.total_work_minutes / 60).toFixed(1) : "—",
                  d.overtime_minutes != null ? (d.overtime_minutes / 60).toFixed(1) : "0",
                ])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Attendance Report",
                subtitle: dateRange.label,
                filename: `attendance-${dateRange.start}.pdf`,
                summaryCards: [
                  { label: "Total Employees", value: String(data.totalEmployees) },
                  { label: "Avg Attendance", value: `${data.avgAttendanceRate}%` },
                  { label: "Avg Hours/Day", value: `${data.avgHoursPerDay}h` },
                  { label: "Late Arrivals", value: String(data.totalLateDays) },
                ],
                tables: [{
                  title: "Employee Daily Activity Timeline",
                  headers: TIMELINE_HEADERS,
                  rows: data.details.map((d) => [
                    d.name, d.date, d.project,
                    fmtT(d.office_punch_in), fmtT(d.travel_start_time), fmtT(d.site_arrival_time),
                    fmtT(d.work_start_time), fmtT(d.break_start_time), fmtT(d.break_end_time),
                    fmtT(d.work_end_time), fmtT(d.return_travel_start_time), fmtT(d.office_arrival_time),
                    fmtT(d.office_punch_out),
                    d.total_work_minutes != null ? `${(d.total_work_minutes / 60).toFixed(1)}h` : "—",
                    d.overtime_minutes != null ? `${(d.overtime_minutes / 60).toFixed(1)}h` : "0h",
                  ]),
                }],
              });
            }}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          </>)}
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Employee Daily Activity Timeline</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-1">Actual punch in/out, travel, site arrival, work, breaks and return — per employee per day</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1400px]">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border uppercase tracking-wider">
                    <th className="text-left py-2 font-medium pr-3">Employee</th>
                    <th className="text-left py-2 font-medium pr-3">Date</th>
                    <th className="text-left py-2 font-medium pr-3">Project</th>
                    <th className="text-center py-2 font-medium">Punch In</th>
                    <th className="text-center py-2 font-medium">Travel Start</th>
                    <th className="text-center py-2 font-medium">Site Arrival</th>
                    <th className="text-center py-2 font-medium">Work Start</th>
                    <th className="text-center py-2 font-medium">Break Start</th>
                    <th className="text-center py-2 font-medium">Break End</th>
                    <th className="text-center py-2 font-medium">Work End</th>
                    <th className="text-center py-2 font-medium">Return Travel</th>
                    <th className="text-center py-2 font-medium">Office Arrival</th>
                    <th className="text-center py-2 font-medium">Punch Out</th>
                    <th className="text-right py-2 font-medium pl-3">Total</th>
                    <th className="text-right py-2 font-medium pl-3">OT</th>
                  </tr>
                </thead>
                <tbody>
                  {data.details.length === 0 ? (
                    <tr><td colSpan={15} className="py-6 text-center text-muted-foreground">No attendance records in this date range</td></tr>
                  ) : data.details.map((d, i) => {
                    const cell = (ts: string | null | undefined, color?: string) => (
                      <td className={`py-2 text-center font-mono ${ts ? color ?? "text-foreground" : "text-muted-foreground/40"}`}>{fmtT(ts)}</td>
                    );
                    return (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2 font-medium text-foreground pr-3 whitespace-nowrap">{d.name}</td>
                        <td className="py-2 text-muted-foreground pr-3 whitespace-nowrap">{d.date}</td>
                        <td className="py-2 text-muted-foreground pr-3 whitespace-nowrap max-w-[140px] truncate" title={d.project}>{d.project}</td>
                        {cell(d.office_punch_in, "text-primary")}
                        {cell(d.travel_start_time, "text-status-traveling")}
                        {cell(d.site_arrival_time, "text-status-present")}
                        {cell(d.work_start_time, "text-status-present")}
                        {cell(d.break_start_time)}
                        {cell(d.break_end_time)}
                        {cell(d.work_end_time, "text-status-overtime")}
                        {cell(d.return_travel_start_time, "text-status-traveling")}
                        {cell(d.office_arrival_time, "text-primary")}
                        {cell(d.office_punch_out)}
                        <td className="py-2 text-right font-mono pl-3 text-foreground">{d.total_work_minutes != null ? `${(d.total_work_minutes / 60).toFixed(1)}h` : "—"}</td>
                        <td className="py-2 text-right font-mono pl-3 text-status-overtime">{d.overtime_minutes ? `${(d.overtime_minutes / 60).toFixed(1)}h` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Summary</CardTitle></CardHeader>
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
