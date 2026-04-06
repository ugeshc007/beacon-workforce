import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimesheetRow {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  skill_type: string;
  dailyHours: Record<string, number>; // date -> hours
  dailyOt: Record<string, number>;
  totalHours: number;
  totalOt: number;
  regularCost: number;
  otCost: number;
  daysWorked: number;
  approvalStatus: string | null;
  approvalId: string | null;
}

export function useTimesheetData(month: string, branchId?: string) {
  // month format: "2026-04"
  return useQuery({
    queryKey: ["timesheet-data", month, branchId],
    queryFn: async () => {
      const startDate = `${month}-01`;
      const endParts = month.split("-");
      const year = parseInt(endParts[0]);
      const mon = parseInt(endParts[1]);
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
      const daysInMonth = lastDay;

      // Fetch employees
      let empQuery = supabase
        .from("employees")
        .select("id, name, employee_code, skill_type, branch_id")
        .eq("is_active", true)
        .order("name");

      if (branchId && branchId !== "all") {
        empQuery = empQuery.eq("branch_id", branchId);
      }

      const [empRes, logsRes, approvalsRes] = await Promise.all([
        empQuery,
        supabase
          .from("attendance_logs")
          .select("employee_id, date, total_work_minutes, overtime_minutes, regular_cost, overtime_cost")
          .gte("date", startDate)
          .lte("date", endDate),
        supabase
          .from("timesheet_approvals" as any)
          .select("id, employee_id, status, month")
          .eq("month", month),
      ]);

      const employees = empRes.data ?? [];
      const logs = logsRes.data ?? [];
      const approvals = (approvalsRes.data ?? []) as any[];

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

      const rows: TimesheetRow[] = employees.map((emp) => {
        const empLogs = logMap.get(emp.id) ?? [];
        const dailyHours: Record<string, number> = {};
        const dailyOt: Record<string, number> = {};
        let totalHours = 0;
        let totalOt = 0;
        let regularCost = 0;
        let otCost = 0;

        for (const log of empLogs) {
          const h = Math.round(((log.total_work_minutes ?? 0) / 60) * 10) / 10;
          const ot = Math.round(((log.overtime_minutes ?? 0) / 60) * 10) / 10;
          dailyHours[log.date] = h;
          dailyOt[log.date] = ot;
          totalHours += h;
          totalOt += ot;
          regularCost += Number(log.regular_cost ?? 0);
          otCost += Number(log.overtime_cost ?? 0);
        }

        const approval = approvalMap.get(emp.id);

        return {
          employee_id: emp.id,
          employee_name: emp.name,
          employee_code: emp.employee_code,
          skill_type: emp.skill_type,
          dailyHours,
          dailyOt,
          totalHours: Math.round(totalHours * 10) / 10,
          totalOt: Math.round(totalOt * 10) / 10,
          regularCost: Math.round(regularCost),
          otCost: Math.round(otCost),
          daysWorked: empLogs.length,
          approvalStatus: approval?.status ?? null,
          approvalId: approval?.id ?? null,
        };
      });

      return { rows, daysInMonth, startDate, endDate };
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

      // Upsert
      const { error } = await supabase
        .from("timesheet_approvals" as any)
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
