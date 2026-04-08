import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useMaintenanceCall, useMaintenanceAssignments,
  useUpdateMaintenanceCall, useRemoveFromMaintenance,
} from "@/hooks/useMaintenance";
import { MaintenanceFormDialog } from "@/components/maintenance/MaintenanceFormDialog";
import { MaintenanceAssignDialog } from "@/components/maintenance/MaintenanceAssignDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Pencil, UserPlus, Trash2, MapPin, Phone,
  Calendar, ShieldCheck, Clock, Wrench,
} from "lucide-react";

const priorityLabel: Record<string, string> = {
  emergency: "🔴 Emergency",
  high: "🟠 High",
  normal: "🟡 Normal",
  low: "🟢 Low",
};

const statusOptions = ["open", "scheduled", "in_progress", "completed", "closed"] as const;

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: call, isLoading } = useMaintenanceCall(id ?? null);
  const { data: assignments } = useMaintenanceAssignments(id ?? null);
  const updateMutation = useUpdateMaintenanceCall();
  const removeMutation = useRemoveFromMaintenance();
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, status: status as any });
      toast({ title: `Status updated to ${status.replace("_", " ")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveAssignment = async (assignId: string) => {
    try {
      await removeMutation.mutateAsync(assignId);
      toast({ title: "Staff removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Maintenance call not found</p>
        <Button variant="link" onClick={() => navigate("/maintenance")}>Back to list</Button>
      </div>
    );
  }

  const existingIds = (assignments ?? []).map((a) => a.employee_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/maintenance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5 text-brand" />
              {call.company_name}
            </h1>
            <p className="text-xs text-muted-foreground">{priorityLabel[call.priority]} priority</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={call.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Details Card */}
        <Card className="glass-card md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {call.contact_number && (
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{call.contact_number}</div>
            )}
            {call.location && (
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{call.location}</div>
            )}
            {call.scheduled_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {new Date(call.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Permit: {call.permit_required ? <Badge variant="outline" className="text-[10px] bg-status-overtime/15 text-status-overtime border-status-overtime/30">Required</Badge> : <span className="text-muted-foreground">Not required</span>}
            </div>
            {call.scope && (
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Scope</p>
                <p className="text-sm whitespace-pre-wrap">{call.scope}</p>
              </div>
            )}
            {call.notes && (
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{call.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Staff */}
        <Card className="glass-card md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Assigned Staff ({assignments?.length ?? 0})</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-3 w-3" /> Assign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!assignments?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No staff assigned yet</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-medium text-brand shrink-0">
                        {a.employees?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.employees?.name ?? "Unknown"}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {a.employees?.skill_type === "team_member" ? "Member" : a.employees?.skill_type === "team_leader" ? "TL" : a.employees?.skill_type}
                          </Badge>
                          <span className="font-mono">{a.employees?.employee_code}</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {a.shift_start?.slice(0, 5)} – {a.shift_end?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <MaintenanceFormDialog open={editOpen} onOpenChange={setEditOpen} editCall={call} />
      <MaintenanceAssignDialog open={assignOpen} onOpenChange={setAssignOpen} maintenanceCallId={call.id} existingEmployeeIds={existingIds} />
    </div>
  );
}
