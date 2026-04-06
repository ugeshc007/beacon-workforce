import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import {
  addDays, startOfWeek, endOfWeek, addWeeks, subWeeks, format,
  differenceInDays, isWithinInterval, isBefore, isAfter,
} from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  planned: "bg-status-planned",
  assigned: "bg-status-planned/70",
  in_progress: "bg-status-present",
  completed: "bg-status-overtime",
};

const STATUS_BORDER: Record<string, string> = {
  planned: "border-status-planned/40",
  assigned: "border-status-planned/30",
  in_progress: "border-status-present/40",
  completed: "border-status-overtime/40",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Planned",
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function ProjectGantt() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const [weekOffset, setWeekOffset] = useState(0);

  const baseDate = useMemo(() => {
    const now = new Date();
    return weekOffset === 0 ? now : addWeeks(now, weekOffset);
  }, [weekOffset]);

  // Show 4 weeks (28 days)
  const rangeStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(addWeeks(rangeStart, 3), { weekStartsOn: 1 });
  const totalDays = differenceInDays(rangeEnd, rangeStart) + 1;

  const days = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i));
  }, [rangeStart, totalDays]);

  // Group days by week for header
  const weeks = useMemo(() => {
    const result: { start: Date; end: Date; days: Date[] }[] = [];
    for (let w = 0; w < 4; w++) {
      const ws = addWeeks(rangeStart, w);
      const we = endOfWeek(ws, { weekStartsOn: 1 });
      result.push({
        start: ws,
        end: we,
        days: Array.from({ length: 7 }, (_, i) => addDays(ws, i)),
      });
    }
    return result;
  }, [rangeStart]);

  // Filter projects that overlap with the visible range
  const visibleProjects = useMemo(() => {
    if (!projects) return [];
    return projects.filter((p) => {
      if (!p.start_date) return false;
      const pStart = new Date(p.start_date);
      const pEnd = p.end_date ? new Date(p.end_date) : pStart;
      return !(isAfter(pStart, rangeEnd) || isBefore(pEnd, rangeStart));
    }).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? ""));
  }, [projects, rangeStart, rangeEnd]);

  const projectsWithoutDates = useMemo(() => {
    return (projects ?? []).filter((p) => !p.start_date);
  }, [projects]);

  const today = new Date();
  const todayIndex = differenceInDays(today, rangeStart);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Project Timeline</h1>
            <p className="text-sm text-muted-foreground">
              {format(rangeStart, "dd MMM")} – {format(rangeEnd, "dd MMM yyyy")} · {visibleProjects.length} projects
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 4)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            <CalendarIcon className="h-4 w-4 mr-1" /> Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 4)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className={cn("h-3 w-3 rounded-sm", STATUS_COLORS[key])} />
            {label}
          </div>
        ))}
      </div>

      {/* Gantt Chart */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${200 + totalDays * 32}px` }}>
              {/* Week header */}
              <div className="flex border-b border-border">
                <div className="w-[200px] min-w-[200px] px-3 py-2 text-xs font-medium text-muted-foreground border-r border-border">
                  Project
                </div>
                <div className="flex-1 flex">
                  {weeks.map((w, wi) => (
                    <div
                      key={wi}
                      className="flex-1 text-center text-[10px] font-medium text-muted-foreground py-1 border-r border-border last:border-0"
                    >
                      {format(w.start, "dd MMM")} – {format(w.end, "dd MMM")}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day header */}
              <div className="flex border-b border-border">
                <div className="w-[200px] min-w-[200px] border-r border-border" />
                <div className="flex-1 flex">
                  {days.map((d, i) => {
                    const isToday = format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 min-w-[32px] text-center text-[9px] py-1 border-r border-border/50 last:border-0",
                          isToday && "bg-brand/20 text-brand font-bold",
                          isWeekend && !isToday && "bg-muted/30 text-muted-foreground/50",
                          !isWeekend && !isToday && "text-muted-foreground",
                        )}
                      >
                        <div>{format(d, "EEE").charAt(0)}</div>
                        <div>{format(d, "d")}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Project rows */}
              {visibleProjects.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No projects with dates in this range
                </div>
              ) : (
                visibleProjects.map((p) => {
                  const pStart = new Date(p.start_date!);
                  const pEnd = p.end_date ? new Date(p.end_date) : pStart;

                  // Calculate bar position
                  const barStartDay = Math.max(0, differenceInDays(pStart, rangeStart));
                  const barEndDay = Math.min(totalDays - 1, differenceInDays(pEnd, rangeStart));
                  const barWidth = barEndDay - barStartDay + 1;

                  const totalStaff = p.required_technicians + p.required_helpers + p.required_supervisors;

                  return (
                    <div
                      key={p.id}
                      className="flex border-b border-border/50 last:border-0 hover:bg-accent/20 transition-colors group"
                    >
                      {/* Project name */}
                      <div
                        className="w-[200px] min-w-[200px] px-3 py-2.5 border-r border-border cursor-pointer"
                        onClick={() => navigate(`/projects/${p.id}`)}
                      >
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-brand transition-colors">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {p.client_name ?? "No client"} · {totalStaff} staff
                        </p>
                      </div>

                      {/* Timeline cells */}
                      <div className="flex-1 relative flex">
                        {/* Background grid */}
                        {days.map((d, i) => {
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const isToday = format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                          return (
                            <div
                              key={i}
                              className={cn(
                                "flex-1 min-w-[32px] border-r border-border/30 last:border-0",
                                isWeekend && "bg-muted/15",
                                isToday && "bg-brand/10",
                              )}
                            />
                          );
                        })}

                        {/* Bar overlay */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                "absolute top-1.5 bottom-1.5 rounded-md border cursor-pointer transition-all hover:brightness-110",
                                STATUS_COLORS[p.status],
                                STATUS_BORDER[p.status],
                              )}
                              style={{
                                left: `${(barStartDay / totalDays) * 100}%`,
                                width: `${(barWidth / totalDays) * 100}%`,
                                minWidth: "8px",
                              }}
                              onClick={() => navigate(`/projects/${p.id}`)}
                            >
                              {barWidth >= 3 && (
                                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white truncate drop-shadow-sm">
                                  {p.name}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{p.name}</p>
                              <p className="text-muted-foreground">
                                {format(pStart, "dd/MM/yyyy")} – {p.end_date ? format(pEnd, "dd/MM/yyyy") : "No end date"}
                              </p>
                              <p className="text-muted-foreground capitalize">{p.status.replace("_", " ")}</p>
                              {p.budget && <p className="text-muted-foreground">Budget: AED {p.budget.toLocaleString()}</p>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Projects without dates */}
      {projectsWithoutDates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {projectsWithoutDates.length} project{projectsWithoutDates.length !== 1 ? "s" : ""} without dates (not shown):
          </p>
          <div className="flex flex-wrap gap-2">
            {projectsWithoutDates.map((p) => (
              <Badge
                key={p.id}
                variant="outline"
                className="cursor-pointer hover:border-brand/40 transition-colors"
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                {p.name}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
