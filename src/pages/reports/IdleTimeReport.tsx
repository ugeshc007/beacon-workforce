import { useState, useMemo } from "react";
import { ReportDateFilter, useReportDateRange } from "@/components/reports/ReportDateFilter";
import { useIdleTimeReport, type IdleEmployeeRow } from "@/hooks/useIdleTimeReport";
import { IdleEmployeeDrawer } from "@/components/reports/IdleEmployeeDrawer";
import { REASON_LABEL, type IdleReason } from "@/lib/idle-time";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Clock, Users, AlertTriangle, TrendingDown, Search } from "lucide-react";
import { downloadCsv } from "@/lib/csv-export";
import { useProjects } from "@/hooks/useProjects";

const fmtH = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

const decH = (min: number) => (min / 60).toFixed(1);

export default function IdleTimeReport() {
  const [dateRange, setDateRange] = useReportDateRange("Last 7 Days");
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [minIdle, setMinIdle] = useState("0");
  const [selected, setSelected] = useState<IdleEmployeeRow | null>(null);

  const { data: projects } = useProjects({});
  const { data, isLoading } = useIdleTimeReport(dateRange.start, dateRange.end, {
    projectId,
    minIdleMin: parseInt(minIdle, 10) || 0,
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const s = search.toLowerCase();
    return data.employees.filter((e) =>
      !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s)
    );
  }, [data, search]);

  const reasonsMix = (row: IdleEmployeeRow) => {
    const entries = Object.entries(row.reasonCounts) as [IdleReason, number][];
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, 3);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Idle Time Report</h1>
          <p className="text-sm text-muted-foreground">{dateRange.label} · unproductive minutes inside paid shifts</p>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <ReportDateFilter value={dateRange} onChange={setDateRange} />
          {data && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => {
              downloadCsv(
                `idle-time-${dateRange.start}-to-${dateRange.end}.csv`,
                ["Employee", "Code", "Skill", "Days", "Shift (h)", "Productive (h)", "Break (h)", "Idle (h)", "Idle %", "Top reasons"],
                rows.map((r) => [
                  r.name, r.code, r.skill, r.daysWorked,
                  decH(r.shiftMin), decH(r.productiveMin), decH(r.breakMin), decH(r.idleMin),
                  r.shiftMin > 0 ? `${Math.round((r.idleMin / r.shiftMin) * 100)}%` : "0%",
                  reasonsMix(r).map(([k, v]) => `${REASON_LABEL[k]} x${v}`).join("; "),
                ])
              );
            }}>
              <Download className="h-3.5 w-3.5 mr-1" />CSV
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Idle Hours" value={decH(data.totals.idleMin) + "h"} icon={Clock} variant="destructive" />
          <StatCard title="Avg Idle / Employee / Day" value={fmtH(data.totals.avgIdlePerEmpPerDayMin)} icon={TrendingDown} variant="warning" />
          <StatCard title="Employees w/ Idle" value={data.totals.employeesWithIdle} icon={Users} variant="brand" />
          <StatCard
            title="Worst Offender"
            value={data.totals.worst ? `${fmtH(data.totals.worst.idleMin)}` : "—"}
            icon={AlertTriangle}
            variant="destructive"
            subtitle={data.totals.worst?.name}
          />
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minIdle} onValueChange={setMinIdle}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any idle</SelectItem>
            <SelectItem value="30">≥ 30 min</SelectItem>
            <SelectItem value="60">≥ 1 hour</SelectItem>
            <SelectItem value="120">≥ 2 hours</SelectItem>
            <SelectItem value="240">≥ 4 hours</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : !rows.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No idle time in the selected range</p>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Skill</th>
                    <th className="text-right py-2 font-medium">Days</th>
                    <th className="text-right py-2 font-medium">Shift</th>
                    <th className="text-right py-2 font-medium">Productive</th>
                    <th className="text-right py-2 font-medium">Break</th>
                    <th className="text-right py-2 font-medium">Idle</th>
                    <th className="text-right py-2 font-medium">Idle %</th>
                    <th className="text-left py-2 font-medium">Top reasons</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const pct = r.shiftMin > 0 ? Math.round((r.idleMin / r.shiftMin) * 100) : 0;
                    const pctColor = pct >= 40 ? "text-status-absent" : pct >= 20 ? "text-status-overtime" : "text-muted-foreground";
                    return (
                      <tr
                        key={r.employeeId}
                        className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer"
                        onClick={() => setSelected(r)}
                      >
                        <td className="py-2.5">
                          <p className="font-medium text-foreground">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.code}</p>
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground capitalize">{r.skill}</td>
                        <td className="py-2.5 text-right font-mono text-xs">{r.daysWorked}</td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{decH(r.shiftMin)}h</td>
                        <td className="py-2.5 text-right font-mono text-xs text-status-present">{decH(r.productiveMin)}h</td>
                        <td className="py-2.5 text-right font-mono text-xs text-muted-foreground">{decH(r.breakMin)}h</td>
                        <td className="py-2.5 text-right font-mono text-xs text-status-absent font-semibold">{decH(r.idleMin)}h</td>
                        <td className={`py-2.5 text-right font-mono text-xs ${pctColor}`}>{pct}%</td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {reasonsMix(r).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-[9px] border-status-absent/40 text-status-absent">
                                {REASON_LABEL[k]} ×{v}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <IdleEmployeeDrawer
        employee={selected}
        open={!!selected}
        onOpenChange={(v) => { if (!v) setSelected(null); }}
      />
    </div>
  );
}
