import { useState, useMemo } from "react";
import { useTimesheetData, useApproveTimesheet, type TimesheetRow, type ProjectTimesheetRow, type DayStatus } from "@/hooks/useTimesheets";
import { useAuth } from "@/hooks/useAuth";
import { useCanAccess } from "@/hooks/usePermissions";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/useSettings";
import { downloadCsv } from "@/lib/csv-export";
import {
  Clock, Search, ChevronLeft, ChevronRight, Download,
  CheckCircle2, XCircle, AlertTriangle, DollarSign, Users, Timer,
  FileSpreadsheet, FileText, Building2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatWorkedMinutes, getDisplayWorkedMinutes, getDisplayOvertimeMinutes } from "@/lib/timesheet-display";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().slice(0, 7);
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
  const [projectFilter, setProjectFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [approveRow, setApproveRow] = useState<TimesheetRow | null>(null);
  const [approveAction, setApproveAction] = useState<"approved" | "rejected">("approved");
  const [approveNotes, setApproveNotes] = useState("");
  const [dayDetail, setDayDetail] = useState<{ row: TimesheetRow; date: string } | null>(null);
  const [daySummaryDate, setDaySummaryDate] = useState<string>("");

  const { data, isLoading } = useTimesheetData(month, { projectId: projectFilter, employeeId: employeeFilter });
  const { data: settings } = useSettings();
  const approve = useApproveTimesheet();
  const travelPaid = settings?.travel_time_paid === "true";
  const { allowed: canEdit } = useCanAccess("timesheets", "can_edit");
  const { isAdmin, isManager, isTeamLeader } = useAuth();
  const showAdvancedFilters = isAdmin || isManager || isTeamLeader;

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
  const totalPay = filtered.reduce((s, r) => s + r.totalPay, 0);

  // Day headers
  const dayHeaders = useMemo(() => {
    if (!data) return [];
    const days: { date: string; label: string; dayName: string }[] = [];
    const [y, m] = month.split("-").map(Number);
    for (let d = 1; d <= data.daysInMonth; d++) {
      const dt = new Date(y, m - 1, d);
      const dateStr = `${month}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, label: String(d), dayName: dt.toLocaleDateString("en-GB", { weekday: "short" }) });
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

  const companyName = settings?.company_name || "BeBright";

  // ── Export: Excel ──
  const handleExportExcel = () => {
    if (!filtered.length) return;
    const wsData = [
      [companyName, "", "", "", "", "", "", "", "", "", ""],
      [`Payroll Timesheet — ${monthLabel}`, "", "", "", "", "", "", "", "", "", ""],
      [],
      ["Emp Code", "Employee Name", "Skill", "Days", "Reg Hours", "OT Hours", "Break (min)",
        ...(travelPaid ? ["Travel (min)"] : []),
        "Reg Pay (AED)", "OT Pay (AED)", "Total Pay (AED)", "Status"],
      ...filtered.map((r) => [
        r.employee_code, r.employee_name, r.skill_type, r.daysWorked,
        r.totalHours, r.totalOt, r.totalBreakMinutes,
        ...(travelPaid ? [r.totalTravelMinutes] : []),
        r.regularCost, r.otCost, r.totalPay, r.approvalStatus ?? "pending",
      ]),
      [],
      ["TOTALS", "", "", filtered.reduce((s, r) => s + r.daysWorked, 0),
        filtered.reduce((s, r) => s + r.totalHours, 0).toFixed(1),
        totalOtHours.toFixed(1),
        filtered.reduce((s, r) => s + r.totalBreakMinutes, 0),
        ...(travelPaid ? [filtered.reduce((s, r) => s + r.totalTravelMinutes, 0)] : []),
        totalRegCost, totalOtCost, totalPay, ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    // Set column widths
    ws["!cols"] = [
      { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      ...(travelPaid ? [{ wch: 10 }] : []),
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");

    // Project-wise sheet
    if (data?.projectRows?.length) {
      const projData: any[][] = [
        [companyName], [`Project-wise Timesheet — ${monthLabel}`], [],
        ["Project", "Emp Code", "Employee", "Skill", "Days", "Hours", "OT", "Reg Pay", "OT Pay", "Total Pay"],
      ];
      for (const pr of data.projectRows) {
        for (const e of pr.employees) {
          projData.push([
            pr.project_name, e.employee_code, e.employee_name, e.skill_type,
            e.daysWorked, e.totalHours, e.totalOt, e.regularCost, e.otCost, e.totalPay,
          ]);
        }
        projData.push(["", "", "", "Subtotal", "", pr.totalHours, pr.totalOt, "", "", pr.totalCost]);
      }
      const ws2 = XLSX.utils.aoa_to_sheet(projData);
      ws2["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 6 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws2, "By Project");
    }

    XLSX.writeFile(wb, `payroll-${month}.xlsx`);
    toast.success("Exported to Excel");
  };

  // ── Export: PDF ──
  const handleExportPdf = () => {
    if (!filtered.length) return;
    const doc = new jsPDF({ orientation: "landscape" });

    // Header
    doc.setFontSize(16);
    doc.text(companyName, 14, 15);
    doc.setFontSize(11);
    doc.text(`Payroll Timesheet — ${monthLabel}`, 14, 22);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 14, 27);

    const headers = ["Code", "Employee", "Skill", "Days", "Reg Hrs", "OT Hrs", "Break",
      ...(travelPaid ? ["Travel"] : []),
      "Reg Pay", "OT Pay", "Total Pay", "Status"];
    const body = filtered.map((r) => [
      r.employee_code, r.employee_name, r.skill_type, r.daysWorked,
      r.totalHours, r.totalOt, r.totalBreakMinutes,
      ...(travelPaid ? [r.totalTravelMinutes] : []),
      `${r.regularCost.toLocaleString()}`, `${r.otCost.toLocaleString()}`, `${r.totalPay.toLocaleString()}`,
      r.approvalStatus ?? "pending",
    ]);
    // Totals row
    body.push([
      "", "TOTALS", "", filtered.reduce((s, r) => s + r.daysWorked, 0) as any,
      filtered.reduce((s, r) => s + r.totalHours, 0).toFixed(1) as any,
      totalOtHours.toFixed(1) as any,
      filtered.reduce((s, r) => s + r.totalBreakMinutes, 0) as any,
      ...(travelPaid ? [filtered.reduce((s, r) => s + r.totalTravelMinutes, 0) as any] : []),
      totalRegCost.toLocaleString(), totalOtCost.toLocaleString(), totalPay.toLocaleString(), "",
    ]);

    autoTable(doc, {
      startY: 32,
      head: [headers],
      body,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data: any) => {
        // Bold totals row
        if (data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [226, 232, 240];
        }
      },
    });

    doc.save(`payroll-${month}.pdf`);
    toast.success("Exported to PDF");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Timesheets & Payroll</h1>
          <p className="text-sm text-muted-foreground">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-[160px] h-8 text-xs" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExportPdf}>
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Regular Pay" value={`AED ${totalRegCost.toLocaleString()}`} icon={DollarSign} variant="default" />
        <StatCard title="Overtime Pay" value={`AED ${totalOtCost.toLocaleString()}`} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Total Payroll" value={`AED ${totalPay.toLocaleString()}`} icon={DollarSign} variant="default" />
        <StatCard title="OT Hours" value={`${totalOtHours.toFixed(1)}h`} icon={Timer} variant="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {showAdvancedFilters && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        )}
        {showAdvancedFilters && (
          <Select value={skillFilter} onValueChange={setSkillFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Skills" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Skills</SelectItem>
              <SelectItem value="team_member">Team Member</SelectItem>
              <SelectItem value="team_leader">Team Leader</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showAdvancedFilters && (
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(data?.projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {showAdvancedFilters && (
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Employees" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {(data?.employees ?? []).map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs: Employee view vs Project view */}
      <Tabs defaultValue="employee" className="space-y-4">
        {showAdvancedFilters && (
          <TabsList>
            <TabsTrigger value="employee" className="gap-1.5"><Users className="h-3.5 w-3.5" /> By Employee</TabsTrigger>
            <TabsTrigger value="project" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> By Project</TabsTrigger>
          </TabsList>
        )}

        {/* ── Employee View ── */}
        <TabsContent value="employee">
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
                  <div className="min-w-[1100px]">
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
                          <th className="text-right py-2 px-2 font-medium">Break</th>
                          {travelPaid && <th className="text-right py-2 px-2 font-medium">Travel</th>}
                          <th className="text-right py-2 px-2 font-medium">Reg Pay</th>
                          <th className="text-right py-2 px-2 font-medium text-status-overtime">OT Pay</th>
                          <th className="text-right py-2 px-2 font-medium">Total</th>
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
                              const status = row.dailyStatus?.[d.date] as DayStatus | undefined;
                              const mins = row.dailyWorkMinutes?.[d.date];
                              const ot = row.dailyOt[d.date];
                              return (
                                <td key={d.date} className="text-center py-2 px-0.5">
                                  {status === "present" ? (
                                    <button
                                      type="button"
                                      onClick={() => setDayDetail({ row, date: d.date })}
                                      className="flex flex-col items-center w-full rounded hover:bg-accent/40 px-0.5 py-0.5 transition-colors cursor-pointer"
                                      title="View day detail"
                                    >
                                      <span className={`text-[10px] font-mono ${ot > 0 ? "text-status-overtime font-semibold" : "text-foreground"}`}>
                                        {formatWorkedMinutes(mins || 0)}
                                      </span>
                                      {ot > 0 && <span className="text-[8px] text-status-overtime">+{ot}h</span>}
                                    </button>
                                  ) : status === "leave" ? (
                                    <span className="text-[10px] font-bold text-status-planned">L</span>
                                  ) : status === "absent" ? (
                                    <span className="text-[10px] font-bold text-status-absent">A</span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/30">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-right py-2 px-2 font-mono text-xs font-medium">{row.totalHours}</td>
                            <td className="text-right py-2 px-2 font-mono text-xs font-semibold text-status-overtime">{row.totalOt > 0 ? row.totalOt : "—"}</td>
                            <td className="text-right py-2 px-2 font-mono text-xs text-muted-foreground">{row.totalBreakMinutes > 0 ? `${row.totalBreakMinutes}m` : "—"}</td>
                            {travelPaid && <td className="text-right py-2 px-2 font-mono text-xs text-muted-foreground">{row.totalTravelMinutes > 0 ? `${row.totalTravelMinutes}m` : "—"}</td>}
                            <td className="text-right py-2 px-2 font-mono text-xs">{row.regularCost.toLocaleString()}</td>
                            <td className="text-right py-2 px-2 font-mono text-xs text-status-overtime">{row.otCost > 0 ? row.otCost.toLocaleString() : "—"}</td>
                            <td className="text-right py-2 px-2 font-mono text-xs font-bold">{row.totalPay.toLocaleString()}</td>
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
                              {canEdit ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-status-present hover:text-status-present"
                                    onClick={() => { setApproveRow(row); setApproveAction("approved"); }} title="Approve">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-status-absent hover:text-status-absent"
                                    onClick={() => { setApproveRow(row); setApproveAction("rejected"); }} title="Reject">
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border bg-muted/20">
                          <td className="py-2 px-3 font-semibold text-foreground sticky left-0 bg-muted/20 z-10">Totals ({filtered.length})</td>
                          <td className="text-center py-2 px-1 font-mono text-xs font-semibold">{filtered.reduce((s, r) => s + r.daysWorked, 0)}</td>
                          {dayHeaders.map((d) => <td key={d.date} />)}
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold">{filtered.reduce((s, r) => s + r.totalHours, 0).toFixed(1)}</td>
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold text-status-overtime">{totalOtHours.toFixed(1)}</td>
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold">{filtered.reduce((s, r) => s + r.totalBreakMinutes, 0)}m</td>
                          {travelPaid && <td className="text-right py-2 px-2 font-mono text-xs font-bold">{filtered.reduce((s, r) => s + r.totalTravelMinutes, 0)}m</td>}
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold">{totalRegCost.toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold text-status-overtime">{totalOtCost.toLocaleString()}</td>
                          <td className="text-right py-2 px-2 font-mono text-xs font-bold">{totalPay.toLocaleString()}</td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Project View ── */}
        <TabsContent value="project">
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}</div>
          ) : !data?.projectRows?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No project data for this month</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.projectRows.map((pr) => (
                <Card key={pr.project_id} className="glass-card">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-brand" />
                        {pr.project_name}
                      </CardTitle>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{pr.employees.length} staff</span>
                        <span>{pr.totalHours}h</span>
                        <span className="font-semibold text-foreground">AED {pr.totalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left py-1.5 font-medium">Employee</th>
                          <th className="text-left py-1.5 font-medium">Skill</th>
                          <th className="text-center py-1.5 font-medium">Days</th>
                          <th className="text-right py-1.5 font-medium">Reg Hrs</th>
                          <th className="text-right py-1.5 font-medium">OT Hrs</th>
                          <th className="text-right py-1.5 font-medium">Break</th>
                          {travelPaid && <th className="text-right py-1.5 font-medium">Travel</th>}
                          <th className="text-right py-1.5 font-medium">Reg Pay</th>
                          <th className="text-right py-1.5 font-medium">OT Pay</th>
                          <th className="text-right py-1.5 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pr.employees.map((e) => (
                          <tr key={e.employee_id} className="border-b border-border/30 last:border-0">
                            <td className="py-1.5">
                              <span className="font-medium text-foreground">{e.employee_name}</span>
                              <span className="text-[10px] text-muted-foreground ml-1.5">{e.employee_code}</span>
                            </td>
                            <td className="py-1.5"><Badge variant="outline" className="text-[9px]">{e.skill_type}</Badge></td>
                            <td className="text-center py-1.5 font-mono text-xs">{e.daysWorked}</td>
                            <td className="text-right py-1.5 font-mono text-xs">{e.totalHours}</td>
                            <td className="text-right py-1.5 font-mono text-xs text-status-overtime">{e.totalOt > 0 ? e.totalOt : "—"}</td>
                            <td className="text-right py-1.5 font-mono text-xs text-muted-foreground">{e.totalBreakMinutes > 0 ? `${e.totalBreakMinutes}m` : "—"}</td>
                            {travelPaid && <td className="text-right py-1.5 font-mono text-xs text-muted-foreground">{e.totalTravelMinutes > 0 ? `${e.totalTravelMinutes}m` : "—"}</td>}
                            <td className="text-right py-1.5 font-mono text-xs">{e.regularCost.toLocaleString()}</td>
                            <td className="text-right py-1.5 font-mono text-xs text-status-overtime">{e.otCost > 0 ? e.otCost.toLocaleString() : "—"}</td>
                            <td className="text-right py-1.5 font-mono text-xs font-bold">{e.totalPay.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border bg-muted/10">
                          <td colSpan={2} className="py-1.5 font-semibold text-xs">Project Total</td>
                          <td className="text-center py-1.5 font-mono text-xs font-bold">{pr.employees.reduce((s, e) => s + e.daysWorked, 0)}</td>
                          <td className="text-right py-1.5 font-mono text-xs font-bold">{pr.totalHours}</td>
                          <td className="text-right py-1.5 font-mono text-xs font-bold text-status-overtime">{pr.totalOt}</td>
                          <td className="text-right py-1.5 font-mono text-xs font-bold">{pr.employees.reduce((s, e) => s + e.totalBreakMinutes, 0)}m</td>
                          {travelPaid && <td className="text-right py-1.5 font-mono text-xs font-bold">{pr.employees.reduce((s, e) => s + e.totalTravelMinutes, 0)}m</td>}
                          <td className="text-right py-1.5 font-mono text-xs font-bold">{pr.employees.reduce((s, e) => s + e.regularCost, 0).toLocaleString()}</td>
                          <td className="text-right py-1.5 font-mono text-xs font-bold text-status-overtime">{pr.employees.reduce((s, e) => s + e.otCost, 0).toLocaleString()}</td>
                          <td className="text-right py-1.5 font-mono text-xs font-bold">{pr.totalCost.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Day Detail Dialog */}
      <DayDetailDialog detail={dayDetail} onClose={() => setDayDetail(null)} travelPaid={travelPaid} />

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
              <p className="text-[10px] text-muted-foreground uppercase">Regular Pay</p>
              <p className="text-lg font-bold">AED {approveRow?.regularCost.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] text-muted-foreground uppercase">Total Pay</p>
              <p className="text-lg font-bold">AED {approveRow?.totalPay.toLocaleString()}</p>
            </div>
          </div>
          <Textarea placeholder="Approval notes (optional)…" value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproveRow(null); setApproveNotes(""); }}>Cancel</Button>
            <Button onClick={handleApprove} disabled={approve.isPending}
              className={approveAction === "approved" ? "bg-status-present hover:bg-status-present/80" : "bg-status-absent hover:bg-status-absent/80"}>
              {approve.isPending ? "Saving…" : approveAction === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" });
}

function DayDetailDialog({
  detail,
  onClose,
  travelPaid,
}: {
  detail: { row: TimesheetRow; date: string } | null;
  onClose: () => void;
  travelPaid: boolean;
}) {
  const open = !!detail;
  const empId = detail?.row.employee_id;
  const date = detail?.date;

  const { data: log, isLoading } = useQuery({
    queryKey: ["timesheet-day-detail", empId, date],
    enabled: open && !!empId && !!date,
    queryFn: async () => {
      const [logRes, empRes, settingsRes] = await Promise.all([
        supabase
          .from("attendance_logs")
          .select("*, projects(name)")
          .eq("employee_id", empId!)
          .eq("date", date!)
          .maybeSingle(),
        supabase
          .from("employees")
          .select("hourly_rate, overtime_rate")
          .eq("id", empId!)
          .maybeSingle(),
        supabase
          .from("settings")
          .select("key, value")
          .in("key", ["standard_work_hours", "overtime_multiplier"]),
      ]);
      if (logRes.error) throw logRes.error;
      const settingsMap = new Map((settingsRes.data ?? []).map((s: any) => [s.key, s.value]));
      const stdHours = parseFloat(settingsMap.get("standard_work_hours") ?? "8") || 8;
      const otMult = parseFloat(settingsMap.get("overtime_multiplier") ?? "1.5") || 1.5;
      return {
        log: logRes.data as any,
        rate: Number((empRes.data as any)?.hourly_rate ?? 0),
        otRate: Number((empRes.data as any)?.overtime_rate ?? 0),
        stdHours,
        otMult,
      };
    },
  });

  const dateLabel = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })
    : "";

  // Compute display values
  const computed = (() => {
    if (!log?.log) return null;
    const l = log.log;
    const workedMin = getDisplayWorkedMinutes(l);
    const otMin = getDisplayOvertimeMinutes(l, log.stdHours);
    const regMin = Math.max(0, workedMin - otMin);
    const regPay = (regMin / 60) * log.rate;
    const effectiveOtRate = log.otRate > 0 ? log.otRate : log.rate * log.otMult;
    const otPay = (otMin / 60) * effectiveOtRate;
    let breakMin = l.break_minutes ?? 0;
    if (!breakMin && l.break_start_time && l.break_end_time) {
      const bs = new Date(l.break_start_time).getTime();
      const be = new Date(l.break_end_time).getTime();
      if (be > bs) breakMin = Math.round((be - bs) / 60000);
    }
    return { l, workedMin, otMin, regPay, otPay, breakMin };
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Day Detail — {dateLabel}</DialogTitle>
          <DialogDescription>
            {detail?.row.employee_name} ({detail?.row.employee_code})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !computed ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No record found for this day.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Project</p>
                <p className="font-medium">{computed.l.projects?.name ?? "In-House"}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Total Worked</p>
                <p className="font-bold">{formatWorkedMinutes(computed.workedMin)}</p>
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase mb-1">Timeline</p>
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Office Punch In</span><span className="font-mono">{fmtTime(computed.l.office_punch_in)}</span></div>
              {computed.l.travel_start_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Travel Start</span><span className="font-mono">{fmtTime(computed.l.travel_start_time)}</span></div>}
              {computed.l.site_arrival_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Site Arrival</span><span className="font-mono">{fmtTime(computed.l.site_arrival_time)}</span></div>}
              {computed.l.work_start_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Work Start</span><span className="font-mono">{fmtTime(computed.l.work_start_time)}</span></div>}
              {computed.l.break_start_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Break Start</span><span className="font-mono">{fmtTime(computed.l.break_start_time)}</span></div>}
              {computed.l.break_end_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Break End</span><span className="font-mono">{fmtTime(computed.l.break_end_time)}</span></div>}
              {computed.l.work_end_time && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Work End</span><span className="font-mono">{fmtTime(computed.l.work_end_time)}</span></div>}
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Office Punch Out</span><span className="font-mono">{fmtTime(computed.l.office_punch_out)}</span></div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Break</p>
                <p className="font-mono text-xs">{computed.breakMin > 0 ? `${computed.breakMin}m` : "—"}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Overtime</p>
                <p className="font-mono text-xs text-status-overtime">{formatWorkedMinutes(computed.otMin)}</p>
              </div>
              {travelPaid && (
                <div className="rounded-lg border p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase">Travel</p>
                  <p className="font-mono text-xs">
                    {computed.l.travel_start_time && computed.l.site_arrival_time
                      ? `${Math.max(0, Math.round((new Date(computed.l.site_arrival_time).getTime() - new Date(computed.l.travel_start_time).getTime()) / 60000))}m`
                      : "—"}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">Reg Pay</p>
                <p className="font-mono text-xs">AED {Math.round(computed.regPay).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-2.5">
                <p className="text-[10px] text-muted-foreground uppercase">OT Pay</p>
                <p className="font-mono text-xs text-status-overtime">AED {Math.round(computed.otPay).toLocaleString()}</p>
              </div>
              <div className="rounded-lg border p-2.5 bg-accent/20">
                <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                <p className="font-mono text-xs font-bold">AED {Math.round(computed.regPay + computed.otPay).toLocaleString()}</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
