import { useState } from "react";
import { useExecutiveData } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  ChevronLeft, ChevronRight, Users, FolderKanban, Clock,
  DollarSign, Wrench, CalendarDays, TrendingUp, Briefcase, Download,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Executive() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useExecutiveData(month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Executive Summary</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>This Month</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)}><ChevronRight className="h-4 w-4" /></Button>
          {data && (
            <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => {
              const rows: (string | number)[][] = [
                ["Active Employees", data.activeEmployees],
                ["Active Projects", data.activeProjects],
                ["Assignments", data.totalAssignments],
                ["Unique Workers", data.uniqueWorkers],
                ["Total Hours", data.totalHours],
                ["OT Hours", data.totalOtHours],
                ["Labor Cost (AED)", data.totalLaborCost],
                ["Total Budget (AED)", data.totalBudget],
                ["", ""],
                ["Date", "Daily Cost (AED)"],
                ...data.costTrend.map((c) => [c.date, c.cost] as (string | number)[]),
              ];
              downloadCsv(`executive-${month}.csv`, ["Metric", "Value"], rows);
            }}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Active Employees" value={data.activeEmployees} icon={Users} variant="brand" />
            <StatCard title="Active Projects" value={data.activeProjects} icon={FolderKanban} variant="success" />
            <StatCard title="Assignments" value={data.totalAssignments} icon={CalendarDays} variant="default" />
            <StatCard title="Workers This Month" value={data.uniqueWorkers} icon={Wrench} variant="default" />
            <StatCard title="Total Hours" value={`${data.totalHours}h`} icon={Clock} variant="brand" />
            <StatCard title="OT Hours" value={`${data.totalOtHours}h`} icon={Clock} variant="warning" />
            <StatCard title="Labor Cost" value={`AED ${data.totalLaborCost.toLocaleString()}`} icon={DollarSign} variant="default" />
            <StatCard title="Total Budget" value={`AED ${data.totalBudget.toLocaleString()}`} icon={Briefcase} variant="default" subtitle={data.totalBudget > 0 ? `${Math.round((data.totalLaborCost / data.totalBudget) * 100)}% used` : undefined} />
          </div>

          {/* Daily Cost Trend */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Labor Cost Trend</CardTitle></CardHeader>
            <CardContent>
              {data.costTrend.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No cost data for this period</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
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

          {/* KPI Cards */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Daily Cost</p>
                <p className="text-2xl font-bold text-foreground">
                  AED {data.costTrend.length > 0 ? Math.round(data.costTrend.reduce((s, c) => s + c.cost, 0) / data.costTrend.length).toLocaleString() : 0}
                </p>
                <p className="text-xs text-muted-foreground">Per working day</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="p-5 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">OT Ratio</p>
                <p className="text-2xl font-bold text-status-overtime">
                  {data.totalHours > 0 ? Math.round((data.totalOtHours / data.totalHours) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">{data.totalOtHours}h overtime of {data.totalHours}h total</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
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
