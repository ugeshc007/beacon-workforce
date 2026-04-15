import { toLocalDateStr } from "@/lib/utils";
import { useState } from "react";
import {
  useDailyTeam,
  useMarkPresent,
  useBulkMarkPresent,
  useMarkAbsent,
  useAddExtraStaff,
  useRemoveFromTeam,
  type DailyTeamMember,
  type DailyProjectGroup,
} from "@/hooks/useDailyTeam";
import { useAvailableEmployees } from "@/hooks/useSchedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Users, UserCheck, UserMinus, UserPlus, MoreHorizontal,
  CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight, Search,
  MapPin, Share2, FileText, StickyNote,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const fmt = (ts: string | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const skillColor: Record<string, string> = {
  team_member: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  team_leader: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return toLocalDateStr(uae);
}

type AbsentDialog = {
  member: DailyTeamMember;
  mode: "absent" | "replace" | "remove";
} | null;

type AddStaffDialog = { project_id: string; project_name: string } | null;

export default function DailyTeam() {
  const today = todayUAE();
  const [date, setDate] = useState(today);
  const { data: groups, isLoading } = useDailyTeam(date);
  const markPresent = useMarkPresent();
  const bulkMark = useBulkMarkPresent();
  const markAbsent = useMarkAbsent();
  const addExtra = useAddExtraStaff();
  const removeFromTeam = useRemoveFromTeam();

  const [absentDialog, setAbsentDialog] = useState<AbsentDialog>(null);
  const [addDialog, setAddDialog] = useState<AddStaffDialog>(null);
  const [reason, setReason] = useState("");
  const [applyTo, setApplyTo] = useState("today_only");
  const [replaceId, setReplaceId] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const { data: availableEmps } = useAvailableEmployees(
    date,
    addDialog?.project_id ?? absentDialog?.member?.project_id ?? ""
  );

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(toLocalDateStr(d));
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const handleMarkPresent = async (m: DailyTeamMember) => {
    try {
      await markPresent.mutateAsync({ employee_id: m.employee_id, project_id: m.project_id, date });
      toast.success(`${m.employee_name} marked present`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleBulkPresent = async (group: DailyProjectGroup) => {
    const unpunched = group.members.filter((m) => !m.punch_in && !m.override_action);
    if (!unpunched.length) { toast.info("All members already punched in"); return; }
    try {
      await bulkMark.mutateAsync({
        date,
        members: unpunched.map((m) => ({ employee_id: m.employee_id, project_id: m.project_id })),
      });
      toast.success(`${unpunched.length} members marked present`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAbsentSubmit = async () => {
    if (!absentDialog) return;
    const { member, mode } = absentDialog;
    try {
      if (mode === "absent") {
        await markAbsent.mutateAsync({
          employee_id: member.employee_id, project_id: member.project_id, date,
          action: "absent", reason, apply_to: applyTo,
        });
        toast.success(`${member.employee_name} marked absent`);
      } else if (mode === "replace") {
        if (!replaceId) { toast.error("Select a replacement"); return; }
        await markAbsent.mutateAsync({
          employee_id: member.employee_id, project_id: member.project_id, date,
          action: "replaced", reason, replacement_employee_id: replaceId, apply_to: applyTo,
        });
        toast.success(`${member.employee_name} replaced`);
      } else if (mode === "remove") {
        await removeFromTeam.mutateAsync({
          assignment_id: member.assignment_id, employee_id: member.employee_id,
          project_id: member.project_id, date, apply_to: applyTo,
        });
        toast.success(`${member.employee_name} removed`);
      }
      setAbsentDialog(null);
      setReason("");
      setApplyTo("today_only");
      setReplaceId("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAddStaff = async (employeeId: string) => {
    if (!addDialog) return;
    try {
      await addExtra.mutateAsync({ employee_id: employeeId, project_id: addDialog.project_id, date });
      toast.success("Extra staff added");
      setAddDialog(null);
      setStaffSearch("");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const memberStatus = (m: DailyTeamMember) => {
    if (m.override_action === "absent") return "absent";
    if (m.override_action === "removed") return "removed";
    if (m.punch_in) return "present";
    return "planned";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "present": return <Badge className="bg-status-present/20 text-status-present border-status-present/30 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Present</Badge>;
      case "absent": return <Badge className="bg-status-absent/20 text-status-absent border-status-absent/30 text-[10px]"><XCircle className="h-3 w-3 mr-1" />Absent</Badge>;
      case "removed": return <Badge className="bg-muted text-muted-foreground text-[10px]"><UserMinus className="h-3 w-3 mr-1" />Removed</Badge>;
      default: return <Badge className="bg-status-planned/20 text-status-planned border-status-planned/30 text-[10px]"><Clock className="h-3 w-3 mr-1" />Planned</Badge>;
    }
  };

  const totalAssigned = groups?.reduce((s, g) => s + g.members.length, 0) ?? 0;
  const totalPresent = groups?.reduce((s, g) => s + g.members.filter((m) => m.punch_in).length, 0) ?? 0;

  const handleShare = async (group: DailyProjectGroup) => {
    const lines: string[] = [];
    lines.push(`📋 *${group.project_name}*`);
    lines.push(`📅 ${new Date(date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}`);
    if (group.site_address) lines.push(`📍 Location: ${group.site_address}`);

    // Fetch daily logs as "Task"
    try {
      const { data: logs } = await supabase
        .from("project_daily_logs")
        .select("description, completion_pct, issues, status")
        .eq("project_id", group.project_id)
        .eq("date", date)
        .order("created_at", { ascending: false });
      if (logs && logs.length > 0) {
        lines.push("");
        lines.push("📝 *Task:*");
        logs.forEach((l: any) => {
          const statusLabel = l.status === "completed" ? "✅" : l.status === "in_progress" ? "🔄" : l.status === "on_hold" ? "⏸️" : "⏳";
          lines.push(`  ${statusLabel} ${l.description}${l.completion_pct !== null ? ` (${l.completion_pct}%)` : ""}${l.issues ? ` ⚠️ ${l.issues}` : ""}`);
        });
      }
    } catch {}
    lines.push("");
    const activeMembers = group.members.filter((m) => m.override_action !== "absent" && m.override_action !== "removed");
    lines.push(`👥 *Team:*`);
    activeMembers.forEach((m, i) => {
        const shift = m.shift_start && m.shift_end ? `${m.shift_start.slice(0,5)}–${m.shift_end.slice(0,5)}` : "08:00–17:00";
        const role = m.skill_type === "team_leader" ? "TL" : m.skill_type === "driver" ? "Driver" : "Member";
        lines.push(`${i + 1}. ${m.employee_name} (${role}) ⏰ ${shift}`);
      });

    const text = lines.join("\n");

    if (navigator.share) {
      navigator.share({ title: `${group.project_name} - Daily Team`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => {
        toast.success("Team details copied to clipboard");
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Daily Team Execution</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1"><Users className="h-3 w-3" />{totalAssigned} assigned</Badge>
          <Badge variant="outline" className="text-xs gap-1 border-status-present/50 text-status-present"><UserCheck className="h-3 w-3" />{totalPresent} present</Badge>
          <div className="flex items-center gap-1 ml-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setDate(today)}>Today</Button>
            <DateInput value={date} onChange={setDate} className="w-[150px]" />
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Project groups */}
      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)}</div>
      ) : !groups?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No assignments for this date</p>
          <p className="text-xs mt-1">Go to <Link to="/schedule" className="text-primary underline">Schedule</Link> to assign teams</p>
        </div>
      ) : (
        groups.map((group) => {
          const presentCount = group.members.filter((m) => m.punch_in).length;
          const required = group.required_technicians + group.required_helpers + group.required_supervisors;
          return (
            <Card key={group.project_id} className="glass-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                     <CardTitle className="text-base">
                       <Link to={`/projects/${group.project_id}`} className="hover:text-primary transition-colors">
                         {group.project_name}
                       </Link>
                     </CardTitle>
                     {group.client_name && <p className="text-xs text-muted-foreground">{group.client_name}</p>}
                     {group.site_address && (
                       <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                         <MapPin className="h-3 w-3 shrink-0" />{group.site_address}
                       </p>
                     )}
                   </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {presentCount}/{group.members.length} present {required > 0 && `· ${required} req`}
                    </Badge>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleBulkPresent(group)}>
                      <UserCheck className="h-3 w-3 mr-1" />Bulk Present
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setAddDialog({ project_id: group.project_id, project_name: group.project_name })}>
                      <UserPlus className="h-3 w-3 mr-1" />Add Staff
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => handleShare(group)}>
                      <Share2 className="h-3 w-3 mr-1" />Share
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {group.notes && (
                  <div className="flex items-start gap-2 px-1 pb-3 text-xs text-muted-foreground">
                    <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{group.notes}</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 font-medium">Employee</th>
                        <th className="text-left py-2 font-medium">Role</th>
                        <th className="text-left py-2 font-medium">Status</th>
                        <th className="text-left py-2 font-medium">Punch In</th>
                        <th className="text-left py-2 font-medium">On Site</th>
                        <th className="text-left py-2 font-medium">Work</th>
                        <th className="text-left py-2 font-medium">Shift</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.members.map((m) => {
                        const status = memberStatus(m);
                        return (
                          <tr key={m.assignment_id} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors">
                            <td className="py-2.5">
                              <span className="font-medium text-foreground">{m.employee_name}</span>
                              {m.is_manual_override && <Badge variant="outline" className="ml-1.5 text-[9px] border-amber-500/50 text-amber-400">Manual</Badge>}
                              <div className="text-[10px] text-muted-foreground">{m.employee_code}</div>
                            </td>
                            <td className="py-2.5">
                              <Badge variant="outline" className={`text-[10px] ${skillColor[m.skill_type] ?? ""}`}>{m.skill_type}</Badge>
                            </td>
                            <td className="py-2.5">{statusBadge(status)}</td>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(m.punch_in)}</td>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(m.site_arrival)}</td>
                            <td className="py-2.5 font-mono text-xs text-muted-foreground">
                              {fmt(m.work_start)}{m.work_end && <span className="text-muted-foreground/50"> – {fmt(m.work_end)}</span>}
                            </td>
                            <td className="py-2.5 text-xs text-muted-foreground">
                              {m.shift_start && m.shift_end ? `${m.shift_start.slice(0,5)}–${m.shift_end.slice(0,5)}` : "—"}
                            </td>
                            <td className="py-2.5">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {!m.punch_in && status !== "absent" && (
                                    <DropdownMenuItem onClick={() => handleMarkPresent(m)}>
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-status-present" />Mark Present
                                    </DropdownMenuItem>
                                  )}
                                  {status !== "absent" && (
                                    <DropdownMenuItem onClick={() => { setAbsentDialog({ member: m, mode: "absent" }); setApplyTo("today_only"); }}>
                                      <XCircle className="h-3.5 w-3.5 mr-2 text-status-absent" />Mark Absent
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => { setAbsentDialog({ member: m, mode: "replace" }); setApplyTo("today_only"); }}>
                                    <UserPlus className="h-3.5 w-3.5 mr-2" />Replace
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setAbsentDialog({ member: m, mode: "remove" }); setApplyTo("today_only"); }} className="text-destructive">
                                    <UserMinus className="h-3.5 w-3.5 mr-2" />Remove
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Absent / Replace / Remove Dialog */}
      <Dialog open={!!absentDialog} onOpenChange={(v) => { if (!v) setAbsentDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {absentDialog?.mode === "absent" && "Mark Absent"}
              {absentDialog?.mode === "replace" && "Replace Employee"}
              {absentDialog?.mode === "remove" && "Remove Employee"}
            </DialogTitle>
            <DialogDescription>
              {absentDialog?.member.employee_name} — {absentDialog?.member.project_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Apply to</label>
              <Select value={applyTo} onValueChange={setApplyTo}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today_only">Today only</SelectItem>
                  <SelectItem value="remaining">Rest of schedule</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {absentDialog?.mode === "replace" && (
              <div>
                <label className="text-sm font-medium text-foreground">Replacement</label>
                <div className="mt-1 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search available…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} className="pl-9" />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                    {(availableEmps ?? [])
                      .filter((e) => e.available && (!staffSearch || e.name.toLowerCase().includes(staffSearch.toLowerCase())))
                      .map((e) => (
                        <button
                          key={e.id}
                          className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-accent/30 transition-colors ${replaceId === e.id ? "bg-primary/10" : ""}`}
                          onClick={() => setReplaceId(e.id)}
                        >
                          <span>{e.name}</span>
                          <Badge variant="outline" className={`text-[10px] ${skillColor[e.skill_type] ?? ""}`}>{e.skill_type}</Badge>
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-foreground">Reason (optional)</label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" rows={2} placeholder="e.g. sick leave, no-show…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAbsentDialog(null)}>Cancel</Button>
            <Button onClick={handleAbsentSubmit} disabled={markAbsent.isPending || removeFromTeam.isPending}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Extra Staff Dialog */}
      <Dialog open={!!addDialog} onOpenChange={(v) => { if (!v) { setAddDialog(null); setStaffSearch(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Extra Staff</DialogTitle>
            <DialogDescription>{addDialog?.project_name} — {dateLabel}</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search available employees…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-border">
            {(availableEmps ?? [])
              .filter((e) => e.available && (!staffSearch || e.name.toLowerCase().includes(staffSearch.toLowerCase())))
              .map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-2 hover:bg-accent/30 transition-colors">
                  <div>
                    <span className="text-sm font-medium">{e.name}</span>
                    <Badge variant="outline" className={`ml-2 text-[10px] ${skillColor[e.skill_type] ?? ""}`}>{e.skill_type}</Badge>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleAddStaff(e.id)} disabled={addExtra.isPending}>
                    <UserPlus className="h-3 w-3 mr-1" />Add
                  </Button>
                </div>
              ))}
            {(availableEmps ?? []).filter((e) => e.available).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No available employees</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
