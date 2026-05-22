import { useState, useMemo } from "react";
import { useProjectLaborBreakdown, type ProjectLaborRow } from "@/hooks/useReports";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DollarSign, Building2, MapPin, Plane, Clock, ChevronDown, ChevronRight, Download, Users,
} from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { exportReportPdf } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

const fmtH = (m: number) => (m / 60).toFixed(1) + "h";
const fmtAED = (n: number) => "AED " + Math.round(n).toLocaleString();

export default function CostReports() {
  const [dateRange, setDateRange] = useReportDateRange("This Month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading } = useProjectLaborBreakdown(dateRange.start, dateRange.end, {
    status: statusFilter, branchId: branchFilter,
  });

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const csvRows = useMemo(() => {
    if (!data) return [] as (string | number)[][];
    const rows: (string | number)[][] = [];
    for (const p of data.rows) {
      rows.push([
        p.name, p.status, "— TOTAL —",
        fmtH(p.inHouseMin), fmtH(p.siteMin),
        fmtH(p.travelToSiteMin), fmtH(p.travelReturnMin), fmtH(p.travelTotalMin),
        fmtH(p.workedMin), fmtH(p.otMin),
        p.regularCost, p.otCost, p.expenses, p.totalCost,
      ]);
      for (const e of p.employees) {
        rows.push([
          p.name, p.status, `${e.name} (${e.code})`,
          fmtH(e.inHouseMin), fmtH(e.siteMin),
          fmtH(e.travelToSiteMin), fmtH(e.travelReturnMin), fmtH(e.travelTotalMin),
          fmtH(e.workedMin), fmtH(e.otMin),
          e.regularCost, e.otCost, "", e.totalCost,
        ]);
      }
    }
    return rows;
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Project Labor & Cost Breakdown</h1>
          <p className="text-sm text-muted-foreground">{dateRange.label} · in-house, on-site, travel time per employee</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          {data && (<>
            <Button variant="outline" size="sm" className="text-xs ml-2" onClick={() => {
              downloadCsv(`project-labor-${dateRange.start}-${dateRange.end}.csv`,
                ["Project", "Status", "Employee", "In-House", "Site", "Travel→Site", "Return→Office", "Travel Total", "Worked", "OT", "Regular Cost (AED)", "OT Cost (AED)", "Expenses (AED)", "Total Cost (AED)"],
                csvRows
              );
            }}><Download className="h-3.5 w-3.5 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              exportReportPdf({
                title: "Project Labor & Cost Breakdown",
                subtitle: dateRange.label,
                filename: `project-labor-${dateRange.start}-${dateRange.end}.pdf`,
                summaryCards: [
                  { label: "In-House", value: fmtH(data.totals.inHouseMin) },
                  { label: "On-Site", value: fmtH(data.totals.siteMin) },
                  { label: "Travel", value: fmtH(data.totals.travelMin) },
                  { label: "Total Cost", value: fmtAED(data.totals.totalCost) },
                ],
                tables: data.rows.map((p) => ({
                  title: `${p.name} — ${fmtAED(p.totalCost)}`,
                  headers: ["Employee", "In-House", "Site", "Travel", "Worked", "OT", "Cost (AED)"],
                  rows: [
                    ...p.employees.map((e) => [
                      `${e.name} (${e.code})`,
                      fmtH(e.inHouseMin), fmtH(e.siteMin), fmtH(e.travelTotalMin),
                      fmtH(e.workedMin), fmtH(e.otMin),
                      e.totalCost.toLocaleString(),
                    ]),
                    [
                      "TOTAL",
                      fmtH(p.inHouseMin), fmtH(p.siteMin), fmtH(p.travelTotalMin),
                      fmtH(p.workedMin), fmtH(p.otMin),
                      (p.regularCost + p.otCost).toLocaleString(),
                    ],
                  ],
                })),
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
            <SelectItem value="on_hold">On Hold</SelectItem>
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
          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard title="In-House Hours" value={fmtH(data.totals.inHouseMin)} icon={Building2} variant="default" />
            <StatCard title="On-Site Hours" value={fmtH(data.totals.siteMin)} icon={MapPin} variant="success" />
            <StatCard title="Travel Hours" value={fmtH(data.totals.travelMin)} icon={Plane} variant="default" />
            <StatCard title="Overtime Hours" value={fmtH(data.totals.otMin)} icon={Clock} variant="destructive" />
            <StatCard title="Total Labor Cost" value={fmtAED(data.totals.regularCost + data.totals.otCost)} icon={DollarSign} variant="brand" />
          </div>

          {/* Project list */}
          {data.rows.length === 0 ? (
            <Card className="glass-card"><CardContent className="p-8 text-center text-sm text-muted-foreground">No labor activity in this period.</CardContent></Card>
          ) : data.rows.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isOpen={!!expanded[p.id]}
              onToggle={() => toggle(p.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function ProjectCard({ project: p, isOpen, onToggle }: { project: ProjectLaborRow; isOpen: boolean; onToggle: () => void }) {
  return (
    <Card className="glass-card overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/20 transition-colors py-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <CardTitle className="text-base truncate">{p.name}</CardTitle>
                <Badge variant="outline" className="text-[10px] capitalize">{p.status.replace("_", " ")}</Badge>
                <Badge variant="secondary" className="text-[10px]"><Users className="h-3 w-3 mr-1" />{p.employees.length}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <Stat label="In-House" value={fmtH(p.inHouseMin)} icon={<Building2 className="h-3 w-3" />} />
                <Stat label="Site" value={fmtH(p.siteMin)} icon={<MapPin className="h-3 w-3" />} accent="text-status-present" />
                <Stat label="Travel" value={fmtH(p.travelTotalMin)} icon={<Plane className="h-3 w-3" />} accent="text-status-traveling" />
                <Stat label="OT" value={fmtH(p.otMin)} accent="text-status-overtime" />
                <Stat label="Cost" value={fmtAED(p.regularCost + p.otCost)} accent="text-brand font-bold" />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Time-split visual bar */}
            <TimeSplitBar inHouse={p.inHouseMin} site={p.siteMin} travel={p.travelTotalMin} />

            <ScrollArea className="w-full mt-4">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-right py-2 font-medium">Days</th>
                    <th className="text-right py-2 font-medium" title="Office punch-in → travel start"><Building2 className="h-3 w-3 inline" /> In-House</th>
                    <th className="text-right py-2 font-medium" title="Site arrival → return travel"><MapPin className="h-3 w-3 inline" /> Site</th>
                    <th className="text-right py-2 font-medium">Travel Total</th>
                    <th className="text-right py-2 font-medium">Worked</th>
                    <th className="text-right py-2 font-medium text-amber-400" title="Idle time = travel time (non-productive on-clock hours)">Idle</th>
                    <th className="text-right py-2 font-medium">OT</th>
                    <th className="text-right py-2 font-medium">Rate</th>
                    <th className="text-right py-2 font-medium">Regular</th>
                    <th className="text-right py-2 font-medium">OT Cost</th>
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {p.employees.length === 0 ? (
                    <tr><td colSpan={14} className="py-6 text-center text-muted-foreground text-xs">No employee labor data</td></tr>
                  ) : p.employees.map((e) => (
                    <tr key={e.id} className="border-b border-border/30 hover:bg-accent/10">
                      <td className="py-2">
                        <div className="font-medium text-foreground">{e.name}</div>
                        <div className="text-[10px] text-muted-foreground font-mono capitalize">{e.code} · {e.skill.replace("_", " ")}</div>
                      </td>
                      <td className="py-2 text-right font-mono text-xs">{e.days}</td>
                      <td className="py-2 text-right font-mono text-xs">{e.inHouseMin > 0 ? fmtH(e.inHouseMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-present">{e.siteMin > 0 ? fmtH(e.siteMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-traveling">{e.travelToSiteMin > 0 ? fmtH(e.travelToSiteMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-traveling">{e.travelReturnMin > 0 ? fmtH(e.travelReturnMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-traveling font-medium">{e.travelTotalMin > 0 ? fmtH(e.travelTotalMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs font-medium">{fmtH(e.workedMin)}</td>
                      <td className="py-2 text-right font-mono text-xs text-amber-400" title="Travel time treated as idle">{e.travelTotalMin > 0 ? fmtH(e.travelTotalMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-overtime">{e.otMin > 0 ? fmtH(e.otMin) : "—"}</td>
                      <td className="py-2 text-right font-mono text-[10px] text-muted-foreground">AED {e.hourlyRate}/h</td>
                      <td className="py-2 text-right font-mono text-xs">{fmtAED(e.regularCost)}</td>
                      <td className="py-2 text-right font-mono text-xs text-status-overtime">{e.otCost > 0 ? fmtAED(e.otCost) : "—"}</td>
                      <td className="py-2 text-right font-mono text-xs font-bold text-brand">{fmtAED(e.totalCost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                    <td className="py-2" colSpan={2}>Project Totals</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtH(p.inHouseMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-present">{fmtH(p.siteMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-traveling">{fmtH(p.travelToSiteMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-traveling">{fmtH(p.travelReturnMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-traveling">{fmtH(p.travelTotalMin)}</td>
                    <td className="py-2 text-right font-mono text-xs">{fmtH(p.workedMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-amber-400">{fmtH(p.travelTotalMin)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-overtime">{fmtH(p.otMin)}</td>
                    <td />
                    <td className="py-2 text-right font-mono text-xs">{fmtAED(p.regularCost)}</td>
                    <td className="py-2 text-right font-mono text-xs text-status-overtime">{fmtAED(p.otCost)}</td>
                    <td className="py-2 text-right font-mono text-xs font-bold text-brand">{fmtAED(p.regularCost + p.otCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </ScrollArea>

            {/* Cost summary footer */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <SummaryBox label="Labor Cost" value={fmtAED(p.regularCost + p.otCost)} />
              <SummaryBox label="Expenses" value={fmtAED(p.expenses)} />
              <SummaryBox label="Total Cost" value={fmtAED(p.totalCost)} accent="text-brand" />
              {p.budget > 0 && (
                <SummaryBox
                  label="Budget"
                  value={fmtAED(p.budget)}
                  sub={`${Math.round((p.totalCost / p.budget) * 100)}% used`}
                  accent={p.totalCost > p.budget ? "text-status-absent" : "text-status-present"}
                />
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div className="hidden md:flex flex-col items-end leading-tight">
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className={cn("font-mono text-xs", accent ?? "text-foreground")}>{value}</span>
    </div>
  );
}

function SummaryBox({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-base font-bold font-mono", accent ?? "text-foreground")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function TimeSplitBar({ inHouse, site, travel }: { inHouse: number; site: number; travel: number }) {
  const total = inHouse + site + travel;
  if (total === 0) return null;
  const ih = (inHouse / total) * 100;
  const st = (site / total) * 100;
  const tv = (travel / total) * 100;
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className="bg-foreground/70" style={{ width: `${ih}%` }} title={`In-House ${fmtH(inHouse)}`} />
        <div className="bg-status-present" style={{ width: `${st}%` }} title={`Site ${fmtH(site)}`} />
        <div className="bg-status-traveling" style={{ width: `${tv}%` }} title={`Travel ${fmtH(travel)}`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-foreground/70" /> In-House {ih.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-present" /> Site {st.toFixed(0)}%</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-status-traveling" /> Travel {tv.toFixed(0)}%</span>
      </div>
    </div>
  );
}
