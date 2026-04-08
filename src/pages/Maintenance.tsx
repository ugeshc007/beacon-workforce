import { useState } from "react";
import { useMaintenanceCalls, useDeleteMaintenanceCall, MaintenanceCall } from "@/hooks/useMaintenance";
import { MaintenanceFormDialog } from "@/components/maintenance/MaintenanceFormDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Wrench, MapPin, Phone, Calendar,
  AlertTriangle, ShieldCheck, MoreVertical, Trash2, Pencil,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const priorityBadge: Record<string, { label: string; className: string }> = {
  emergency: { label: "Emergency", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  high: { label: "High", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  normal: { label: "Normal", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  low: { label: "Low", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
};

const statusBadge: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  scheduled: { label: "Scheduled", className: "bg-brand/15 text-brand border-brand/30" },
  in_progress: { label: "In Progress", className: "bg-status-traveling/15 text-status-traveling border-status-traveling/30" },
  completed: { label: "Completed", className: "bg-status-present/15 text-status-present border-status-present/30" },
  closed: { label: "Closed", className: "bg-muted text-muted-foreground border-border" },
};

export default function Maintenance() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editCall, setEditCall] = useState<MaintenanceCall | null>(null);
  const { data: calls, isLoading } = useMaintenanceCalls({ search, status: statusFilter, priority: priorityFilter });
  const deleteMutation = useDeleteMaintenanceCall();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Maintenance call deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-brand" /> Maintenance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage maintenance calls and schedule staff</p>
        </div>
        <Button onClick={() => { setEditCall(null); setFormOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> New Call
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search company, location, scope..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="emergency">Emergency</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : !calls?.length ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-foreground">No maintenance calls</h3>
            <p className="text-sm text-muted-foreground mt-1">Create your first maintenance call to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {calls.map((call) => {
            const pri = priorityBadge[call.priority] ?? priorityBadge.normal;
            const sta = statusBadge[call.status] ?? statusBadge.open;
            return (
              <Card
                key={call.id}
                className="glass-card hover:border-brand/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/maintenance/${call.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground truncate">{call.company_name}</h3>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${pri.className}`}>{pri.label}</Badge>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${sta.className}`}>{sta.label}</Badge>
                        {call.permit_required && (
                          <Badge variant="outline" className="text-[10px] shrink-0 bg-status-overtime/15 text-status-overtime border-status-overtime/30">
                            <ShieldCheck className="h-3 w-3 mr-0.5" /> Permit
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {call.location && (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{call.location}</span>
                        )}
                        {call.contact_number && (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{call.contact_number}</span>
                        )}
                        {call.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(call.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                      {call.scope && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{call.scope}</p>}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => { setEditCall(call); setFormOpen(true); }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(call.id)}>
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MaintenanceFormDialog open={formOpen} onOpenChange={setFormOpen} editCall={editCall} />
    </div>
  );
}
