import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useProjects, useTemplates } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useBranches } from "@/hooks/useEmployees";
import { useCanAccess } from "@/hooks/usePermissions";
import { ProjectFormDialog, type ProjectPrefill } from "@/components/projects/ProjectFormDialog";
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
  MoreHorizontal, Eye, Pencil, CalendarIcon, X, Copy, FileText, GanttChart, Upload,
} from "lucide-react";
import { CsvProjectImportDialog } from "@/components/projects/CsvProjectImportDialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { computeProjectHealth } from "@/lib/project-health";
import type { Tables } from "@/integrations/supabase/types";

const statusMap: Record<string, "planned" | "present" | "traveling" | "absent" | "overtime"> = {
  on_hold: "planned",
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
  const [importOpen, setImportOpen] = useState(false);
  const [editProject, setEditProject] = useState<Tables<"projects"> | null>(null);
  const [prefill, setPrefill] = useState<ProjectPrefill | null>(null);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { user } = useAuth();
  const { data: projects, isLoading } = useProjects({
    search, status, branchId,
    dateFrom: dateFrom ? format(dateFrom, "yyyy-MM-dd") : undefined,
    dateTo: dateTo ? format(dateTo, "yyyy-MM-dd") : undefined,
    userRole: user?.role,
    userId: user?.id,
  });
  const { data: branches } = useBranches();
  const { data: templates } = useTemplates();
  const { allowed: canCreate } = useCanAccess("projects", "can_create");
  const { allowed: canEdit } = useCanAccess("projects", "can_edit");

  const handleEdit = (p: Tables<"projects">) => { setEditProject(p); setPrefill(null); setFormOpen(true); };
  const handleAdd = () => { setEditProject(null); setPrefill(null); setFormOpen(true); };
  const handleDuplicate = (p: any) => {
    setEditProject(null);
    setPrefill({
      name: `${p.name} (Copy)`,
      branch_id: p.branch_id,
      client_name: p.client_name,
      client_phone: p.client_phone,
      client_email: p.client_email,
      site_address: p.site_address,
      site_latitude: p.site_latitude,
      site_longitude: p.site_longitude,
      site_gps_radius: p.site_gps_radius,
      budget: p.budget,
      project_value: p.project_value,
      notes: p.notes,
      required_technicians: p.required_technicians,
      required_helpers: p.required_helpers,
      required_supervisors: p.required_supervisors,
    });
    setFormOpen(true);
  };
  const handleFromTemplate = (tpl: Tables<"project_templates">) => {
    setEditProject(null);
    setPrefill({
      name: "",
      required_technicians: tpl.required_technicians,
      required_helpers: tpl.required_helpers,
      required_supervisors: tpl.required_supervisors,
    });
    setFormOpen(true);
  };

  const hasDateFilter = dateFrom || dateTo;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">{projects?.length ?? 0} projects</p>
        </div>
        <div className="flex gap-2">
          {canCreate && templates && templates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1"><FileText className="h-4 w-4" /> From Template</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {templates.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => handleFromTemplate(t)}>
                    {t.name}
                    <span className="ml-auto text-[10px] text-muted-foreground">{t.required_technicians}T/{t.required_helpers}H/{t.required_supervisors}S</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canCreate && (
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> Bulk Import
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate("/projects/gantt")}>
            <GanttChart className="h-4 w-4" /> Gantt
          </Button>
          {canCreate && (
            <Button onClick={handleAdd} size="sm"><Plus className="h-4 w-4 mr-1" /> New Project</Button>
          )}
        </div>
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
            <SelectItem value="on_hold">On Hold</SelectItem>
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

        {/* Date range filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs", hasDateFilter && "border-brand text-brand")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "dd/MM") : "From"}
              {" – "}
              {dateTo ? format(dateTo, "dd/MM") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 space-y-2" align="start">
            <p className="text-xs font-medium text-muted-foreground">Start date from</p>
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-0 pointer-events-auto" />
            <p className="text-xs font-medium text-muted-foreground pt-2">Start date to</p>
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-0 pointer-events-auto" />
          </PopoverContent>
        </Popover>
        {hasDateFilter && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}

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
        <EmptyState
          icon={FolderKanban}
          title="No Projects Found"
          description={canCreate ? "Create your first project to start managing installations." : "No projects are available for your account yet."}
          actionLabel={canCreate ? "Create Project" : undefined}
          onAction={canCreate ? handleAdd : undefined}
        />
      ) : view === "card" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const totalStaff = p.required_technicians + p.required_helpers + p.required_supervisors;
            const budgetUsed = p.budget ? Math.min(((p.actual_cost ?? 0) / p.budget) * 100, 100) : 0;
            const overBudget = p.budget ? (p.actual_cost ?? 0) > p.budget : false;
            return (
              <Card key={p.id} className="glass-card cursor-pointer hover:border-brand/40 transition-colors group" onClick={() => navigate(`/projects/${p.id}`)}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{p.name}</p>
                      {p.job_card && <p className="text-[10px] text-brand font-mono">JC: {p.job_card}</p>}
                      <p className="text-xs text-muted-foreground">{p.client_name ?? "No client"}</p>
                    </div>
                    <StatusBadge status={statusMap[p.status] ?? "planned"} />
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    {p.site_address && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /><span className="truncate">{p.site_address}</span></div>}
                    <div className="flex items-center gap-1.5"><Users className="h-3 w-3" />{totalStaff} staff required ({p.required_technicians}T / {p.required_helpers}H / {p.required_supervisors}S)</div>
                    {p.start_date && (
                      <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(p.start_date), "dd/MM/yyyy")}
                        {p.end_date && ` – ${format(new Date(p.end_date), "dd/MM/yyyy")}`}
                      </div>
                    )}
                  </div>
                  {/* Budget vs Actual */}
                  {p.budget ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted-foreground">Budget</span>
                        <span className={cn("font-mono", overBudget ? "text-destructive" : "text-muted-foreground")}>
                          AED {(p.actual_cost ?? 0).toLocaleString()} / {p.budget.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={budgetUsed} className={cn("h-1.5", overBudget && "[&>div]:bg-destructive")} />
                    </div>
                  ) : (
                    <div className="text-[10px] text-muted-foreground">No budget set</div>
                  )}
                  {(() => {
                    const health = computeProjectHealth(p);
                    const healthColor = health >= 80 ? "bg-status-present" : health >= 50 ? "bg-status-traveling" : "bg-destructive";
                    const healthText = health >= 80 ? "text-status-present" : health >= 50 ? "text-status-traveling" : "text-destructive";
                    return (
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2" title="Based on budget usage and schedule">
                          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all", healthColor)} style={{ width: `${health}%` }} />
                          </div>
                          <span className={cn("text-[10px] font-mono", healthText)}>{health}%</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{p.branches?.name}</span>
                      </div>
                    );
                  })()}
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
                  <th className="text-left py-2 font-medium">Budget vs Actual</th>
                  <th className="text-left py-2 font-medium">Health</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const budgetUsed = p.budget ? Math.min(((p.actual_cost ?? 0) / p.budget) * 100, 100) : 0;
                  const overBudget = p.budget ? (p.actual_cost ?? 0) > p.budget : false;
                  return (
                    <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors cursor-pointer" onClick={() => navigate(`/projects/${p.id}`)}>
                      <td className="py-2.5 font-medium text-foreground">{p.name}</td>
                      <td className="py-2.5 text-muted-foreground">{p.client_name ?? "—"}</td>
                      <td className="py-2.5"><StatusBadge status={statusMap[p.status] ?? "planned"} /></td>
                      <td className="py-2.5 text-muted-foreground">{p.branches?.name}</td>
                      <td className="py-2.5 text-muted-foreground">{p.required_technicians + p.required_helpers + p.required_supervisors}</td>
                      <td className="py-2.5">
                        {p.budget ? (
                          <div className="flex items-center gap-2">
                            <Progress value={budgetUsed} className={cn("h-1.5 w-16", overBudget && "[&>div]:bg-destructive")} />
                            <span className={cn("text-xs font-mono", overBudget ? "text-destructive" : "text-muted-foreground")}>
                              {Math.round(budgetUsed)}%
                            </span>
                          </div>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className={cn("py-2.5 font-mono text-xs", (() => { const h = computeProjectHealth(p); return h >= 80 ? "text-status-present" : h >= 50 ? "text-status-traveling" : "text-destructive"; })())}>{computeProjectHealth(p)}%</td>
                      <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/projects/${p.id}`)}><Eye className="h-3.5 w-3.5 mr-2" />View</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(p as Tables<"projects">)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleDuplicate(p)}><Copy className="h-3.5 w-3.5 mr-2" />Duplicate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <ProjectFormDialog open={formOpen} onOpenChange={setFormOpen} editProject={editProject} prefill={prefill} />
      <CsvProjectImportDialog open={importOpen} onOpenChange={setImportOpen} branches={(branches ?? []).map(b => ({ id: b.id, name: b.name }))} />
    </div>
  );
}
