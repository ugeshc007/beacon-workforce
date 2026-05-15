import { Button } from "@/components/ui/button";
import { ClipboardList, Copy, Edit2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ProjectSummary {
  id: string;
  name: string;
  site_address: string | null;
  assignmentCount: number;
}

interface AssignmentLite {
  project_id: string;
  employee_name: string;
  employee_skill?: string;
  assigned_role?: string;
  shift_start: string | null;
  shift_end: string | null;
}

interface Props {
  date: string;
  projects: ProjectSummary[];
  assignments?: AssignmentLite[];
  onSelectProject: (projectId: string) => void;
  onCopyProject?: (projectId: string, projectName: string) => void;
}

const fmtTime = (t: string | null) => {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = parseInt(h, 10);
  const period = hr >= 12 ? "PM" : "AM";
  const display = hr === 0 ? 12 : hr > 12 ? hr - 12 : hr;
  return `${display}:${m} ${period}`;
};

export function ScheduleTaskSummary({ date, projects, assignments = [], onSelectProject, onCopyProject }: Props) {
  const { data: allLogs } = useQuery({
    queryKey: ["schedule-task-summary", date],
    queryFn: async () => {
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length === 0) return [];

      const { data: todayLogs } = await supabase
        .from("project_daily_logs")
        .select("id, project_id, description, status, completion_pct, issues, date")
        .eq("date", date)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });

      const { data: pendingLogs } = await supabase
        .from("project_daily_logs")
        .select("id, project_id, description, status, completion_pct, issues, date")
        .lt("date", date)
        .in("status", ["pending", "in_progress"])
        .in("project_id", projectIds)
        .order("date", { ascending: false });

      return [...(todayLogs ?? []), ...(pendingLogs ?? [])];
    },
    enabled: projects.length > 0,
  });

  const dateObj = new Date(date + "T00:00:00");
  const dayLabel = dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "/");
  const dayName = dateObj.toLocaleDateString("en-GB", { weekday: "long" }).toUpperCase();

  if (projects.length === 0) {
    return (
      <div className="text-center py-8">
        <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No scheduled tasks for {dayLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{dayLabel} — Scheduled Tasks</h2>

      <div className="rounded-lg border border-border/60 overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1100px]">
            <thead>
              <tr className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold border-r border-border/40">Date / Day</th>
                <th className="px-3 py-2 text-left font-semibold border-r border-border/40">Project Name</th>
                <th className="px-3 py-2 text-left font-semibold border-r border-border/40">Task / Mission</th>
                <th className="px-3 py-2 text-center font-semibold border-r border-border/40">Technical Team</th>
                <th className="px-3 py-2 text-left font-semibold border-r border-border/40">Location</th>
                <th className="px-3 py-2 text-center font-semibold border-r border-border/40">In</th>
                <th className="px-3 py-2 text-center font-semibold border-r border-border/40">Out</th>
                <th className="px-3 py-2 text-center font-semibold border-r border-border/40">Driver</th>
                <th className="px-3 py-2 text-left font-semibold border-r border-border/40">Remarks</th>
                <th className="px-3 py-2 text-center font-semibold">Ops</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const projAssign = assignments.filter((a) => a.project_id === project.id);
                const team = projAssign.filter(
                  (a) => (a.assigned_role ?? a.employee_skill) !== "driver"
                );
                const drivers = projAssign.filter(
                  (a) => (a.assigned_role ?? a.employee_skill) === "driver"
                );
                const logs = (allLogs ?? []).filter((l) => l.project_id === project.id && l.status !== "completed");
                const todayLogs = logs.filter((l) => l.date === date);
                const carriedLogs = logs.filter((l) => l.date !== date);
                const shiftStart = projAssign[0]?.shift_start ?? "08:00";
                const shiftEnd = projAssign[0]?.shift_end ?? "17:00";

                return (
                  <tr
                    key={project.id}
                    className="border-t border-border/40 hover:bg-muted/20 cursor-pointer transition-colors"
                    onClick={() => onSelectProject(project.id)}
                  >
                    <td className="px-3 py-3 align-middle border-r border-border/40 text-center">
                      <div className="font-semibold text-foreground">{dateStr}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{dayName}</div>
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40">
                      <div className="font-semibold text-foreground">{project.name}</div>
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40">
                      {todayLogs.length === 0 && carriedLogs.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-1">
                          {todayLogs.map((log) => (
                            <div key={log.id} className="text-xs text-foreground leading-tight">
                              • {log.description}
                              {log.completion_pct !== null && (
                                <span className="text-muted-foreground ml-1">({log.completion_pct}%)</span>
                              )}
                            </div>
                          ))}
                          {carriedLogs.map((log) => (
                            <div key={log.id} className="text-xs text-amber-400 leading-tight">
                              ⏳ {log.description}
                              <span className="text-muted-foreground text-[10px] ml-1">
                                (from {new Date(log.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40 text-center">
                      {team.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {team.map((a, i) => (
                            <div key={i} className="text-xs font-medium text-foreground uppercase">
                              {a.employee_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40">
                      <span className="text-xs text-muted-foreground">{project.site_address ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40 text-center font-mono text-xs">
                      {fmtTime(shiftStart)}
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40 text-center font-mono text-xs">
                      {fmtTime(shiftEnd)}
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40 text-center">
                      {drivers.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="space-y-0.5">
                          {drivers.map((d, i) => (
                            <div key={i} className="text-xs font-medium text-foreground uppercase">
                              {d.employee_name}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle border-r border-border/40">
                      <span className="text-xs text-muted-foreground">—</span>
                    </td>
                    <td className="px-3 py-3 align-middle text-center">
                      <div className="flex items-center justify-center gap-1">
                        {onCopyProject && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            title="Copy to date"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCopyProject(project.id, project.name);
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectProject(project.id);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
