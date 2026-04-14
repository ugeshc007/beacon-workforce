import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Users, ChevronRight, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface ProjectSummary {
  id: string;
  name: string;
  site_address: string | null;
  assignmentCount: number;
}

interface Props {
  date: string;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
}

const statusEmoji: Record<string, string> = {
  completed: "✅",
  in_progress: "🔄",
  on_hold: "⏸️",
  pending: "⏳",
};

const statusColor: Record<string, string> = {
  completed: "text-green-400",
  in_progress: "text-brand",
  on_hold: "text-amber-400",
  pending: "text-muted-foreground",
};

export function ScheduleTaskSummary({ date, projects, onSelectProject }: Props) {
  const { data: allLogs } = useQuery({
    queryKey: ["schedule-task-summary", date],
    queryFn: async () => {
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length === 0) return [];
      const { data } = await supabase
        .from("project_daily_logs")
        .select("id, project_id, description, status, completion_pct, issues")
        .eq("date", date)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: projects.length > 0,
  });

  const dayLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });

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
      {projects.map((project) => {
        const logs = (allLogs ?? []).filter((l) => l.project_id === project.id && l.status !== "completed");
        return (
          <Card
            key={project.id}
            className="cursor-pointer hover:border-brand/40 transition-all"
            onClick={() => onSelectProject(project.id)}
          >
            <CardContent className="p-4 space-y-2">
              {/* Project header */}
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{project.name}</p>
                  {project.site_address && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">{project.site_address}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">
                    <Users className="h-3 w-3 mr-1" />{project.assignmentCount}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Tasks */}
              {logs.length > 0 ? (
                <div className="space-y-1 pl-1">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2 text-sm">
                      <span className="shrink-0">{statusEmoji[log.status ?? "pending"] ?? "⏳"}</span>
                      <span className={`${statusColor[log.status ?? "pending"]} leading-tight`}>
                        {log.description}
                        {log.completion_pct !== null && (
                          <span className="text-muted-foreground text-xs ml-1">({log.completion_pct}%)</span>
                        )}
                        {log.issues && (
                          <span className="text-amber-400 text-xs ml-1">⚠️ {log.issues}</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pl-1">No tasks logged</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
