import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  DollarSign, TrendingUp, AlertTriangle, BarChart3, PieChart,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, Legend,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--status-overtime))",
  "hsl(var(--status-traveling))",
  "hsl(var(--status-present))",
  "hsl(var(--status-absent))",
  "hsl(var(--accent))",
  "#8b5cf6",
];

interface Props {
  project: {
    budget: number | null;
    project_value: number | null;
    start_date: string | null;
    end_date: string | null;
  };
  costs: {
    totalLabor: number;
    totalOT: number;
    totalApprovedExpenses: number;
    totalPendingExpenses: number;
    totalCost: number;
    byCategory: Record<string, number>;
    weeklyData: { week: string; labor: number; overtime: number; expenses: number }[];
    dailyData: { date: string; labor: number; overtime: number; expenses: number; records: any[] }[];
    daysWithCost: number;
  } | undefined;
}

export function ProjectCostsTab({ project, costs }: Props) {
  const [drillDate, setDrillDate] = useState<string | null>(null);

  // Forecast
  const forecast = useMemo(() => {
    if (!costs || !project.start_date || !project.end_date || costs.daysWithCost === 0) return null;
    const end = new Date(project.end_date + "T00:00:00");
    const today = new Date();
    const remainingDays = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000));
    const avgDaily = costs.totalCost / costs.daysWithCost;
    const projectedFinal = costs.totalCost + (avgDaily * remainingDays);
    return { remainingDays, avgDaily: Math.round(avgDaily), projectedFinal: Math.round(projectedFinal) };
  }, [costs, project]);

  // Profitability
  const profitability = useMemo(() => {
    if (!costs || !project.project_value) return null;
    const grossMargin = project.project_value - costs.totalCost;
    const marginPct = (grossMargin / project.project_value) * 100;
    return { grossMargin: Math.round(grossMargin), marginPct: Math.round(marginPct) };
  }, [costs, project]);

  // Pie data
  const pieData = useMemo(() => {
    if (!costs) return [];
    const items: { name: string; value: number }[] = [];
    if (costs.totalLabor > 0) items.push({ name: "Labor", value: Math.round(costs.totalLabor) });
    if (costs.totalOT > 0) items.push({ name: "Overtime", value: Math.round(costs.totalOT) });
    for (const [cat, amt] of Object.entries(costs.byCategory)) {
      if (amt > 0) items.push({ name: cat.charAt(0).toUpperCase() + cat.slice(1), value: Math.round(amt) });
    }
    return items;
  }, [costs]);

  // Weekly chart data
  const weeklyChart = useMemo(() => {
    return costs.weeklyData.map((w) => ({
      ...w,
      week: new Date(w.week + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      labor: Math.round(w.labor),
      overtime: Math.round(w.overtime),
      expenses: Math.round(w.expenses),
    }));
  }, [costs]);

  // Budget vs actual bar
  const budgetChart = useMemo(() => {
    if (!project.budget) return null;
    const items = [
      { name: "Labor", actual: Math.round(costs.totalLabor), budget: 0 },
      { name: "Overtime", actual: Math.round(costs.totalOT), budget: 0 },
      { name: "Expenses", actual: Math.round(costs.totalApprovedExpenses), budget: 0 },
      { name: "Total", actual: Math.round(costs.totalCost), budget: Math.round(project.budget) },
    ];
    if (forecast) items.push({ name: "Forecast", actual: forecast.projectedFinal, budget: Math.round(project.budget) });
    return items;
  }, [costs, project, forecast]);

  // Drill-down records
  const drillRecords = useMemo(() => {
    if (!drillDate) return null;
    return costs.dailyData.find((d) => d.date === drillDate) ?? null;
  }, [drillDate, costs]);

  const costCards = [
    { label: "Regular Labor", value: costs.totalLabor, color: "text-foreground" },
    { label: "Overtime", value: costs.totalOT, color: "text-status-overtime" },
    { label: "Expenses", value: costs.totalApprovedExpenses, color: "text-status-traveling" },
    { label: "Total Cost", value: costs.totalCost, color: "text-foreground" },
  ];

  return (
    <div className="space-y-4">
      {/* Cost breakdown cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {costCards.map((c) => (
          <Card key={c.label} className="glass-card">
            <CardContent className="p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <p className={cn("text-lg font-bold font-mono", c.color)}>AED {c.value.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget progress */}
      {project.budget && (
        <Card className="glass-card">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Budget Utilization</span>
              <span className="font-mono font-medium">
                AED {costs.totalCost.toLocaleString()} / {project.budget.toLocaleString()}
              </span>
            </div>
            {(() => {
              const pct = Math.min((costs.totalCost / project.budget!) * 100, 100);
              const over = costs.totalCost > project.budget!;
              return (
                <div className="space-y-1">
                  <Progress value={pct} className={cn("h-2", over && "[&>div]:bg-destructive")} />
                  <p className={cn("text-xs font-mono text-right", over ? "text-destructive" : "text-muted-foreground")}>
                    {Math.round(pct)}% {over && "— Over budget!"}
                  </p>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Forecast + Profitability */}
      <div className="grid md:grid-cols-2 gap-4">
        {forecast && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Cost Forecast</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Avg Daily Spend</span><span className="font-mono">AED {forecast.avgDaily.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Remaining Days</span><span className="font-mono">{forecast.remainingDays}</span></div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Projected Final Cost</span>
                <span className={cn("font-mono", project.budget && forecast.projectedFinal > project.budget ? "text-destructive" : "text-foreground")}>
                  AED {forecast.projectedFinal.toLocaleString()}
                  {project.budget && forecast.projectedFinal > project.budget && (
                    <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {profitability && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Profitability</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Project Value</span><span className="font-mono">AED {project.project_value!.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Cost</span><span className="font-mono">AED {costs.totalCost.toLocaleString()}</span></div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Gross Margin</span>
                <span className={cn("font-mono", profitability.grossMargin < 0 ? "text-destructive" : "text-status-present")}>
                  AED {profitability.grossMargin.toLocaleString()} ({profitability.marginPct}%)
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Stacked bar: Labor + OT + Expenses per week */}
        {weeklyChart.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Weekly Cost Breakdown</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyChart} onClick={(e) => {
                  if (e?.activePayload?.[0]?.payload) {
                    // Find a date in that week for drill-down
                    const weekLabel = e.activePayload[0].payload.week;
                    const match = costs.weeklyData.find((w) => {
                      const formatted = new Date(w.week + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                      return formatted === weekLabel;
                    });
                    if (match) {
                      const firstDate = costs.dailyData.find((d) => d.date >= match.week);
                      if (firstDate) setDrillDate(firstDate.date);
                    }
                  }
                }}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => `AED ${v.toLocaleString()}`}
                  />
                  <Bar dataKey="labor" stackId="a" fill="hsl(var(--primary))" name="Labor" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overtime" stackId="a" fill="hsl(var(--status-overtime))" name="Overtime" />
                  <Bar dataKey="expenses" stackId="a" fill="hsl(var(--status-traveling))" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Pie: category breakdown */}
        {pieData.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" /> Cost Distribution</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={40}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </RechartsPie>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Budget vs Actual bar */}
      {budgetChart && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Budget vs Actual</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={budgetChart} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={70} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => `AED ${v.toLocaleString()}`}
                />
                <Bar dataKey="actual" fill="hsl(var(--primary))" name="Actual" radius={[0, 4, 4, 0]} />
                <Bar dataKey="budget" fill="hsl(var(--muted-foreground))" name="Budget" radius={[0, 4, 4, 0]} opacity={0.3} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Expense categories */}
      {Object.keys(costs.byCategory).length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Expense Categories</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(costs.byCategory).sort(([, a], [, b]) => b - a).map(([cat, amount]) => (
              <div key={cat} className="flex items-center justify-between text-sm">
                <Badge variant="outline" className="text-[10px] capitalize">{cat}</Badge>
                <span className="font-mono text-muted-foreground">AED {amount.toLocaleString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {costs.totalPendingExpenses > 0 && (
        <p className="text-xs text-status-traveling">⚠ AED {costs.totalPendingExpenses.toLocaleString()} in pending expenses awaiting approval</p>
      )}

      {/* Drill-down panel */}
      {drillDate && drillRecords && (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">
                Daily Detail — {new Date(drillDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </CardTitle>
              <button onClick={() => setDrillDate(null)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
              <div className="rounded-lg border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Labor</p>
                <p className="font-mono font-bold">AED {Math.round(drillRecords.labor).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Overtime</p>
                <p className="font-mono font-bold text-status-overtime">AED {Math.round(drillRecords.overtime).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Expenses</p>
                <p className="font-mono font-bold">AED {Math.round(drillRecords.expenses).toLocaleString()}</p>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-1 font-medium">Type</th>
                  <th className="text-left py-1 font-medium">Detail</th>
                  <th className="text-right py-1 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {drillRecords.records.map((r: any, i: number) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-1.5"><Badge variant="outline" className="text-[9px]">{r.type}</Badge></td>
                    <td className="py-1.5 text-muted-foreground">
                      {r.type === "labor" ? `${r.employee} (${r.minutes ?? 0}m)` : `${r.category}: ${r.description ?? "—"}`}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      AED {r.type === "labor" ? (r.regular + r.ot).toLocaleString() : r.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Navigate daily */}
            <div className="flex items-center justify-between mt-3">
              <button
                className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={costs.dailyData.findIndex((d) => d.date === drillDate) <= 0}
                onClick={() => {
                  const idx = costs.dailyData.findIndex((d) => d.date === drillDate);
                  if (idx > 0) setDrillDate(costs.dailyData[idx - 1].date);
                }}
              >← Previous day</button>
              <button
                className="text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                disabled={costs.dailyData.findIndex((d) => d.date === drillDate) >= costs.dailyData.length - 1}
                onClick={() => {
                  const idx = costs.dailyData.findIndex((d) => d.date === drillDate);
                  if (idx < costs.dailyData.length - 1) setDrillDate(costs.dailyData[idx + 1].date);
                }}
              >Next day →</button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
