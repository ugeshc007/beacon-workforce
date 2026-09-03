import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Radio,
  Rocket,
  Users,
  Car,
  MapPin,
  Building2,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toLocalDateStr } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useAvailableEmployees } from "@/hooks/useAvailableEmployees";
import {
  useWeekAssignments,
  useAddAssignment,
  useRemoveAssignment,
} from "@/hooks/useSchedule";

const ROLE_OPTIONS = [
  { value: "team_leader", label: "Team Leader" },
  { value: "technician", label: "Technician" },
  { value: "helper", label: "Helper" },
  { value: "team_member", label: "Team Member" },
  { value: "driver", label: "Driver" },
];

const addDays = (dateStr: string, days: number) => {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
};

const dayLabel = (dateStr: string) =>
  new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export default function DeployConsole() {
  const today = toLocalDateStr(new Date());
  const [date, setDate] = useState(today);
  const [rangeOffset, setRangeOffset] = useState(0);
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [projectId, setProjectId] = useState<string>("");
  const [workLocation, setWorkLocation] = useState<"site" | "in_house">("site");
  const [role, setRole] = useState("team_member");
  const [task, setTask] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [autoStandby, setAutoStandby] = useState(true);

  const { data: projects } = useProjects({ status: "in_progress" });
  const { data: availability, isLoading: personnelLoading } = useAvailableEmployees(date);
  const personnel = availability?.employees ?? [];
  const addAssignment = useAddAssignment();
  const removeAssignment = useRemoveAssignment();

  const rollStart = addDays(today, rangeOffset);
  const rollEnd = addDays(rollStart, 6);
  const { data: rolling } = useWeekAssignments(rollStart, rollEnd);

  const dayRoster = useMemo(
    () => (rolling ?? []).filter((a) => a.date === date),
    [rolling, date]
  );

  const pulse = useMemo(() => {
    const list = personnel;
    return {
      total: list.length,
      available: list.filter((e) => e.status === "available").length,
      partial: list.filter((e) => e.status === "partial").length,
      booked: list.filter((e) => e.status === "booked").length,
      onLeave: list.filter((e) => e.status === "on_leave").length,
      driversFree: list.filter(
        (e) => e.skill_type === "driver" && e.status !== "booked" && e.status !== "on_leave"
      ).length,
    };
  }, [personnel]);

  const crossesMidnight = minutesOf(shiftEnd) <= minutesOf(shiftStart);

  const selectedProject = (projects ?? []).find((p) => p.id === projectId);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleDeploy = async () => {
    if (!projectId) {
      toast.error("Select a project first");
      return;
    }
    if (selected.length === 0) {
      toast.error("Select at least one crew member");
      return;
    }

    let deployed = 0;
    let standbyName: string | null = null;
    for (const employeeId of selected) {
      try {
        await addAssignment.mutateAsync({
          project_id: projectId,
          employee_id: employeeId,
          date,
          shift_start: shiftStart,
          shift_end: shiftEnd,
          assigned_role: role,
          work_location: workLocation,
          task: task.trim() || null,
        });
        deployed += 1;
      } catch (e: any) {
        toast.error(e?.message ?? "Failed to deploy crew member");
      }
    }

    // Driver auto-standby: a site deployment with no driver on the day gets an
    // available driver placed on standby so transport is never missing.
    if (autoStandby && deployed > 0 && workLocation === "site") {
      const alreadyDriver =
        role === "driver" ||
        dayRoster.some((a) => a.project_id === projectId && a.employee_skill === "driver");
      if (!alreadyDriver) {
        const candidate = personnel.find(
          (e) =>
            e.skill_type === "driver" &&
            e.status !== "booked" &&
            e.status !== "on_leave" &&
            !selected.includes(e.id)
        );
        if (candidate) {
          try {
            await addAssignment.mutateAsync({
              project_id: projectId,
              employee_id: candidate.id,
              date,
              shift_start: shiftStart,
              shift_end: shiftEnd,
              assigned_role: "driver",
              work_location: workLocation,
              task: "Standby (auto)",
            });
            standbyName = candidate.name;
          } catch {
            /* standby is best-effort */
          }
        }
      }
    }

    if (deployed > 0) {
      toast.success(
        `Deployed ${deployed} crew to ${selectedProject?.name ?? "project"}${
          standbyName ? ` · driver ${standbyName} on standby` : ""
        }`
      );
      setSelected([]);
      setTask("");
    }
  };

  const handleEndDay = async () => {
    const removable = dayRoster.filter((a) => !a.is_locked);
    if (removable.length === 0) {
      toast.info("Nothing to stand down for this day");
      return;
    }
    let removed = 0;
    for (const a of removable) {
      try {
        await removeAssignment.mutateAsync(a.id);
        removed += 1;
      } catch {
        /* keep going */
      }
    }
    toast.success(`Stood down ${removed} assignment${removed === 1 ? "" : "s"}`);
  };

  const rollingDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(rollStart, i)),
    [rollStart]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground">Deploy Console</h1>
            <p className="text-sm text-muted-foreground">
              Mission control for daily crew deployment
            </p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
          <Activity className="h-3.5 w-3.5" />
          {dayLabel(date)}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Deployment form */}
        <Card className="space-y-4 border-border/60 bg-card/80 p-4 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">{dayLabel(date)}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                {crossesMidnight ? `${dayLabel(addDays(date, 1))} · +1 day` : dayLabel(date)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {(projects ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Work location</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={workLocation === "site" ? "default" : "outline"}
                  className="flex-1 text-xs"
                  onClick={() => setWorkLocation("site")}
                >
                  <MapPin className="mr-1 h-3.5 w-3.5" />Site
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={workLocation === "in_house" ? "default" : "outline"}
                  className="flex-1 text-xs"
                  onClick={() => setWorkLocation("in_house")}
                >
                  <Building2 className="mr-1 h-3.5 w-3.5" />In-House
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Task / scope</Label>
            <Input
              placeholder="e.g. Structure and screen installation"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </div>

          {/* Personnel picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Personnel ({selected.length} selected)</Label>
              <button
                type="button"
                onClick={() => setAutoStandby((v) => !v)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  autoStandby
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Car className="mr-1 inline h-3 w-3" />
                Driver auto-standby {autoStandby ? "on" : "off"}
              </button>
            </div>
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto rounded-lg border border-border/60 p-2">
              {personnelLoading && (
                <p className="p-2 text-xs text-muted-foreground">Loading personnel…</p>
              )}
              {!personnelLoading && personnel.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">No active employees.</p>
              )}
              {personnel.map((e) => {
                const isSelected = selected.includes(e.id);
                const disabled = e.status === "on_leave";
                return (
                  <button
                    key={e.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(e.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isSelected
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    {e.name}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {e.custom_skill_name ?? e.skill_type}
                      {e.status === "booked" ? " · booked" : e.status === "partial" ? " · partial" : ""}
                      {e.status === "on_leave" ? " · leave" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleDeploy} disabled={addAssignment.isPending} className="gap-1.5">
              <Rocket className="h-4 w-4" />
              Deploy crew
            </Button>
            <Button variant="outline" onClick={handleEndDay} disabled={removeAssignment.isPending}>
              End day (stand down)
            </Button>
          </div>
        </Card>

        {/* Pulse + roster */}
        <div className="space-y-4">
          <Card className="space-y-3 border-border/60 bg-card/80 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Personnel pulse</h2>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "Available", value: pulse.available, cls: "text-status-present" },
                { label: "Partial", value: pulse.partial, cls: "text-status-traveling" },
                { label: "Booked", value: pulse.booked, cls: "text-primary" },
                { label: "On leave", value: pulse.onLeave, cls: "text-status-absent" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border/60 p-2">
                  <p className={`text-lg font-bold ${s.cls}`}>{s.value}</p>
                  <p className="text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border/60 p-2 text-xs">
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                Drivers free today
                <span className="ml-auto font-bold text-foreground">{pulse.driversFree}</span>
              </p>
            </div>
          </Card>

          <Card className="space-y-3 border-border/60 bg-card/80 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Live roster · {dayLabel(date)}</h2>
              <Badge variant="secondary" className="ml-auto text-[10px]">{dayRoster.length}</Badge>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {dayRoster.length === 0 && (
                <p className="text-xs text-muted-foreground">No crew deployed for this day yet.</p>
              )}
              {dayRoster.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 p-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{a.employee_name}</p>
                    <p className="truncate text-muted-foreground">
                      {a.project_name} · {a.work_location === "in_house" ? "In-House" : "Site"}
                      {a.task ? ` · ${a.task}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {(a.shift_start ?? "").slice(0, 5)}–{(a.shift_end ?? "").slice(0, 5)}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    disabled={a.is_locked}
                    onClick={() => removeAssignment.mutate(a.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-status-absent" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Rolling schedule */}
      <Card className="border-border/60 bg-card/80">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 p-3">
          <h2 className="text-sm font-semibold">Rolling schedule</h2>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRangeOffset((o) => o - 7)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setRangeOffset(0)}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setRangeOffset((o) => o + 7)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Day</TableHead>
                <TableHead className="text-xs">Crew</TableHead>
                <TableHead className="text-xs">Projects</TableHead>
                <TableHead className="text-xs">Site / In-House</TableHead>
                <TableHead className="text-xs">Drivers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollingDays.map((d) => {
                const rows = (rolling ?? []).filter((a) => a.date === d);
                const projectNames = Array.from(new Set(rows.map((r) => r.project_name)));
                const siteCount = rows.filter((r) => r.work_location === "site").length;
                const inHouseCount = rows.filter((r) => r.work_location === "in_house").length;
                const drivers = rows.filter((r) => r.employee_skill === "driver").length;
                return (
                  <TableRow
                    key={d}
                    className={`cursor-pointer ${d === date ? "bg-primary/5" : ""}`}
                    onClick={() => setDate(d)}
                  >
                    <TableCell className="text-xs font-medium">{dayLabel(d)}</TableCell>
                    <TableCell className="text-xs">{rows.length}</TableCell>
                    <TableCell className="max-w-[320px] truncate text-xs text-muted-foreground">
                      {projectNames.join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {siteCount} / {inHouseCount}
                    </TableCell>
                    <TableCell className="text-xs">{drivers}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
