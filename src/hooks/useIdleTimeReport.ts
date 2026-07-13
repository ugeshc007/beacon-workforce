import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeIdle, type IdleResult, type IdleReason } from "@/lib/idle-time";

export type IdleDayRow = {
  logId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  skill: string;
  branchId: string | null;
  date: string;
  projectName: string | null;
  result: IdleResult;
};

export type IdleEmployeeRow = {
  employeeId: string;
  name: string;
  code: string;
  skill: string;
  branchId: string | null;
  daysWorked: number;
  shiftMin: number;
  productiveMin: number;
  breakMin: number;
  idleMin: number;
  reasonCounts: Partial<Record<IdleReason, number>>;
  days: IdleDayRow[];
};

export type IdleReport = {
  employees: IdleEmployeeRow[];
  totals: {
    idleMin: number;
    shiftMin: number;
    productiveMin: number;
    employeesWithIdle: number;
    avgIdlePerEmpPerDayMin: number;
    worst: { name: string; idleMin: number } | null;
  };
};

export function useIdleTimeReport(startDate: string, endDate: string, opts?: {
  branchId?: string;
  projectId?: string;
  skillType?: string;
  minIdleMin?: number;
}) {
  return useQuery({
    queryKey: ["idle-time-report", startDate, endDate, opts],
    queryFn: async (): Promise<IdleReport> => {
      // 1. Attendance logs in range
      const { data: logsData, error } = await supabase
        .from("attendance_logs")
        .select("id, employee_id, date, project_id, office_punch_in, office_punch_out, travel_start_time, site_arrival_time, return_travel_start_time, office_arrival_time, work_start_time, work_end_time, break_minutes, employees(name, employee_code, skill_type, branch_id), projects(name)")
        .gte("date", startDate)
        .lte("date", endDate)
        .not("office_punch_in", "is", null);
      if (error) throw error;
      let logs = (logsData ?? []) as any[];

      if (opts?.branchId && opts.branchId !== "all") {
        logs = logs.filter((l) => l.employees?.branch_id === opts.branchId);
      }
      if (opts?.skillType && opts.skillType !== "all") {
        logs = logs.filter((l) => l.employees?.skill_type === opts.skillType);
      }

      const logIds = logs.map((l) => l.id);
      const employeeIds = Array.from(new Set(logs.map((l) => l.employee_id)));

      // 2. Sessions for those logs
      let sessionsByLog = new Map<string, any[]>();
      if (logIds.length) {
        const { data: sess } = await supabase
          .from("project_work_sessions")
          .select("attendance_log_id, project_id, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time")
          .in("attendance_log_id", logIds)
          .order("created_at", { ascending: true });
        for (const s of (sess ?? []) as any[]) {
          const arr = sessionsByLog.get(s.attendance_log_id) ?? [];
          arr.push(s);
          sessionsByLog.set(s.attendance_log_id, arr);
        }
      }

      // 3. Project assignments in range (to detect "no assignment")
      let assignmentsByKey = new Set<string>(); // `${emp}:${date}`
      if (employeeIds.length) {
        const { data: assigns } = await supabase
          .from("project_assignments")
          .select("employee_id, date, project_id")
          .gte("date", startDate)
          .lte("date", endDate)
          .in("employee_id", employeeIds);
        for (const a of assigns ?? []) {
          assignmentsByKey.add(`${a.employee_id}:${a.date}`);
        }
      }

      // Optional project filter
      if (opts?.projectId && opts.projectId !== "all") {
        const keep = new Set<string>();
        // include if session or log project matches
        for (const l of logs) {
          const sess = sessionsByLog.get(l.id) ?? [];
          if (l.project_id === opts.projectId || sess.some((s: any) => s.project_id === opts.projectId)) {
            keep.add(l.id);
          }
        }
        logs = logs.filter((l) => keep.has(l.id));
      }

      // 4. Build per-log rows
      const empMap = new Map<string, IdleEmployeeRow>();

      for (const l of logs) {
        const sessions = sessionsByLog.get(l.id) ?? [];
        const hasAssignment = assignmentsByKey.has(`${l.employee_id}:${l.date}`) || !!l.project_id || sessions.length > 0;
        const result = computeIdle({
          office_punch_in: l.office_punch_in,
          office_punch_out: l.office_punch_out,
          travel_start_time: l.travel_start_time,
          site_arrival_time: l.site_arrival_time,
          return_travel_start_time: l.return_travel_start_time,
          office_arrival_time: l.office_arrival_time,
          work_start_time: l.work_start_time,
          work_end_time: l.work_end_time,
          break_minutes: l.break_minutes,
          sessions: sessions.map((s: any) => ({
            travel_start_time: s.travel_start_time,
            site_arrival_time: s.site_arrival_time,
            work_start_time: s.work_start_time,
            break_start_time: s.break_start_time,
            break_end_time: s.break_end_time,
            work_end_time: s.work_end_time,
            return_travel_start_time: s.return_travel_start_time,
          })),
          hasAssignment,
        });

        const day: IdleDayRow = {
          logId: l.id,
          employeeId: l.employee_id,
          employeeName: l.employees?.name ?? "—",
          employeeCode: l.employees?.employee_code ?? "",
          skill: l.employees?.skill_type ?? "—",
          branchId: l.employees?.branch_id ?? null,
          date: l.date,
          projectName: l.projects?.name ?? null,
          result,
        };

        const key = l.employee_id;
        let emp = empMap.get(key);
        if (!emp) {
          emp = {
            employeeId: key,
            name: day.employeeName,
            code: day.employeeCode,
            skill: day.skill,
            branchId: day.branchId,
            daysWorked: 0,
            shiftMin: 0,
            productiveMin: 0,
            breakMin: 0,
            idleMin: 0,
            reasonCounts: {},
            days: [],
          };
          empMap.set(key, emp);
        }
        // Only count completed shifts in totals
        if (!result.inProgress) {
          emp.daysWorked += 1;
          emp.shiftMin += result.shiftMin;
          emp.productiveMin += result.productiveMin;
          emp.breakMin += result.breakMin;
          emp.idleMin += result.idleMin;
          for (const r of result.reasons) {
            emp.reasonCounts[r] = (emp.reasonCounts[r] ?? 0) + 1;
          }
        }
        emp.days.push(day);
      }

      let employees = Array.from(empMap.values()).sort((a, b) => b.idleMin - a.idleMin);
      if (opts?.minIdleMin && opts.minIdleMin > 0) {
        employees = employees.filter((e) => e.idleMin >= opts.minIdleMin!);
      }

      const totalIdle = employees.reduce((a, e) => a + e.idleMin, 0);
      const totalShift = employees.reduce((a, e) => a + e.shiftMin, 0);
      const totalProductive = employees.reduce((a, e) => a + e.productiveMin, 0);
      const totalDays = employees.reduce((a, e) => a + e.daysWorked, 0);
      const withIdle = employees.filter((e) => e.idleMin > 0).length;
      const worst = employees.find((e) => e.idleMin > 0) ?? null;

      return {
        employees,
        totals: {
          idleMin: totalIdle,
          shiftMin: totalShift,
          productiveMin: totalProductive,
          employeesWithIdle: withIdle,
          avgIdlePerEmpPerDayMin: totalDays > 0 ? Math.round(totalIdle / totalDays) : 0,
          worst: worst ? { name: worst.name, idleMin: worst.idleMin } : null,
        },
      };
    },
  });
}
