import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, MapPin, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  pending: "hsl(var(--muted-foreground))",
  in_progress: "hsl(var(--brand))",
  completed: "hsl(var(--status-present))",
  cancelled: "hsl(var(--status-absent))",
  converted: "hsl(var(--status-overtime))",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  converted: "Converted",
};

export default function SiteVisitsReport() {
  const [dateRange, setDateRange] = useReportDateRange("This Month");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["site-visits-report", dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: visits, error } = await supabase
        .from("site_visits")
        .select(`
          id, client_name, site_address, visit_date, status, priority,
          project_type, lead_source, completed_at, converted_to_project_id,
          assigned_employee_id,
          employees:assigned_employee_id ( name ),
          branches:branch_id ( id, name )
        `)
        .gte("visit_date", dateRange.start)
        .lte("visit_date", dateRange.end)
        .order("visit_date", { ascending: false });

      if (error) throw error;
      return visits ?? [];
    },
  });

  const filtered = useMemo(
    () => (data ?? []).filter((v) => statusFilter === "all" || v.status === statusFilter),
    [data, statusFilter]
  );

  const stats = useMemo(() => {
    const all = data ?? [];
    const total = all.length;
    const completed = all.filter((v) => v.status === "completed" || v.status === "converted").length;
    const converted = all.filter((v) => v.status === "converted").length;
    const pending = all.filter((v) => v.status === "pending" || v.status === "in_progress").length;
    const conversionRate = completed > 0 ? Math.round((converted / completed) * 100) : 0;

    const byStatus = ["pending", "in_progress", "completed", "cancelled", "converted"].map((s) => ({
      name: STATUS_LABEL[s],
      value: all.filter((v) => v.status === s).length,
      key: s,
    })).filter((x) => x.value > 0);

    const byEmployee: Record<string, { name: string; total: number; completed: number; converted: number }> = {};
    all.forEach((v) => {
      const empName = (v.employees as any)?.name ?? "Unassigned";
      if (!byEmployee[empName]) byEmployee[empName] = { name: empName, total: 0, completed: 0, converted: 0 };
      byEmployee[empName].total += 1;
      if (v.status === "completed" || v.status === "converted") byEmployee[empName].completed += 1;
      if (v.status === "converted") byEmployee[empName].converted += 1;
    });
    const employeeRows = Object.values(byEmployee).sort((a, b) => b.total - a.total);

    return { total, completed, converted, pending, conversionRate, byStatus, employeeRows };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Site Visits Report</h1>
          <p className="text-sm text-muted-foreground">{dateRange.label}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
          {data && data.length > 0 && (<>
            <Button variant="outline" size="sm" className="text-xs ml-1" onClick={() => {
              downloadCsv(`site-visits-${dateRange.start}.csv`,
                ["Date", "Client", "Address", "Assigned To", "Status", "Priority", "Project Type", "Lead Source"],
                filtered.map((v) => [
                  v.visit_date, v.client_name, v.site_address ?? "", (v.employees as any)?.name ?? "Unassigned",
                  STATUS_LABEL[v.status] ?? v.status, v.priority, v.project_type ?? "", v.lead_source ?? "",
                ])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Site Visits Report",
                subtitle: dateRange.label,
                filename: `site-visits-${dateRange.start}.pdf`,
                summaryCards: [
                  { label: "Total Visits", value: String(stats.total) },
                  { label: "Completed", value: String(stats.completed) },
                  { label: "Converted", value: String(stats.converted) },
                  { label: "Conversion Rate", value: `${stats.conversionRate}%` },
                ],
                tables: [
                  {
                    title: "Visit Detail",
                    headers: ["Date", "Client", "Address", "Assigned To", "Status", "Priority", "Project Type"],
                    rows: filtered.map((v) => [
                      v.visit_date, v.client_name, v.site_address ?? "—", (v.employees as any)?.name ?? "Unassigned",
                      STATUS_LABEL[v.status] ?? v.status, v.priority, v.project_type ?? "—",
                    ]),
                  },
                  {
                    title: "By Employee",
                    headers: ["Employee", "Total", "Completed", "Converted"],
                    rows: stats.employeeRows.map((r) => [r.name, r.total, r.completed, r.converted]),
                  },
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
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Visits" value={stats.total} icon={MapPin} variant="brand" />
            <StatCard title="Completed" value={stats.completed} icon={CheckCircle} variant="success" />
            <StatCard title="Pending / In Progress" value={stats.pending} icon={Clock} variant="warning" />
            <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} variant="default" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-sm">Visits by Status</CardTitle></CardHeader>
              <CardContent className="h-64">
                {stats.byStatus.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.byStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {stats.byStatus.map((entry) => (
                          <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader><CardTitle className="text-sm">Top Employees by Visits</CardTitle></CardHeader>
              <CardContent className="h-64">
                {stats.employeeRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No data</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.employeeRows.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }} />
                      <Legend />
                      <Bar dataKey="total" name="Total" fill="hsl(var(--brand))" />
                      <Bar dataKey="completed" name="Completed" fill="hsl(var(--status-present))" />
                      <Bar dataKey="converted" name="Converted" fill="hsl(var(--status-overtime))" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card">
            <CardHeader><CardTitle className="text-sm">Visit Detail ({filtered.length})</CardTitle></CardHeader>
            <CardContent>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4">No visits in this range.</p>
              ) : (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="text-xs">{v.visit_date}</TableCell>
                          <TableCell className="text-xs font-medium">{v.client_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{v.site_address ?? "—"}</TableCell>
                          <TableCell className="text-xs">{(v.employees as any)?.name ?? "Unassigned"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[v.status] ?? v.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize">{v.priority}</TableCell>
                          <TableCell className="text-xs">{v.project_type ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
