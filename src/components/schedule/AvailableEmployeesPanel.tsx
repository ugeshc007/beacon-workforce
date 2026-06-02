import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserCheck, UserMinus, UserX, Plane, Users } from "lucide-react";
import { useAvailableEmployees, type AvailableEmployee, type AvailabilityStatus } from "@/hooks/useAvailableEmployees";
import { useProjects, useAssignEmployee } from "@/hooks/useProjects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  date: string;
  canAssign?: boolean;
}

const statusMeta: Record<AvailabilityStatus, { label: string; color: string; icon: typeof UserCheck }> = {
  available: { label: "Available", color: "text-status-present border-status-present/40 bg-status-present/10", icon: UserCheck },
  partial: { label: "Partial", color: "text-status-planned border-status-planned/40 bg-status-planned/10", icon: UserMinus },
  booked: { label: "Booked", color: "text-status-overtime border-status-overtime/40 bg-status-overtime/10", icon: Users },
  on_leave: { label: "On Leave", color: "text-muted-foreground border-border bg-muted/40", icon: Plane },
};

export function AvailableEmployeesPanel({ date, canAssign = true }: Props) {
  const { data, isLoading } = useAvailableEmployees(date);
  const { data: projects } = useProjects({ status: "all" });
  const assignMutation = useAssignEmployee();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<AvailabilityStatus | "all">("available");
  const [pickProject, setPickProject] = useState<Record<string, string>>({});
  const [pickLocation, setPickLocation] = useState<Record<string, "site" | "in_house">>({});

  const activeProjects = useMemo(
    () => (projects ?? []).filter((p) => ["on_hold", "in_progress"].includes(p.status)),
    [projects]
  );

  const filtered = useMemo(() => {
    const list = data?.employees ?? [];
    return list.filter((e) => {
      if (tab !== "all" && e.status !== tab) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        e.name.toLowerCase().includes(s) ||
        e.employee_code.toLowerCase().includes(s) ||
        (e.designation ?? "").toLowerCase().includes(s) ||
        (e.custom_skill_name ?? "").toLowerCase().includes(s)
      );
    });
  }, [data, tab, search]);

  const handleAssign = async (emp: AvailableEmployee) => {
    const pid = pickProject[emp.id];
    if (!pid) {
      toast.error("Pick a project first");
      return;
    }
    const loc = pickLocation[emp.id];
    if (!loc) {
      toast.error("Pick Site or In-House first");
      return;
    }
    try {
      await assignMutation.mutateAsync({
        projectId: pid,
        employeeId: emp.id,
        date,
        shiftStart: "08:00",
        shiftEnd: "17:00",
        workLocation: loc,
      });
      toast.success(`${emp.name} assigned`);
      setPickProject((p) => ({ ...p, [emp.id]: "" }));
      setPickLocation((p) => { const n = { ...p }; delete n[emp.id]; return n; });
    } catch (e: any) {
      toast.error(e.message ?? "Assignment failed");
    }
  };

  const counts = data?.counts;

  return (
    <Card className="glass-card border-brand/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-brand" />
          Employee Availability
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["available", "partial", "booked", "on_leave"] as AvailabilityStatus[]).map((s) => {
            const m = statusMeta[s];
            const c = counts ? counts[s] : 0;
            return (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={`rounded-lg border p-2 text-center transition-all ${m.color} ${tab === s ? "ring-2 ring-brand/40" : ""}`}
              >
                <p className="text-lg font-bold leading-none">{c}</p>
                <p className="text-[10px] mt-1 opacity-90">{m.label}</p>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, skill..."
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="available" className="text-[11px]">Free</TabsTrigger>
              <TabsTrigger value="partial" className="text-[11px]">Partial</TabsTrigger>
              <TabsTrigger value="booked" className="text-[11px]">Booked</TabsTrigger>
              <TabsTrigger value="on_leave" className="text-[11px]">Leave</TabsTrigger>
              <TabsTrigger value="all" className="text-[11px]">All</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="h-[420px] pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserX className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No employees match</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {filtered.map((emp) => {
                const meta = statusMeta[emp.status];
                const Icon = meta.icon;
                const greyed = emp.status === "on_leave";
                return (
                  <div
                    key={emp.id}
                    className={`rounded-lg border border-border/50 p-3 space-y-2 ${greyed ? "opacity-60" : ""} bg-card`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground">{emp.name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className="text-[10px] font-mono text-muted-foreground">{emp.employee_code}</span>
                          {emp.custom_skill_name && (
                            <Badge variant="outline" className="text-[9px] h-4 px-1">{emp.custom_skill_name}</Badge>
                          )}
                          {emp.designation && (
                            <span className="text-[10px] text-muted-foreground truncate">{emp.designation}</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] gap-1 shrink-0 ${meta.color}`}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>

                    {emp.assignments.length > 0 && (
                      <div className="space-y-0.5">
                        {emp.assignments.map((a) => (
                          <div key={a.project_id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                            <span className="truncate">{a.project_name}</span>
                            {a.shift_start && a.shift_end && (
                              <span className="font-mono text-[10px] ml-auto shrink-0">
                                {a.shift_start.slice(0, 5)}–{a.shift_end.slice(0, 5)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {emp.leaveReason && (
                      <p className="text-[11px] text-muted-foreground italic">Reason: {emp.leaveReason}</p>
                    )}

                    {canAssign && emp.status !== "on_leave" && (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-2">
                          <Select
                            value={pickProject[emp.id] ?? ""}
                            onValueChange={(v) => setPickProject((p) => ({ ...p, [emp.id]: v }))}
                          >
                            <SelectTrigger className="h-7 text-[11px] flex-1">
                              <SelectValue placeholder="Assign to project..." />
                            </SelectTrigger>
                            <SelectContent>
                              {activeProjects
                                .filter((p) => !emp.assignments.some((a) => a.project_id === p.id))
                                .map((p) => (
                                  <SelectItem key={p.id} value={p.id} className="text-xs">
                                    {p.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] px-2"
                            disabled={!pickProject[emp.id] || !pickLocation[emp.id] || assignMutation.isPending}
                            onClick={() => handleAssign(emp)}
                          >
                            Assign
                          </Button>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={pickLocation[emp.id] === "site" ? "default" : "outline"}
                            className="h-6 px-2 text-[10px] flex-1"
                            onClick={() => setPickLocation((p) => ({ ...p, [emp.id]: "site" }))}
                          >
                            Site
                          </Button>
                          <Button
                            size="sm"
                            variant={pickLocation[emp.id] === "in_house" ? "default" : "outline"}
                            className="h-6 px-2 text-[10px] flex-1"
                            onClick={() => setPickLocation((p) => ({ ...p, [emp.id]: "in_house" }))}
                          >
                            In-House
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
