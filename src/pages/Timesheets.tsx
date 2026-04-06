import { useState, useMemo } from "react";
import { useTimesheetData, useApproveTimesheet, type TimesheetRow } from "@/hooks/useTimesheets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjects } from "@/hooks/useProjects";
import { exportCsv } from "@/lib/csv-export";
import {
  Clock, Search, ChevronLeft, ChevronRight, Download,
  CheckCircle2, XCircle, AlertTriangle, DollarSign, Users, Timer,
} from "lucide-react";
import { toast } from "sonner";

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().slice(0, 7); // "YYYY-MM"
}

const statusBadge: Record<string, { text: string; className: string }> = {
  pending: { text: "Pending", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  approved: { text: "Approved", className: "bg-status-present/20 text-status-present border-status-present/30" },
  rejected: { text: "Rejected", className: "bg-status-absent/20 text-status-absent border-status-absent/30" },
};

export default function Timesheets() {
  const [month, setMonth] = useState(todayUAE());
  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [approveRow, setApproveRow] = useState<TimesheetRow | null>(null);
  const [approveAction, setApproveAction] = useState<"approved" | "rejected">("approved");
  const [approveNotes, setApproveNotes] = useState("");

  const { data, isLoading } = useTimesheetData(month);
  const approve = useApproveTimesheet();

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  })();

  const filtered = useMemo(() => {
    if (!data?.rows) return [];
    let rows = data.rows;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => r.employee_name.toLowerCase().includes(s) || r.employee_code.toLowerCase().includes(s));
    }
    if (skillFilter !== "all") {
      rows = rows.filter((r) => r.skill_type === skillFilter);
    }
    return rows;
  }, [data, search, skillFilter]);

  // Summary stats
  const totalRegCost = filtered.reduce((s, r) => s + r.regularCost, 0);
  const totalOtCost = filtered.reduce((s, r) => s + r.otCost, 0);
  const totalOtHours = filtered.reduce((s, r) => s + r.totalOt, 0);
  const empWithOt = filtered.filter((r) => r.totalOt > 0).length;

  // Generate day headers
  const dayHeaders = useMemo(() => {
    if (!data) return [];
    const days: { date: string; label: string; dayName: string }[] = [];
    const [y, m] = month.split("-").map(Number);
    for (let d = 1; d <= data.daysInMonth; d++) {
      const dt = new Date(y, m - 1, d);
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      days.push({
        date: dateStr,
        label: String(d),
        dayName: dt.toLocaleDateString("en-GB", { weekday: "short" }),
      });
    }
    return days;
  }, [data, month]);

  const handleApprove = async () => {
    if (!approveRow) return;
    try {
      await approve.mutateAsync({
        employee_id: approveRow.employee_id,
        month,
        status: approveAction,
        approval_notes: approveNotes || undefined,
        total_hours: approveRow.totalHours,
        total_ot_hours: approveRow.totalOt,
        total_regular_cost: approveRow.regularCost,
        total_ot_cost: approveRow.otCost,
        days_worked: approveRow.daysWorked,
      });
      toast.success(`Timesheet ${approveAction}`);
      setApproveRow(null);
      setApproveNotes("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExport = () => {
    if (!filtered.length) return;
    const csvRows = filtered.map((r) => ({
      "Employee Code": r.employee_code,
      "Employee Name": r.employee_name,
      "Skill": r.skill_type,
      "Days Worked": r.daysWorked,
      "Total Hours": r.totalHours,
      "OT Hours": r.totalOt,
      "Regular Cost (AED)": r.regularCost,
      "OT Cost (AED)": r.otCost,
      "Total Cost (AED)": r.regularCost + r.otCost,
      "Status": r.approvalStatus ?? "pending",
    }));
    exportCsv(csvRows, `timesheet-${month}`);
    toast.success("Exported to CSV");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Timesheets</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px] h-8 text-xs" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />Export
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Regular Labor Cost" value={`AED ${totalRegCost.toLocaleString()}`} icon={DollarSign} variant="default" />
        <StatCard title="Overtime Cost" value={`AED ${totalOtCost.toLocaleString()}`} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Total OT Hours" value={`${totalOtHours.toFixed(1)}h`} icon={Timer} variant="warning" />
        <StatCard title="Employees with OT" value={empWithOt} icon={Users} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={skillFilter} onValueChange={setSkillFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Skills" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
            <SelectItem value="helper">Helper</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timesheet Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No timesheet data for this month</p>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-4 p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-3 font-medium sticky left-0 bg-card z-10 min-w-[160px]">Employee</th>
                      <th className="text-center py-2 px-1 font-medium">Days</th>
                      {dayHeaders.map((d) => (
                        <th key={d.date} className="text-center py-2 px-0.5 font-medium min-w-[28px]">
                          <div className="text-[9px] text-muted-foreground/60">{d.dayName}</div>
                          <div>{d.label}</div>
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 font-medium">Hours</th>
                      <th className="text-right py-2 px-2 font-medium text-status-overtime">OT</th>
                      <th className="text-right py-2 px-2 font-medium">Reg Cost</th>
                      <th className="text-right py-2 px-2 font-medium text-status-overtime">OT Cost</th>
                      <th className="text-center py-2 px-2 font-medium">Status</th>
                      <th className="text-center py-2 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.employee_id} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                        <td className="py-2 px-3 sticky left-0 bg-card z-10">
                          <span className="font-medium text-foreground">{row.employee_name}</span>
                          <div className="text-[10px] text-muted-foreground">{row.employee_code} · {row.skill_type}</div>
                        </td>
                        <td className="text-center py-2 px-1 text-xs font-mono">{row.daysWorked}</td>
                        {dayHeaders.map((d) => {
                          const hrs = row.dailyHours[d.date];
                          const ot = row.dailyOt[d.date];
                          return (
                            <td key={d.date} className="text-center py-2 px-0.5">
                              {hrs != null ? (
                                <div className="flex flex-col items-center">
                                  <span className={`text-[10px] font-mono ${ot > 0 ? "text-status-overtime font-semibold" : "text-foreground"}`}>
                                    {hrs}
                                  </span>
                                  {ot > 0 && <span className="text-[8px] text-status-overtime">+{ot}</span>}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/30">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-right py-2 px-2 font-mono text-xs font-medium">{row.totalHours}</td>
                        <td className="text-right py-2 px-2 font-mono text-xs font-semibold text-status-overtime">{row.totalOt > 0 ? row.totalOt : "—"}</td>
                        <td className="text-right py-2 px-2 font-mono text-xs">{row.regularCost.toLocaleString()}</td>
                        <td className="text-right py-2 px-2 font-mono text-xs text-status-overtime">{row.otCost > 0 ? row.otCost.toLocaleString() : "—"}</td>
                        <td className="text-center py-2 px-2">
                          {row.approvalStatus ? (
                            <Badge className={`text-[9px] ${statusBadge[row.approvalStatus]?.className ?? ""}`}>
                              {statusBadge[row.approvalStatus]?.text ?? row.approvalStatus}
                            </Badge>
                          ) : (
                            <Badge className="text-[9px] bg-muted/50 text-muted-foreground border-border">Pending</Badge>
                          )}
                        </td>
                        <td className="text-center py-2 px-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-status-present hover:text-status-present"
                              onClick={() => { setApproveRow(row); setApproveAction("approved"); }}
                              title="Approve"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-status-absent hover:text-status-absent"
                              onClick={() => { setApproveRow(row); setApproveAction("rejected"); }}
                              title="Reject"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals row */}
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td className="py-2 px-3 font-semibold text-foreground sticky left-0 bg-muted/20 z-10">Totals ({filtered.length})</td>
                      <td className="text-center py-2 px-1 font-mono text-xs font-semibold">
                        {filtered.reduce((s, r) => s + r.daysWorked, 0)}
                      </td>
                      {dayHeaders.map((d) => <td key={d.date} />)}
                      <td className="text-right py-2 px-2 font-mono text-xs font-bold">
                        {filtered.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs font-bold text-status-overtime">
                        {totalOtHours.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs font-bold">
                        {totalRegCost.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-2 font-mono text-xs font-bold text-status-overtime">
                        {totalOtCost.toLocaleString()}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Approve/Reject Dialog */}
      <Dialog open={!!approveRow} onOpenChange={(o) => { if (!o) { setApproveRow(null); setApproveNotes(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{approveAction === "approved" ? "Approve" : "Reject"} Timesheet</DialogTitle>
            <DialogDescription>
              {approveRow?.employee_name} ({approveRow?.employee_code}) — {monthLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Total Hours</p>
              <p className="text-lg font-bold">{approveRow?.totalHours}h</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
              <p className="text-lg font-bold text-status-overtime">{approveRow?.totalOt}h</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Regular Cost</p>
              <p className="text-lg font-bold">AED {approveRow?.regularCost.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase">OT Cost</p>
              <p className="text-lg font-bold text-status-overtime">AED {approveRow?.otCost.toLocaleString()}</p>
            </div>
          </div>
          <Textarea
            placeholder="Approval notes (optional)…"
            value={approveNotes}
            onChange={(e) => setApproveNotes(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveRow(null); setApproveNotes(""); }}>Cancel</Button>
            <Button
              onClick={handleApprove}
              disabled={approve.isPending}
              className={approveAction === "approved" ? "bg-status-present hover:bg-status-present/80" : "bg-status-absent hover:bg-status-absent/80"}
            >
              {approve.isPending ? "Saving…" : approveAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
