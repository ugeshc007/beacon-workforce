import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().split("T")[0];
}

export interface DashboardStats {
  activeProjects: number;
  todayAssigned: number;
  present: number;
  absent: number;
  traveling: number;
  working: number;
  todayLaborCost: number;
  totalOtHours: number;
}

export interface TeamMember {
  name: string;
  project: string;
  status: "present" | "traveling" | "absent" | "planned" | "overtime";
  punchIn: string;
  arrival: string;
  workStart: string;
  ot: string;
}

export interface DashboardAlert {
  type: string;
  message: string;
  time: string;
  priority: "high" | "normal";
}

export interface ActiveProject {
  name: string;
  client: string;
  staffAssigned: number;
  staffRequired: number;
  health: number;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = todayUAE();

      const [projectsRes, assignmentsRes, attendanceRes] = await Promise.all([
        supabase
          .from("projects")
          .select("id", { count: "exact" })
          .in("status", ["in_progress"]),
        supabase
          .from("project_assignments")
          .select("employee_id", { count: "exact" })
          .eq("date", today),
        supabase
          .from("attendance_logs")
          .select("employee_id, office_punch_in, travel_start_time, site_arrival_time, work_start_time, work_end_time, overtime_minutes, regular_cost, overtime_cost")
          .eq("date", today),
      ]);

      const logs = attendanceRes.data ?? [];
      const assignedCount = assignmentsRes.count ?? 0;

      let present = 0;
      let traveling = 0;
      let working = 0;
      let totalOtMin = 0;
      let totalCost = 0;

      const punchedIds = new Set<string>();

      for (const log of logs) {
        punchedIds.add(log.employee_id);
        if (log.work_start_time && !log.work_end_time) working++;
        if (log.travel_start_time && !log.site_arrival_time) traveling++;
        if (log.office_punch_in) present++;
        totalOtMin += log.overtime_minutes ?? 0;
        totalCost += Number(log.regular_cost ?? 0) + Number(log.overtime_cost ?? 0);
      }

      const absent = Math.max(0, assignedCount - punchedIds.size);

      const stats: DashboardStats = {
        activeProjects: projectsRes.count ?? 0,
        todayAssigned: assignedCount,
        present,
        absent,
        traveling,
        working,
        todayLaborCost: Math.round(totalCost),
        totalOtHours: Math.round((totalOtMin / 60) * 10) / 10,
      };
      return stats;
    },
    refetchInterval: 30000,
  });
}

export function useTodayTeam() {
  return useQuery({
    queryKey: ["dashboard-team"],
    queryFn: async () => {
      const today = todayUAE();

      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("employee_id, projects(name)")
        .eq("date", today);

      if (!assignments?.length) return [] as TeamMember[];

      const empIds = assignments.map((a) => a.employee_id);

      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("employee_id, office_punch_in, site_arrival_time, work_start_time, work_end_time, travel_start_time, overtime_minutes")
        .eq("date", today)
        .in("employee_id", empIds);

      const { data: employees } = await supabase
        .from("employees")
        .select("id, name")
        .in("id", empIds);

      const empMap = new Map((employees ?? []).map((e) => [e.id, e.name]));
      const logMap = new Map((logs ?? []).map((l) => [l.employee_id, l]));

      const fmt = (ts: string | null) => {
        if (!ts) return "—";
        return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
      };

      const team: TeamMember[] = assignments.map((a) => {
        const log = logMap.get(a.employee_id);
        let status: TeamMember["status"] = "absent";
        if (log) {
          if (log.work_start_time && !log.work_end_time) status = "present";
          else if (log.travel_start_time && !log.site_arrival_time) status = "traveling";
          else if (log.office_punch_in) status = "present";
        }
        const otMin = log?.overtime_minutes ?? 0;
        return {
          name: empMap.get(a.employee_id) ?? "Unknown",
          project: (a.projects as any)?.name ?? "—",
          status,
          punchIn: fmt(log?.office_punch_in ?? null),
          arrival: fmt(log?.site_arrival_time ?? null),
          workStart: fmt(log?.work_start_time ?? null),
          ot: otMin > 0 ? `${Math.round((otMin / 60) * 10) / 10}h` : "0h",
        };
      });

      return team;
    },
    refetchInterval: 30000,
  });
}

export function useDashboardAlerts() {
  return useQuery({
    queryKey: ["dashboard-alerts"],
    queryFn: async () => {
      const today = todayUAE();

      // Get assigned employees who haven't punched in
      const [assignRes, attendRes] = await Promise.all([
        supabase
          .from("project_assignments")
          .select("employee_id, projects(name)")
          .eq("date", today),
        supabase
          .from("attendance_logs")
          .select("employee_id, overtime_minutes, work_start_time, total_work_minutes")
          .eq("date", today),
      ]);

      const assignments = assignRes.data ?? [];
      const logs = attendRes.data ?? [];
      const logMap = new Map(logs.map((l) => [l.employee_id, l]));

      const empIds = [...new Set(assignments.map((a) => a.employee_id))];
      const { data: emps } = await supabase.from("employees").select("id, name, standard_hours_per_day").in("id", empIds);
      const empMap = new Map((emps ?? []).map((e) => [e.id, e]));

      const alerts: DashboardAlert[] = [];

      for (const a of assignments) {
        const log = logMap.get(a.employee_id);
        const emp = empMap.get(a.employee_id);
        const projName = (a.projects as any)?.name ?? "";

        if (!log) {
          alerts.push({
            type: "absent",
            message: `${emp?.name ?? "Unknown"} has not punched in — ${projName} may need replacement`,
            time: "Today",
            priority: "high",
          });
        } else if (log.total_work_minutes && emp?.standard_hours_per_day) {
          const stdMin = Number(emp.standard_hours_per_day) * 60;
          if (log.total_work_minutes > stdMin * 0.9 && !log.overtime_minutes) {
            alerts.push({
              type: "overtime",
              message: `${emp?.name ?? "Unknown"} approaching OT limit (${Math.round(log.total_work_minutes / 60 * 10) / 10}h worked)`,
              time: "Today",
              priority: "normal",
            });
          }
        }
      }

      return alerts.slice(0, 10);
    },
    refetchInterval: 60000,
  });
}

export function useActiveProjects() {
  return useQuery({
    queryKey: ["dashboard-active-projects"],
    queryFn: async () => {
      const today = todayUAE();

      const { data: projects } = await supabase
        .from("projects")
        .select("id, name, client_name, required_technicians, required_helpers, required_supervisors, health_score")
        .in("status", ["in_progress"])
        .order("name")
        .limit(5);

      if (!projects?.length) return [] as ActiveProject[];

      const projIds = projects.map((p) => p.id);
      const { data: assigns } = await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("date", today)
        .in("project_id", projIds);

      const countMap = new Map<string, number>();
      for (const a of assigns ?? []) {
        countMap.set(a.project_id, (countMap.get(a.project_id) ?? 0) + 1);
      }

      return projects.map((p) => ({
        name: p.name,
        client: p.client_name ?? "—",
        staffAssigned: countMap.get(p.id) ?? 0,
        staffRequired: p.required_technicians + p.required_helpers + p.required_supervisors,
        health: p.health_score ?? 100,
      }));
    },
    refetchInterval: 60000,
  });
}

export function useDashboardRealtime() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["dashboard-team"] });
        qc.invalidateQueries({ queryKey: ["dashboard-alerts"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "project_assignments" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
        qc.invalidateQueries({ queryKey: ["dashboard-team"] });
        qc.invalidateQueries({ queryKey: ["dashboard-active-projects"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
