import { useState } from "react";
import { useOvertimeReport } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Clock, DollarSign, TrendingUp, AlertTriangle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from "recharts";

export default function OvertimeReport() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [branchFilter, setBranchFilter] = useState("all");
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useOvertimeReport(month, { branchId: branchFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Overtime Report</h1>
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
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-1" onClick={() => {
              downloadCsv(`overtime-${month}.csv`,
                ["Employee", "Skill", "Regular Hours", "OT Hours", "OT Cost (AED)", "OT Days", "OT Ratio %"],
                data.rows.map((r) => [r.name, r.skill, r.regularHours, r.otHours, r.otCost, r.otDays, r.otRatio])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Overtime Report",
                subtitle: monthLabel,
                filename: `overtime-${month}.pdf`,
                summaryCards: [
                  { label: "Total OT Hours", value: `${data.totalOtHours}h` },
                  { label: "Total OT Cost", value: `AED ${data.totalOtCost.toLocaleString()}` },
                  { label: "Employees with OT", value: String(data.employeesWithOt) },
                  { label: "Avg OT/Employee", value: `${data.avgOtPerEmployee}h` },
                ],
                tables: [{
                  title: "Overtime Detail",
                  headers: ["Employee", "Skill", "Regular Hours", "OT Hours", "OT Cost (AED)", "OT Days", "OT Ratio %"],
                  rows: data.rows.map((r) => [r.name, r.skill, `${r.regularHours}h`, `${r.otHours}h`, `AED ${r.otCost.toLocaleString()}`, r.otDays, `${r.otRatio}%`]),
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
            <StatCard title="Total OT Hours" value={`${data.totalOtHours}h`} icon={Clock} variant="warning" />
            <StatCard title="Total OT Cost" value={`AED ${data.totalOtCost.toLocaleString()}`} icon={DollarSign} variant="destructive" />
            <StatCard title="Employees with OT" value={data.employeesWithOt} icon={TrendingUp} variant="brand" />
            <StatCard title="Avg OT / Employee" value={`${data.avgOtPerEmployee}h`} icon={AlertTriangle} variant="default" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top OT Employees</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart layout="vertical" data={data.rows.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="h" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Legend />
                    <Bar dataKey="regularHours" stackId="a" fill="hsl(var(--brand))" name="Regular" />
                    <Bar dataKey="otHours" stackId="a" fill="hsl(var(--status-overtime))" name="OT" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Daily OT Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} unit="h" />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Line type="monotone" dataKey="otHours" stroke="hsl(var(--status-overtime))" strokeWidth={2} dot={{ r: 2 }} name="OT Hours" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Overtime Detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Skill</th>
                    <th className="text-right py-2 font-medium">Regular</th>
                    <th className="text-right py-2 font-medium">OT Hours</th>
                    <th className="text-right py-2 font-medium">OT Cost</th>
                    <th className="text-right py-2 font-medium">OT Days</th>
                    <th className="text-right py-2 font-medium">OT Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2 text-xs capitalize">{r.skill}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.regularHours}h</td>
                      <td className="py-2 text-right font-mono text-xs text-status-overtime font-medium">{r.otHours}h</td>
                      <td className="py-2 text-right font-mono text-xs">AED {r.otCost.toLocaleString()}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.otDays}</td>
                      <td className="py-2 text-right">
                        <Badge variant="outline" className={`text-[10px] ${r.otRatio > 20 ? "text-status-absent border-status-absent/30" : ""}`}>{r.otRatio}%</Badge>
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
