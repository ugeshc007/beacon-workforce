import { useState, useMemo } from "react";
import { useCostData, type CostProjectRow } from "@/hooks/useReports";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DollarSign, TrendingDown, TrendingUp,
  Download, Percent, Building2,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid, ReferenceLine,
} from "recharts";

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

  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [drillProject, setDrillProject] = useState<CostProjectRow | null>(null);

  const { data, isLoading } = useCostData(month, {
    status: statusFilter,
    branchId: branchFilter,
  });

  const handleBarClick = (barData: any) => {
    if (!data || !barData?.activePayload?.[0]) return;
    const payload = barData.activePayload[0].payload;
    const row = data.byProject.find((p) => p.name === payload.name || p.name === payload.fullName);
    if (row) setDrillProject(row);
  };

  const profitableProjects = useMemo(() => {
    if (!data) return [];
    return data.byProject.filter((p) => p.projectValue > 0);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Project Costs</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonthOffset(0)}>This Month</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonthOffset((m) => m + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => {
              downloadCsv(`project-costs-${month}.csv`,
                ["Project", "Status", "Budget", "Labor", "OT", "Expenses", "Total", "Variance", "% Used", "Forecasted Final", "Value", "Margin %"],
                data.byProject.map((p) => [p.name, p.status, p.budget, p.laborCost, p.otCost, p.expenses, p.totalCost, p.variance, p.pctUsed, p.forecastedFinal, p.projectValue, p.margin])
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Project Costs Report",
                subtitle: monthLabel,
                filename: `project-costs-${month}.pdf`,
                summaryCards: [
                  { label: "Total Cost", value: `AED ${data.totalCost.toLocaleString()}` },
                  { label: "Total Budget", value: `AED ${data.totalBudget.toLocaleString()}` },
                  { label: "Labor Cost", value: `AED ${data.totalLabor.toLocaleString()}` },
                  { label: "OT Cost", value: `AED ${data.totalOt.toLocaleString()}` },
                ],
                tables: [{
                  title: "Budget vs Actual",
                  headers: ["Project", "Status", "Budget", "Labor", "OT", "Expenses", "Total", "Variance", "% Used"],
                  rows: data.byProject.map((p) => [p.name, p.status, `AED ${p.budget.toLocaleString()}`, `AED ${p.laborCost.toLocaleString()}`, `AED ${p.otCost.toLocaleString()}`, `AED ${p.expenses.toLocaleString()}`, `AED ${p.totalCost.toLocaleString()}`, `AED ${p.variance.toLocaleString()}`, `${p.pctUsed}%`]),
                }],
              });
            }}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
          </>)}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {(data?.branches ?? []).map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Cost" value={`AED ${data.totalCost.toLocaleString()}`} icon={DollarSign} variant="brand" />
            <StatCard title="Total Budget" value={`AED ${data.totalBudget.toLocaleString()}`} icon={TrendingDown} variant="default" />
            <StatCard title="Labor Cost" value={`AED ${data.totalLabor.toLocaleString()}`} icon={DollarSign} variant="success" />
            <StatCard title="OT Cost" value={`AED ${data.totalOt.toLocaleString()}`} icon={TrendingUp} variant="destructive" />
          </div>

          {/* Row 1: Horizontal bar (project vs cost) + Pie (categories) */}
          <div className="grid lg:grid-cols-3 gap-6">
            <Card className="glass-card lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost by Project (click to drill down)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, data.byProject.length * 32)}>
                  <BarChart layout="vertical" data={data.byProject.map((p) => ({
                    ...p,
                    fullName: p.name,
                    name: p.name.length > 16 ? p.name.slice(0, 14) + "…" : p.name,
                  }))} onClick={handleBarClick} className="cursor-pointer">
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Bar dataKey="laborCost" stackId="a" fill="hsl(var(--brand))" name="Labor" />
                    <Bar dataKey="otCost" stackId="a" fill="hsl(var(--status-overtime))" name="Overtime" />
                    <Bar dataKey="expenses" stackId="a" fill="hsl(var(--status-traveling))" name="Expenses" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost by Category</CardTitle></CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={data.byCategory} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={85} cx="50%" cy="50%" paddingAngle={3}>
                      {data.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Legend verticalAlign="bottom" iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Cost trend line + Stacked daily */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Cost Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={data.costTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Line type="monotone" dataKey="total" stroke="hsl(var(--brand))" strokeWidth={2} dot={false} name="Total" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Daily Stacked (Labor + OT + Expenses)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.costTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} />
                    <Bar dataKey="labor" stackId="a" fill="hsl(var(--brand))" name="Labor" />
                    <Bar dataKey="ot" stackId="a" fill="hsl(var(--status-overtime))" name="OT" />
                    <Bar dataKey="expenses" stackId="a" fill="hsl(var(--status-traveling))" name="Expenses" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Budget vs Actual Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Budget vs Actual</CardTitle></CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[900px] p-4 pt-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 font-medium">Project</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-right py-2 font-medium">Budget</th>
                        <th className="text-right py-2 font-medium">Actual</th>
                        <th className="text-right py-2 font-medium">Variance</th>
                        <th className="text-right py-2 font-medium">% Used</th>
                        <th className="text-right py-2 font-medium">Forecasted Final</th>
                        <th className="py-2 font-medium w-[100px]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byProject.map((p) => (
                        <tr key={p.id} className="border-b border-border/30 cursor-pointer hover:bg-accent/20" onClick={() => setDrillProject(p)}>
                          <td className="py-2 font-medium text-foreground">{p.name}</td>
                          <td className="py-2"><Badge variant="outline" className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge></td>
                          <td className="py-2 text-right font-mono text-xs">{p.budget > 0 ? `AED ${p.budget.toLocaleString()}` : "—"}</td>
                          <td className="py-2 text-right font-mono text-xs font-medium">{p.totalCost > 0 ? `AED ${p.totalCost.toLocaleString()}` : "—"}</td>
                          <td className={`py-2 text-right font-mono text-xs font-medium ${p.variance >= 0 ? "text-status-present" : "text-status-absent"}`}>
                            {p.budget > 0 ? `${p.variance >= 0 ? "+" : ""}AED ${p.variance.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2 text-right">
                            {p.budget > 0 ? (
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-14 h-2 rounded-full bg-muted overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${p.pctUsed > 100 ? "bg-status-absent" : p.pctUsed > 80 ? "bg-status-overtime" : "bg-brand"}`}
                                    style={{ width: `${Math.min(p.pctUsed, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-xs">{p.pctUsed}%</span>
                              </div>
                            ) : "—"}
                          </td>
                          <td className={`py-2 text-right font-mono text-xs font-medium ${p.forecastedFinal > p.budget && p.budget > 0 ? "text-status-absent" : "text-foreground"}`}>
                            {p.budget > 0 ? `AED ${p.forecastedFinal.toLocaleString()}` : "—"}
                          </td>
                          <td className="py-2">
                            <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={(e) => { e.stopPropagation(); setDrillProject(p); }}>
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                        <td className="py-2" colSpan={2}>Totals ({data.byProject.length})</td>
                        <td className="py-2 text-right font-mono text-xs">AED {data.totalBudget.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-xs">AED {data.totalCost.toLocaleString()}</td>
                        <td className={`py-2 text-right font-mono text-xs ${data.totalBudget - data.totalCost >= 0 ? "text-status-present" : "text-status-absent"}`}>
                          {data.totalBudget > 0 ? `${data.totalBudget - data.totalCost >= 0 ? "+" : ""}AED ${(data.totalBudget - data.totalCost).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-2 text-right font-mono text-xs">
                          {data.totalBudget > 0 ? `${Math.round((data.totalCost / data.totalBudget) * 100)}%` : "—"}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Profitability Table */}
          {profitableProjects.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent className="h-4 w-4 text-brand" /> Profitability Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 font-medium">Project</th>
                      <th className="text-right py-2 font-medium">Value</th>
                      <th className="text-right py-2 font-medium">Total Cost</th>
                      <th className="text-right py-2 font-medium">Gross Profit</th>
                      <th className="text-right py-2 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitableProjects.sort((a, b) => b.margin - a.margin).map((p) => (
                      <tr key={p.id} className="border-b border-border/30 cursor-pointer hover:bg-accent/20" onClick={() => setDrillProject(p)}>
                        <td className="py-2 font-medium text-foreground">{p.name}</td>
                        <td className="py-2 text-right font-mono text-xs">AED {p.projectValue.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-xs">AED {p.totalCost.toLocaleString()}</td>
                        <td className={`py-2 text-right font-mono text-xs font-medium ${p.grossProfit >= 0 ? "text-status-present" : "text-status-absent"}`}>
                          {p.grossProfit >= 0 ? "+" : ""}AED {p.grossProfit.toLocaleString()}
                        </td>
                        <td className={`py-2 text-right font-mono text-xs font-bold ${p.margin >= 0 ? "text-status-present" : "text-status-absent"}`}>
                          {p.margin}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Drill-down Dialog */}
          <Dialog open={!!drillProject} onOpenChange={(o) => { if (!o) setDrillProject(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand" /> {drillProject?.name}
                </DialogTitle>
                <DialogDescription>
                  {monthLabel} · {drillProject?.status?.replace("_", " ")}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Labor</p>
                  <p className="text-lg font-bold">AED {drillProject?.laborCost.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
                  <p className="text-lg font-bold text-status-overtime">AED {drillProject?.otCost.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Expenses</p>
                  <p className="text-lg font-bold">AED {drillProject?.expenses.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                  <p className="text-lg font-bold">AED {drillProject?.totalCost.toLocaleString()}</p>
                </div>
                {drillProject && drillProject.budget > 0 && (
                  <>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Budget Used</p>
                      <p className={`text-lg font-bold ${drillProject.pctUsed > 100 ? "text-status-absent" : "text-foreground"}`}>{drillProject.pctUsed}%</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Forecast</p>
                      <p className={`text-lg font-bold ${drillProject.forecastedFinal > drillProject.budget ? "text-status-absent" : "text-status-present"}`}>
                        AED {drillProject.forecastedFinal.toLocaleString()}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Daily costs chart */}
              {drillProject && drillProject.dailyCosts.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Daily Cost Breakdown</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={drillProject.dailyCosts}>
                      <XAxis dataKey="date" tick={{ fontSize: 8 }} tickFormatter={(d) => d.split("-")[2]} />
                      <YAxis tick={{ fontSize: 9 }} />
                      <Tooltip formatter={(v: number) => `AED ${v.toLocaleString()}`} labelFormatter={(l) => l} />
                      <Bar dataKey="labor" stackId="a" fill="hsl(var(--brand))" name="Labor" />
                      <Bar dataKey="ot" stackId="a" fill="hsl(var(--status-overtime))" name="OT" />
                      <Bar dataKey="expenses" stackId="a" fill="hsl(var(--status-traveling))" name="Expenses" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Daily records table */}
              {drillProject && drillProject.dailyCosts.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-1.5 font-medium">Date</th>
                        <th className="text-right py-1.5 font-medium">Labor</th>
                        <th className="text-right py-1.5 font-medium">OT</th>
                        <th className="text-right py-1.5 font-medium">Expenses</th>
                        <th className="text-right py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drillProject.dailyCosts.map((dc) => (
                        <tr key={dc.date} className="border-b border-border/30">
                          <td className="py-1.5 font-mono text-xs">{dc.date.split("-").reverse().join("/")}</td>
                          <td className="py-1.5 text-right font-mono text-xs">{dc.labor > 0 ? dc.labor.toLocaleString() : "—"}</td>
                          <td className="py-1.5 text-right font-mono text-xs text-status-overtime">{dc.ot > 0 ? dc.ot.toLocaleString() : "—"}</td>
                          <td className="py-1.5 text-right font-mono text-xs">{dc.expenses > 0 ? dc.expenses.toLocaleString() : "—"}</td>
                          <td className="py-1.5 text-right font-mono text-xs font-medium">{(dc.labor + dc.ot + dc.expenses).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
