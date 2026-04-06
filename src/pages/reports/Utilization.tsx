import { useState } from "react";
import { useUtilizationData } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ChevronLeft, ChevronRight, Users, Clock, BarChart3, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts";

const skillColors: Record<string, string> = {
  technician: "hsl(var(--brand))",
  helper: "hsl(var(--status-traveling))",
  supervisor: "hsl(var(--status-overtime))",
};

export default function Utilization() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useUtilizationData(month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Staff Utilization</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>This Month</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Avg Utilization" value={`${data.avgUtilization}%`} icon={TrendingUp} variant="brand" />
            <StatCard title="Employees" value={data.rows.length} icon={Users} variant="default" />
            <StatCard title="Total Hours" value={`${data.rows.reduce((s, r) => s + r.totalHours, 0)}h`} icon={Clock} variant="success" />
            <StatCard title="Skill Groups" value={data.bySkill.filter((s) => s.count > 0).length} icon={BarChart3} variant="default" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Utilization by Skill */}
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

            {/* Daily Hours Trend */}
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Hours Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(d) => d.split("-")[2]} />
                    <YAxis tick={{ fontSize: 11 }} unit="h" />
                    <Tooltip formatter={(v: number) => `${v}h`} />
                    <Line type="monotone" dataKey="hours" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Employee Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Employee Utilization</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Skill</th>
                    <th className="text-right py-2 font-medium">Days</th>
                    <th className="text-right py-2 font-medium">Hours</th>
                    <th className="text-right py-2 font-medium">Capacity</th>
                    <th className="text-right py-2 font-medium">Utilization</th>
                    <th className="py-2 font-medium w-[120px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.sort((a, b) => b.utilization - a.utilization).map((r) => (
                    <tr key={r.name} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2"><Badge variant="outline" className="text-[10px]">{r.skill_type}</Badge></td>
                      <td className="py-2 text-right font-mono text-xs">{r.daysWorked}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.totalHours}h</td>
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
        </>
      )}
    </div>
  );
}
