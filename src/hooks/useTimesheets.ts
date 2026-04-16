import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DayStatus = "present" | "absent" | "leave" | "future" | "none";

export interface TimesheetRow {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  skill_type: string;
  dailyHours: Record<string, number>;
  dailyOt: Record<string, number>;
  dailyWorkMinutes: Record<string, number>;
  dailyStatus: Record<string, DayStatus>;
  totalHours: number;
  totalOt: number;
  totalBreakMinutes: number;
  totalTravelMinutes: number;
  regularCost: number;
  otCost: number;
  totalPay: number;
  daysWorked: number;
  daysAbsent: number;
  daysLeave: number;
  approvalStatus: string | null;
  approvalId: string | null;
}

export interface ProjectTimesheetRow {
  project_id: string;
  project_name: string;
  employees: {
    employee_id: string;
    employee_name: string;
    employee_code: string;
    skill_type: string;
    totalHours: number;
    totalOt: number;
    totalBreakMinutes: number;
    totalTravelMinutes: number;
    regularCost: number;
    otCost: number;
    totalPay: number;
    daysWorked: number;
  }[];
  totalHours: number;
  totalOt: number;
  totalCost: number;
}

export function useTimesheetData(month: string, filters?: { branchId?: string; projectId?: string; employeeId?: string }) {
  return useQuery({
    queryKey: ["timesheet-data", month, filters],
    queryFn: async () => {
      const startDate = `${month}-01`;
      const [yearStr, monStr] = month.split("-");
      const year = parseInt(yearStr);
      const mon = parseInt(monStr);
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
      const daysInMonth = lastDay;

      let empQuery = supabase
        .from("employees")
        .select("id, name, employee_code, skill_type, branch_id")
        .eq("is_active", true)
        .order("name");

      if (filters?.branchId && filters.branchId !== "all") {
        empQuery = empQuery.eq("branch_id", filters.branchId);
      }
      if (filters?.employeeId && filters.employeeId !== "all") {
        empQuery = empQuery.eq("id", filters.employeeId);
      }

      let logsQuery = supabase
        .from("attendance_logs")
        .select("employee_id, date, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, break_minutes, travel_start_time, site_arrival_time, work_start_time, work_end_time, project_id")
        .gte("date", startDate)
        .lte("date", endDate);

      if (filters?.projectId && filters.projectId !== "all") {
        logsQuery = logsQuery.eq("project_id", filters.projectId);
      }

      const [empRes, logsRes, approvalsRes, projectsRes, leaveRes] = await Promise.all([
        empQuery,
        logsQuery,
        supabase
          .from("timesheet_approvals")
          .select("id, employee_id, status, month")
          .eq("month", month),
        supabase
          .from("projects")
          .select("id, name")
          .order("name"),
        supabase
          .from("employee_leave")
          .select("employee_id, start_date, end_date")
          .lte("start_date", endDate)
          .gte("end_date", startDate),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const approvals = (approvalsRes.data ?? []) as any[];
      const projects = projectsRes.data ?? [];
      const leaves = leaveRes.data ?? [];

      // Build leave lookup: employee_id -> Set of date strings on leave
      const leaveMap = new Map<string, Set<string>>();
      for (const lv of leaves) {
        if (!leaveMap.has(lv.employee_id)) leaveMap.set(lv.employee_id, new Set());
        const lvSet = leaveMap.get(lv.employee_id)!;
        const lvStart = new Date(lv.start_date + "T00:00:00");
        const lvEnd = new Date(lv.end_date + "T00:00:00");
        for (let d = new Date(lvStart); d <= lvEnd; d.setDate(d.getDate() + 1)) {
          const ds = d.toISOString().slice(0, 10);
          if (ds >= startDate && ds <= endDate) lvSet.add(ds);
        }
      }

      const projectMap = new Map(projects.map((p) => [p.id, p.name]));

      // Group logs by employee
      const logMap = new Map<string, typeof logs>();
      for (const log of logs) {
        if (!logMap.has(log.employee_id)) logMap.set(log.employee_id, []);
        logMap.get(log.employee_id)!.push(log);
      }

      const approvalMap = new Map<string, any>();
      for (const a of approvals) {
        approvalMap.set(a.employee_id, a);
      }

      // Calculate travel minutes from timestamps
      const calcTravelMin = (log: any): number => {
        if (!log.travel_start_time || !log.site_arrival_time) return 0;
        const diff = new Date(log.site_arrival_time).getTime() - new Date(log.travel_start_time).getTime();
        return Math.max(0, Math.round(diff / 60000));
      };

      const todayStr = new Date().toISOString().slice(0, 10);
      const empLeaveSet = (empId: string) => leaveMap.get(empId) ?? new Set<string>();

      const rows: TimesheetRow[] = employees.map((emp) => {
        const empLogs = logMap.get(emp.id) ?? [];
        const dailyHours: Record<string, number> = {};
        const dailyOt: Record<string, number> = {};
        const dailyWorkMinutes: Record<string, number> = {};
        const dailyStatus: Record<string, DayStatus> = {};
        let totalHours = 0;
        let totalOt = 0;
        let totalBreakMinutes = 0;
        let totalTravelMinutes = 0;
        let regularCost = 0;
        let otCost = 0;
        let daysAbsent = 0;
        let daysLeave = 0;

        const logDateSet = new Set(empLogs.map((l) => l.date));
        const lvSet = empLeaveSet(emp.id);

        for (const log of empLogs) {
          // Compute work minutes: use stored value, or fall back to work_start/end timestamps
          let mins = log.total_work_minutes ?? 0;
          if (mins === 0 && log.work_start_time && log.work_end_time) {
            const diff = new Date(log.work_end_time).getTime() - new Date(log.work_start_time).getTime();
            mins = Math.max(0, Math.round(diff / 60000) - (log.break_minutes ?? 0));
          }
          const h = Math.round((mins / 60) * 10) / 10;
          const ot = Math.round(((log.overtime_minutes ?? 0) / 60) * 10) / 10;
          dailyHours[log.date] = h;
          dailyOt[log.date] = ot;
          dailyWorkMinutes[log.date] = mins;
          dailyStatus[log.date] = "present";
          totalHours += h;
          totalOt += ot;
          totalBreakMinutes += log.break_minutes ?? 0;
          totalTravelMinutes += calcTravelMin(log);
          regularCost += Number(log.regular_cost ?? 0);
          otCost += Number(log.overtime_cost ?? 0);
        }

        // Fill non-worked days
        for (let d = 1; d <= daysInMonth; d++) {
          const ds = `${month}-${String(d).padStart(2, "0")}`;
          if (logDateSet.has(ds)) continue;
          if (ds > todayStr) {
            dailyStatus[ds] = "future";
          } else if (lvSet.has(ds)) {
            dailyStatus[ds] = "leave";
            daysLeave++;
          } else {
            // Check if it's a weekday (not Friday in UAE context — skip weekend logic, just mark absent for past workdays)
            dailyStatus[ds] = "absent";
            daysAbsent++;
          }
        }

        const approval = approvalMap.get(emp.id);

        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_code: emp.employee_code,
          skill_type: emp.skill_type,
          dailyHours,
          dailyOt,
          dailyWorkMinutes,
          dailyStatus,
          totalHours: Math.round(totalHours * 10) / 10,
          totalOt: Math.round(totalOt * 10) / 10,
          totalBreakMinutes,
          totalTravelMinutes,
          regularCost: Math.round(regularCost),
          otCost: Math.round(otCost),
          totalPay: Math.round(regularCost + otCost),
          daysWorked: empLogs.length,
          daysAbsent,
          daysLeave,
          approvalStatus: approval?.status ?? null,
          approvalId: approval?.id ?? null,
        };
      });

      // Project-wise grouping
      const projectGroups = new Map<string, { employees: Map<string, any>; }>();
      for (const log of logs) {
        const pid = log.project_id ?? "unassigned";
        if (!projectGroups.has(pid)) projectGroups.set(pid, { employees: new Map() });
        const group = projectGroups.get(pid)!;
        if (!group.employees.has(log.employee_id)) {
          const emp = employees.find((e) => e.id === log.employee_id);
          group.employees.set(log.employee_id, {
            employee_id: log.employee_id,
            employee_name: emp?.name ?? "Unknown",
            employee_code: emp?.employee_code ?? "—",
            skill_type: emp?.skill_type ?? "—",
            totalHours: 0, totalOt: 0, totalBreakMinutes: 0, totalTravelMinutes: 0,
            regularCost: 0, otCost: 0, totalPay: 0, daysWorked: 0,
          });
        }
        const empData = group.employees.get(log.employee_id)!;
        const h = (log.total_work_minutes ?? 0) / 60;
        const ot = (log.overtime_minutes ?? 0) / 60;
        empData.totalHours += h;
        empData.totalOt += ot;
        empData.totalBreakMinutes += log.break_minutes ?? 0;
        empData.totalTravelMinutes += calcTravelMin(log);
        empData.regularCost += Number(log.regular_cost ?? 0);
        empData.otCost += Number(log.overtime_cost ?? 0);
        empData.daysWorked += 1;
      }

      const projectRows: ProjectTimesheetRow[] = Array.from(projectGroups.entries()).map(([pid, group]) => {
        const empList = Array.from(group.employees.values()).map((e) => ({
          ...e,
          totalHours: Math.round(e.totalHours * 10) / 10,
          totalOt: Math.round(e.totalOt * 10) / 10,
          regularCost: Math.round(e.regularCost),
          otCost: Math.round(e.otCost),
          totalPay: Math.round(e.regularCost + e.otCost),
        }));
        return {
          project_id: pid,
          project_name: pid === "unassigned" ? "Unassigned" : (projectMap.get(pid) ?? "Unknown Project"),
          employees: empList,
          totalHours: Math.round(empList.reduce((s, e) => s + e.totalHours, 0) * 10) / 10,
          totalOt: Math.round(empList.reduce((s, e) => s + e.totalOt, 0) * 10) / 10,
          totalCost: empList.reduce((s, e) => s + e.totalPay, 0),
        };
      }).sort((a, b) => b.totalCost - a.totalCost);

      return {
        rows,
        projectRows,
        daysInMonth,
        startDate,
        endDate,
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
        employees: employees.map((e) => ({ id: e.id, name: e.name })),
      };
    },
  });
}

export function useApproveTimesheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employee_id: string;
      month: string;
      status: "approved" | "rejected";
      approval_notes?: string;
      total_hours: number;
      total_ot_hours: number;
      total_regular_cost: number;
      total_ot_cost: number;
      days_worked: number;
    }) => {
      const { employee_id, month, status, approval_notes, ...totals } = payload;
      const { error } = await supabase
        .from("timesheet_approvals")
        .upsert(
          {
            employee_id,
            month,
            status,
            approval_notes: approval_notes ?? null,
            ...totals,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "employee_id,month" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["timesheet-data"] }),
  });
}
