import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AvailabilityStatus = "available" | "partial" | "booked" | "on_leave";

export interface AvailableEmployee {
  id: string;
  name: string;
  employee_code: string;
  skill_type: string;
  custom_skill_name: string | null;
  designation: string | null;
  status: AvailabilityStatus;
  assignments: { project_id: string; project_name: string; shift_start: string | null; shift_end: string | null }[];
  leaveReason?: string | null;
}

export function useAvailableEmployees(date: string | null) {
  return useQuery({
    queryKey: ["available-employees", date],
    enabled: !!date,
    queryFn: async () => {
      const [empRes, assignRes, leaveRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, name, employee_code, skill_type, designation, custom_skills(name)")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("project_assignments")
          .select("employee_id, shift_start, shift_end, project_id, projects(name)")
          .eq("date", date!),
        supabase
          .from("employee_leave")
          .select("employee_id, reason")
          .lte("start_date", date!)
          .gte("end_date", date!),
      ]);

      if (empRes.error) throw empRes.error;
      if (assignRes.error) throw assignRes.error;
      if (leaveRes.error) throw leaveRes.error;

      const assignByEmp = new Map<string, AvailableEmployee["assignments"]>();
      for (const a of assignRes.data ?? []) {
        const arr = assignByEmp.get(a.employee_id) ?? [];
        arr.push({
          project_id: a.project_id,
          project_name: (a.projects as any)?.name ?? "Unknown",
          shift_start: a.shift_start,
          shift_end: a.shift_end,
        });
        assignByEmp.set(a.employee_id, arr);
      }

      const leaveByEmp = new Map<string, string | null>();
      for (const l of leaveRes.data ?? []) leaveByEmp.set(l.employee_id, l.reason);

      // Official working day = 9 hours including 1 hour break (so 540 mins on-shift).
      // Treat 8h+ of shift coverage as fully Booked.
      const FULL_DAY_MIN = 540; // 9h
      const NEAR_FULL_MIN = 480; // 8h threshold
      const shiftMinutes = (s: string | null, e: string | null) => {
        if (!s || !e) return FULL_DAY_MIN; // unknown shift treated as full day
        const [sh, sm] = s.split(":").map(Number);
        const [eh, em] = e.split(":").map(Number);
        return Math.max(0, eh * 60 + em - (sh * 60 + sm));
      };

      const result: AvailableEmployee[] = (empRes.data ?? []).map((e: any) => {
        const assignments = assignByEmp.get(e.id) ?? [];
        const onLeave = leaveByEmp.has(e.id);
        const totalAssigned = assignments.reduce(
          (sum, a) => sum + shiftMinutes(a.shift_start, a.shift_end),
          0
        );
        let status: AvailabilityStatus = "available";
        if (onLeave) status = "on_leave";
        else if (assignments.length === 0) status = "available";
        else if (totalAssigned >= NEAR_FULL_MIN) status = "booked";
        else status = "partial";
        return {
          id: e.id,
          name: e.name,
          employee_code: e.employee_code,
          skill_type: e.skill_type,
          custom_skill_name: e.custom_skills?.name ?? null,
          designation: e.designation,
          status,
          assignments,
          leaveReason: onLeave ? leaveByEmp.get(e.id) : null,
        };
      });

      const counts = {
        available: result.filter((r) => r.status === "available").length,
        partial: result.filter((r) => r.status === "partial").length,
        booked: result.filter((r) => r.status === "booked").length,
        on_leave: result.filter((r) => r.status === "on_leave").length,
        total: result.length,
      };

      return { employees: result, counts };
    },
  });
}
