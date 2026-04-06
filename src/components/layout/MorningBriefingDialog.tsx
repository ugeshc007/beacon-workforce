import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sunrise, Users, FolderKanban, AlertTriangle, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

function useMorningBriefing() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["morning-briefing"],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];

      const [assignRes, attendanceRes, projectRes, leaveRes] = await Promise.all([
        supabase
          .from("project_assignments")
          .select("id, employee_id, project_id, projects(name)")
          .eq("date", today),
        supabase
          .from("attendance_logs")
          .select("id, employee_id")
          .eq("date", today)
          .not("office_punch_in", "is", null),
        supabase
          .from("projects")
          .select("id, name, status")
          .eq("status", "in_progress"),
        supabase
          .from("employee_leave")
          .select("id, employee_id")
          .lte("start_date", today)
          .gte("end_date", today),
      ]);

      const assignedToday = assignRes.data?.length ?? 0;
      const uniqueEmployees = new Set((assignRes.data ?? []).map((a) => a.employee_id)).size;
      const punchedIn = new Set((attendanceRes.data ?? []).map((a) => a.employee_id)).size;
      const activeProjects = projectRes.data?.length ?? 0;
      const onLeave = leaveRes.data?.length ?? 0;
      const notYetPunched = uniqueEmployees - punchedIn;

      // Projects with assignments today
      const projectNames = [...new Set(
        (assignRes.data ?? [])
          .map((a) => (a.projects as any)?.name)
          .filter(Boolean)
      )];

      return {
        assignedToday,
        uniqueEmployees,
        punchedIn,
        notYetPunched: Math.max(0, notYetPunched),
        activeProjects,
        onLeave,
        projectNames,
      };
    },
  });
}

export function MorningBriefingDialog() {
  const { data, isLoading } = useMorningBriefing();
  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Sunrise className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sunrise className="h-5 w-5 text-brand" />
            Morning Briefing
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{today}</p>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading briefing…</div>
        ) : data ? (
          <div className="space-y-4">
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <BriefingStat icon={Users} label="Assigned Today" value={data.assignedToday} />
              <BriefingStat icon={CheckCircle} label="Punched In" value={data.punchedIn} color="text-status-present" />
              <BriefingStat icon={AlertTriangle} label="Not Yet In" value={data.notYetPunched} color={data.notYetPunched > 0 ? "text-status-absent" : "text-status-present"} />
              <BriefingStat icon={FolderKanban} label="Active Projects" value={data.activeProjects} />
            </div>

            {data.onLeave > 0 && (
              <div className="p-3 rounded-lg bg-status-absent/10 border border-status-absent/20">
                <p className="text-xs font-medium text-status-absent">{data.onLeave} employee{data.onLeave > 1 ? "s" : ""} on leave today</p>
              </div>
            )}

            {data.projectNames.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Today's active projects:</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.projectNames.slice(0, 8).map((name) => (
                    <span key={name} className="px-2 py-0.5 rounded-full bg-brand/10 text-brand text-xs">{name}</span>
                  ))}
                  {data.projectNames.length > 8 && (
                    <span className="text-xs text-muted-foreground">+{data.projectNames.length - 8} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function BriefingStat({ icon: Icon, label, value, color }: {
  icon: React.ElementType;
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-3.5 w-3.5 ${color ?? "text-brand"}`} />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
