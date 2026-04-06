import { useState } from "react";
import { useManpowerReport } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Download, Users, Briefcase, AlertTriangle, CheckCircle } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

export default function ManpowerReport() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [branchFilter, setBranchFilter] = useState("all");
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useManpowerReport(month, { branchId: branchFilter });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Project Manpower</h1>
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
              downloadCsv(`manpower-${month}.csv`,
                ["Project", "Status", "Required", "Assigned", "Fill Rate %", "Tech", "Helpers", "Supervisors"],
                data.rows.map((r) => [r.name, r.status, r.required, r.assigned, r.fillRate, r.technicians, r.helpers, r.supervisors])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Project Manpower Report",
                subtitle: monthLabel,
                filename: `manpower-${month}.pdf`,
                summaryCards: [
                  { label: "Active Projects", value: String(data.totalProjects) },
                  { label: "Total Required", value: String(data.totalRequired) },
                  { label: "Avg Fill Rate", value: `${data.avgFillRate}%` },
                  { label: "Understaffed", value: String(data.understaffed) },
                ],
                tables: [{
                  title: "Staffing Detail",
                  headers: ["Project", "Status", "Required", "Assigned", "Fill Rate %", "Tech", "Helpers", "Supervisors"],
                  rows: data.rows.map((r) => [r.name, r.status, r.required, r.assigned, `${r.fillRate}%`, r.technicians, r.helpers, r.supervisors]),
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
            <StatCard title="Active Projects" value={data.totalProjects} icon={Briefcase} variant="brand" />
            <StatCard title="Total Required" value={data.totalRequired} icon={Users} variant="default" />
            <StatCard title="Avg Fill Rate" value={`${data.avgFillRate}%`} icon={CheckCircle} variant={data.avgFillRate >= 80 ? "success" : "warning"} />
            <StatCard title="Understaffed" value={data.understaffed} icon={AlertTriangle} variant={data.understaffed > 0 ? "destructive" : "success"} />
          </div>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Required vs Assigned by Project</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, data.rows.length * 40)}>
                <BarChart layout="vertical" data={data.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="required" fill="hsl(var(--muted-foreground))" name="Required" opacity={0.4} />
                  <Bar dataKey="assigned" fill="hsl(var(--brand))" name="Assigned" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Skill Breakdown by Project</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, data.rows.length * 40)}>
                <BarChart layout="vertical" data={data.rows}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="supervisors" stackId="a" fill="hsl(var(--status-overtime))" name="Supervisors" />
                  <Bar dataKey="technicians" stackId="a" fill="hsl(var(--brand))" name="Technicians" />
                  <Bar dataKey="helpers" stackId="a" fill="hsl(var(--status-present))" name="Helpers" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Staffing Detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Project</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-center py-2 font-medium">Required</th>
                    <th className="text-center py-2 font-medium">Assigned</th>
                    <th className="text-center py-2 font-medium">Fill Rate</th>
                    <th className="text-center py-2 font-medium">Tech</th>
                    <th className="text-center py-2 font-medium">Help</th>
                    <th className="text-center py-2 font-medium">Sup</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2"><Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge></td>
                      <td className="py-2 text-center font-mono text-xs">{r.required}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.assigned}</td>
                      <td className="py-2 text-center">
                        <Badge variant="outline" className={`text-[10px] ${r.fillRate >= 100 ? "text-status-present border-status-present/30" : r.fillRate >= 70 ? "text-brand border-brand/30" : "text-status-absent border-status-absent/30"}`}>{r.fillRate}%</Badge>
                      </td>
                      <td className="py-2 text-center font-mono text-xs">{r.technicians}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.helpers}</td>
                      <td className="py-2 text-center font-mono text-xs">{r.supervisors}</td>
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
