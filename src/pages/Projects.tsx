import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useProjects } from "@/hooks/useProjects";
import { useBranches } from "@/hooks/useEmployees";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban, Plus, Search, LayoutGrid, List, MapPin, Users, DollarSign,
  MoreHorizontal, Eye, Pencil, CalendarIcon, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const statusMap: Record<string, "planned" | "present" | "traveling" | "absent" | "overtime"> = {
  planned: "planned",
  assigned: "planned",
  in_progress: "present",
  completed: "overtime",
};

export default function Projects() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [view, setView] = useState<"card" | "table">("card");
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState<Tables<"projects"> | null>(null);

  const { data: projects, isLoading } = useProjects({ search, status, branchId });
  const { data: branches } = useBranches();

  const handleEdit = (p: Tables<"projects">) => { setEditProject(p); setFormOpen(true); };
  const handleAdd = () => { setEditProject(null); setFormOpen(true); };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects?.length ?? 0} projects</p>
        </div>
        <Button onClick={handleAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-muted rounded-lg p-0.5">
          <Button variant={view === "card" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("card")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={view === "table" ? "default" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("table")}><List className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !projects?.length ? (
        <EmptyState icon={FolderKanban} title="No Projects Found" description="Create your first project to start managing installations." actionLabel="Create Project" onAction={handleAdd} />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const totalStaff = p.required_technicians + p.required_helpers + p.required_supervisors;
            return (
              <Card key={p.id} className="glass-card cursor-pointer hover:border-brand/40 transition-colors group" onClick={() => navigate(`/projects/${p.id}`)}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.client_name ?? "No client"}</p>
                    </div>
                    <StatusBadge status={statusMap[p.status] ?? "planned"} />
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {p.site_address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate">{p.site_address}</span></div>}
                    <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{totalStaff} staff required ({p.required_technicians}T / {p.required_helpers}H / {p.required_supervisors}S)</div>
                    {p.budget && <div className="flex items-center gap-1.5"><DollarSign className="h-3 w-3" />Budget: AED {p.budget.toLocaleString()}</div>}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${p.health_score ?? 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{p.health_score ?? 100}%</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{p.branches?.name}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 font-medium">Project</th>
                  <th className="text-left py-2 font-medium">Client</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left py-2 font-medium">Branch</th>
                  <th className="text-left py-2 font-medium">Staff</th>
                  <th className="text-left py-2 font-medium">Health</th>
                  <th className="text-right py-2 font-medium">Budget</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className="py-2.5 font-medium text-foreground">{p.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.client_name ?? "—"}</td>
                    <td className="py-2.5"><StatusBadge status={statusMap[p.status] ?? "planned"} /></td>
                    <td className="py-2.5 text-muted-foreground">{p.branches?.name}</td>
                    <td className="py-2.5 text-muted-foreground">{p.required_technicians + p.required_helpers + p.required_supervisors}</td>
                    <td className="py-2.5 font-mono text-xs">{p.health_score ?? 100}%</td>
                    <td className="py-2.5 text-right font-mono text-muted-foreground">{p.budget ? `AED ${p.budget.toLocaleString()}` : "—"}</td>
                    <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/projects/${p.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(p as Tables<"projects">)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} editProject={editProject} />
    </div>
  );
}
