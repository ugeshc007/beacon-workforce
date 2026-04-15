import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Card } from "@/components/ui/card";
import { Loader2, User, MapPin, Clock } from "lucide-react";

interface TeamMemberStatus {
  id: string;
  name: string;
  employeeCode: string;
  step: string;
  lastPunchIn: string | null;
  projectName: string | null;
}

const stepDisplayMap: Record<string, { label: string; color: string; dot: string }> = {
  idle: { label: "Not Started", color: "text-muted-foreground", dot: "bg-muted-foreground" },
  punched_in: { label: "Punched In", color: "text-blue-400", dot: "bg-blue-400" },
  traveling: { label: "Traveling", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
  at_site: { label: "At Site", color: "text-cyan-400", dot: "bg-cyan-400" },
  working: { label: "Working", color: "text-green-400", dot: "bg-green-400 animate-pulse" },
  on_break: { label: "On Break", color: "text-orange-400", dot: "bg-orange-400" },
  work_done: { label: "Work Done", color: "text-purple-400", dot: "bg-purple-400" },
  punched_out: { label: "Day Complete", color: "text-muted-foreground", dot: "bg-green-500" },
};

function deriveStep(log: any): string {
  if (!log) return "idle";
  if (log.office_punch_out) return "punched_out";
  if (log.work_end_time) return "work_done";
  if (log.break_start_time && !log.break_end_time) return "on_break";
  if (log.work_start_time) return "working";
  if (log.site_arrival_time) return "at_site";
  if (log.travel_start_time) return "traveling";
  if (log.office_punch_in) return "punched_in";
  return "idle";
}

export default function MobileTeamStatus() {
  const { employee } = useMobileAuth();
  const [members, setMembers] = useState<TeamMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const today = toLocalDateStr(new Date());

  useEffect(() => {
    if (!employee) return;

    const fetchTeam = async () => {
      setLoading(true);

      // Get today's assignments for the same projects as this employee
      const { data: myAssignments } = await supabase
        .from("project_assignments")
        .select("project_id")
        .eq("employee_id", employee.id)
        .eq("date", today);

      if (!myAssignments?.length) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const projectIds = myAssignments.map((a) => a.project_id);

      // Get all team members assigned to same projects today
      const { data: teamAssignments } = await supabase
        .from("project_assignments")
        .select("employee_id, projects(name), employees(id, name, employee_code)")
        .in("project_id", projectIds)
        .eq("date", today);

      if (!teamAssignments?.length) {
        setMembers([]);
        setLoading(false);
        return;
      }

      // Deduplicate employees
      const uniqueEmployees = new Map<string, { name: string; code: string; projectName: string }>();
      for (const ta of teamAssignments) {
        const emp = ta.employees as any;
        const proj = ta.projects as any;
        if (emp && emp.id !== employee.id) {
          uniqueEmployees.set(emp.id, {
            name: emp.name,
            code: emp.employee_code,
            projectName: proj?.name || "Unknown",
          });
        }
      }

      // Get attendance logs for all team members
      const empIds = Array.from(uniqueEmployees.keys());
      if (empIds.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("employee_id, office_punch_in, travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, office_punch_out")
        .in("employee_id", empIds)
        .eq("date", today);

      const logMap = new Map<string, any>();
      logs?.forEach((l) => logMap.set(l.employee_id, l));

      const result: TeamMemberStatus[] = empIds.map((id) => {
        const info = uniqueEmployees.get(id)!;
        const log = logMap.get(id);
        return {
          id,
          name: info.name,
          employeeCode: info.code,
          step: deriveStep(log),
          lastPunchIn: log?.office_punch_in || null,
          projectName: info.projectName,
        };
      });

      // Sort: working first, then by name
      result.sort((a, b) => {
        const order = ["working", "traveling", "at_site", "on_break", "punched_in", "work_done", "punched_out", "idle"];
        return order.indexOf(a.step) - order.indexOf(b.step);
      });

      setMembers(result);
      setLoading(false);
    };

    fetchTeam();

    // Refresh every 30 seconds
    const interval = setInterval(fetchTeam, 30_000);
    return () => clearInterval(interval);
  }, [employee, today]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      <h1 className="text-xl font-bold text-foreground">Team Status</h1>
      <p className="text-sm text-muted-foreground">
        {members.length} team member{members.length !== 1 ? "s" : ""} assigned today
      </p>

      {members.length === 0 ? (
        <Card className="p-6 text-center border-border/50 bg-card">
          <User className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No team members assigned today</p>
        </Card>
      ) : (
        members.map((m) => {
          const display = stepDisplayMap[m.step] || stepDisplayMap.idle;
          return (
            <Card key={m.id} className="p-4 border-border/50 bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-foreground text-sm truncate">{m.name}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className={`w-2 h-2 rounded-full ${display.dot}`} />
                      <span className={`text-xs font-medium ${display.color}`}>{display.label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-muted-foreground">{m.employeeCode}</span>
                    {m.projectName && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {m.projectName}
                      </span>
                    )}
                    {m.lastPunchIn && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {new Date(m.lastPunchIn).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
