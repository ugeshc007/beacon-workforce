import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, MapPin, Phone, Calendar, User, MoreHorizontal, Trash2, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { useSiteVisits, useDeleteSiteVisit, type SiteVisit } from "@/hooks/useSiteVisits";
import { SiteVisitFormDialog } from "@/components/site-visits/SiteVisitFormDialog";
import { useToast } from "@/hooks/use-toast";
import { useCanAccess } from "@/hooks/usePermissions";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  converted: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

const priorityColors: Record<string, string> = {
  low: "bg-muted/40 text-muted-foreground",
  normal: "bg-sky-500/10 text-sky-400",
  high: "bg-orange-500/15 text-orange-400",
  urgent: "bg-red-500/15 text-red-400",
};

export default function SiteVisits() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SiteVisit | null>(null);
  const { data, isLoading } = useSiteVisits({ search, status, pageSize: 50 });
  const del = useDeleteSiteVisit();
  const { toast } = useToast();
  const { allowed: canCreate } = useCanAccess("site_visits", "can_create");
  const { allowed: canDelete } = useCanAccess("site_visits", "can_delete");

  const visits = data?.data ?? [];

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this site visit? This cannot be undone.")) return;
    try {
      await del.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Site Visits</h1>
          <p className="text-sm text-muted-foreground mt-1">Lead intake & site survey reports</p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Site Visit
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search client, address, type..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="converted">Converted to Project</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : visits.length === 0 ? (
        <EmptyState icon={MapPin} title="No site visits yet" description="Create one when a new lead comes in." />
      ) : (
        <div className="grid gap-3">
          {visits.map((v) => (
            <Card key={v.id} className="p-4 hover:border-brand/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <Link to={`/site-visits/${v.id}`} className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <h3 className="font-semibold text-foreground truncate">{v.client_name}</h3>
                    <Badge variant="outline" className={statusColors[v.status]}>{v.status.replace("_", " ")}</Badge>
                    <Badge variant="outline" className={priorityColors[v.priority]}>{v.priority}</Badge>
                    {v.project_type && <span className="text-xs text-muted-foreground">• {v.project_type}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    {v.site_address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{v.site_address}</span>}
                    {v.client_contact && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{v.client_contact}</span>}
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{v.visit_date}</span>
                    {v.assigned_employee && (
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{v.assigned_employee.name}</span>
                    )}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to={`/site-visits/${v.id}`}><Eye className="h-4 w-4 mr-2" />View</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setEditing(v); setDialogOpen(true); }}>
                      <Pencil className="h-4 w-4 mr-2" />Edit
                    </DropdownMenuItem>
                    {canDelete && (
                      <DropdownMenuItem onClick={() => handleDelete(v.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SiteVisitFormDialog open={dialogOpen} onOpenChange={setDialogOpen} edit={editing} />
    </div>
  );
}
