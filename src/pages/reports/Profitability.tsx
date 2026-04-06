import { useProfitabilityData } from "@/hooks/useReports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { DollarSign, TrendingUp, TrendingDown, Percent, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";

export default function Profitability() {
  const { data, isLoading } = useProfitabilityData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Project Profitability</h1>
          <p className="text-sm text-muted-foreground">Budget vs actual cost with margin analysis</p>
        </div>
        {data && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {
            downloadCsv("profitability.csv",
              ["Project", "Status", "Value (AED)", "Budget (AED)", "Labor", "OT", "Expenses", "Total Cost", "Gross Profit", "Margin %", "Budget Variance", "Budget Used %"],
              data.rows.map((r) => [r.name, r.status, r.projectValue, r.budget, r.laborCost, r.otCost, r.expenseCost, r.totalCost, r.grossProfit, r.margin, r.budgetVariance, r.budgetUsedPct])
            );
          }}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Total Revenue" value={`AED ${data.totals.value.toLocaleString()}`} icon={DollarSign} variant="brand" />
            <StatCard title="Total Cost" value={`AED ${data.totals.cost.toLocaleString()}`} icon={TrendingDown} variant="warning" />
            <StatCard title="Gross Profit" value={`AED ${data.totals.profit.toLocaleString()}`} icon={TrendingUp} variant={data.totals.profit >= 0 ? "success" : "destructive"} />
            <StatCard title="Avg Margin" value={`${data.avgMargin}%`} icon={Percent} variant="brand" subtitle={`${data.profitable} of ${data.rows.length} profitable`} />
          </div>

          {/* Margin Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Gross Margin by Project</CardTitle></CardHeader>
            <CardContent>
              {data.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No projects found</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, data.rows.length * 40)}>
                  <BarChart data={data.rows.sort((a, b) => b.margin - a.margin)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} domain={["auto", "auto"]} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(l) => `Project: ${l}`} />
                    <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Bar dataKey="margin" name="Margin" radius={[0, 4, 4, 0]}>
                      {data.rows.sort((a, b) => b.margin - a.margin).map((r, i) => (
                        <Cell key={i} fill={r.margin >= 0 ? "hsl(var(--status-present))" : "hsl(var(--status-absent))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Budget Consumption Chart */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Budget Consumption</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(200, data.rows.filter((r) => r.budget > 0).length * 40)}>
                <BarChart data={data.rows.filter((r) => r.budget > 0).sort((a, b) => b.budgetUsedPct - a.budgetUsedPct)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, "auto"]} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <ReferenceLine x={100} stroke="hsl(var(--status-absent))" strokeDasharray="3 3" label={{ value: "Budget", fontSize: 10, fill: "hsl(var(--status-absent))" }} />
                  <Bar dataKey="budgetUsedPct" name="Used" radius={[0, 4, 4, 0]}>
                    {data.rows.filter((r) => r.budget > 0).sort((a, b) => b.budgetUsedPct - a.budgetUsedPct).map((r, i) => (
                      <Cell key={i} fill={r.budgetUsedPct > 100 ? "hsl(var(--status-absent))" : r.budgetUsedPct > 80 ? "hsl(var(--status-overtime))" : "hsl(var(--brand))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Project Profitability Detail</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Project</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Value</th>
                    <th className="text-right py-2 font-medium">Budget</th>
                    <th className="text-right py-2 font-medium">Total Cost</th>
                    <th className="text-right py-2 font-medium">Gross Profit</th>
                    <th className="text-right py-2 font-medium">Margin</th>
                    <th className="text-right py-2 font-medium">Budget Used</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.sort((a, b) => b.margin - a.margin).map((r) => (
                    <tr key={r.name} className="border-b border-border/30">
                      <td className="py-2 font-medium text-foreground">{r.name}</td>
                      <td className="py-2"><Badge variant="outline" className="text-[10px] capitalize">{r.status}</Badge></td>
                      <td className="py-2 text-right font-mono text-xs">{r.projectValue > 0 ? `AED ${r.projectValue.toLocaleString()}` : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.budget > 0 ? `AED ${r.budget.toLocaleString()}` : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs">{r.totalCost > 0 ? `AED ${r.totalCost.toLocaleString()}` : "—"}</td>
                      <td className={`py-2 text-right font-mono text-xs font-medium ${r.grossProfit >= 0 ? "text-status-present" : "text-status-absent"}`}>
                        {r.projectValue > 0 ? `${r.grossProfit >= 0 ? "+" : ""}AED ${r.grossProfit.toLocaleString()}` : "—"}
                      </td>
                      <td className={`py-2 text-right font-mono text-xs font-medium ${r.margin >= 0 ? "text-status-present" : "text-status-absent"}`}>
                        {r.projectValue > 0 ? `${r.margin}%` : "—"}
                      </td>
                      <td className="py-2 text-right">
                        {r.budget > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${r.budgetUsedPct > 100 ? "bg-status-absent" : r.budgetUsedPct > 80 ? "bg-status-overtime" : "bg-brand"}`}
                                style={{ width: `${Math.min(r.budgetUsedPct, 100)}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs">{r.budgetUsedPct}%</span>
                          </div>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-medium">
                    <td className="py-2 text-foreground" colSpan={2}>Totals</td>
                    <td className="py-2 text-right font-mono text-xs">AED {data.totals.value.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-xs">AED {data.totals.budget.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-xs">AED {data.totals.cost.toLocaleString()}</td>
                    <td className={`py-2 text-right font-mono text-xs ${data.totals.profit >= 0 ? "text-status-present" : "text-status-absent"}`}>
                      {data.totals.profit >= 0 ? "+" : ""}AED {data.totals.profit.toLocaleString()}
                    </td>
                    <td className={`py-2 text-right font-mono text-xs ${data.avgMargin >= 0 ? "text-status-present" : "text-status-absent"}`}>{data.avgMargin}%</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
