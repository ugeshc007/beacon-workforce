import { useState } from "react";
import { useCostData } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ChevronLeft, ChevronRight, DollarSign, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const PIE_COLORS = [
  "hsl(var(--brand))",
  "hsl(var(--status-overtime))",
  "hsl(var(--status-traveling))",
  "hsl(var(--status-present))",
  "hsl(var(--status-absent))",
  "hsl(var(--muted-foreground))",
];

export default function CostReports() {
  const now = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const month = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = target.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const { data, isLoading } = useCostData(month);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Project Costs</h1>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard title="Total Cost" value={`AED ${data.totalCost.toLocaleString()}`} icon={DollarSign} variant="brand" />
            <StatCard title="Projects" value={data.byProject.length} icon={TrendingDown} variant="default" />
            <StatCard title="Categories" value={data.byCategory.length} icon={DollarSign} variant="default" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Cost by Category */}
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost Breakdown by Category</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data.byCategory} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={90} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {data.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost by Project */}
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost by Project</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.byProject} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Bar dataKey="laborCost" stackId="a" fill="hsl(var(--brand))" name="Labor" />
                    <Bar dataKey="otCost" stackId="a" fill="hsl(var(--status-overtime))" name="Overtime" />
                    <Bar dataKey="expenses" stackId="a" fill="hsl(var(--status-traveling))" name="Expenses" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Budget vs Actual Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs Actual</CardTitle></CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Project</th>
                    <th className="text-right py-2 font-medium">Budget</th>
                    <th className="text-right py-2 font-medium">Labor</th>
                    <th className="text-right py-2 font-medium">OT</th>
                    <th className="text-right py-2 font-medium">Expenses</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byProject.map((p) => {
                    const variance = p.budget - p.totalCost;
                    return (
                      <tr key={p.name} className="border-b border-border/30">
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="py-2 text-right font-mono text-xs">{p.budget > 0 ? `AED ${p.budget.toLocaleString()}` : "—"}</td>
                        <td className="py-2 text-right font-mono text-xs">{p.laborCost > 0 ? p.laborCost.toLocaleString() : "—"}</td>
                        <td className="py-2 text-right font-mono text-xs text-status-overtime">{p.otCost > 0 ? p.otCost.toLocaleString() : "—"}</td>
                        <td className="py-2 text-right font-mono text-xs">{p.expenses > 0 ? p.expenses.toLocaleString() : "—"}</td>
                        <td className="py-2 text-right font-mono text-xs font-medium">{p.totalCost > 0 ? `AED ${p.totalCost.toLocaleString()}` : "—"}</td>
                        <td className={`py-2 text-right font-mono text-xs font-medium ${variance >= 0 ? "text-status-present" : "text-status-absent"}`}>
                          {p.budget > 0 ? `${variance >= 0 ? "+" : ""}AED ${variance.toLocaleString()}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
