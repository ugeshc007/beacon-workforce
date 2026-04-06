import { useState } from "react";
import { useEmployees, useBranches, useToggleEmployeeStatus } from "@/hooks/useEmployees";
import { useCanAccess } from "@/hooks/usePermissions";
import { EmployeeFormDialog } from "@/components/employees/EmployeeFormDialog";
import { EmployeeDetailDrawer } from "@/components/employees/EmployeeDetailDrawer";
import { MarkLeaveDialog } from "@/components/employees/MarkLeaveDialog";
import { CsvImportDialog } from "@/components/employees/CsvImportDialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Users, Plus, Search, MoreHorizontal, Pencil, Eye, ChevronLeft, ChevronRight, Upload, CalendarOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

const skillColors: Record<string, string> = {
  technician: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  helper: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  supervisor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function Employees() {
  const [search, setSearch] = useState("");
  const [skillType, setSkillType] = useState("all");
  const [branchId, setBranchId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const pageSize = 25;

  const [formOpen, setFormOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Tables<"employees"> | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveEmployee, setLeaveEmployee] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useEmployees({ search, skillType, branchId, status, page, pageSize });
  const { data: branches } = useBranches();
  const toggleStatus = useToggleEmployeeStatus();
  const { toast } = useToast();

  const employees = data?.data ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleEdit = (emp: Tables<"employees">) => {
    setEditEmployee(emp);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditEmployee(null);
    setFormOpen(true);
  };

  const handleView = (id: string) => {
    setDetailId(id);
    setDrawerOpen(true);
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await toggleStatus.mutateAsync({ id, is_active: !current });
      toast({ title: current ? "Employee deactivated" : "Employee activated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Employees</h2>
          <p className="text-sm text-muted-foreground">{totalCount} team members</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setCsvOpen(true)} size="sm" variant="outline">
            <Upload className="h-4 w-4 mr-1" /> CSV Import
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Employee
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, code, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={skillType} onValueChange={(v) => { setSkillType(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Skill Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
            <SelectItem value="helper">Helper</SelectItem>
            <SelectItem value="supervisor">Supervisor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={branchId} onValueChange={(v) => { setBranchId(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Branch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches?.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
          <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Employees Found"
          description={search || skillType !== "all" || branchId !== "all"
            ? "No employees match your current filters. Try adjusting your search."
            : "Add your team members to start assigning them to projects."}
          actionLabel="Add Employee"
          onAction={handleAdd}
        />
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Designation</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="hidden lg:table-cell">Branch</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Rate (AED)</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">OT (AED)</TableHead>
                  <TableHead className="text-right hidden xl:table-cell">Std Hrs</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => handleView(emp.id)}
                  >
                    <TableCell className="font-mono text-xs">{emp.employee_code}</TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{emp.name}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {emp.phone || "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {emp.designation || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${skillColors[emp.skill_type]}`}>
                        {emp.skill_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {(emp as any).branches?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                      {Number(emp.hourly_rate).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden sm:table-cell">
                      {Number(emp.overtime_rate).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm hidden xl:table-cell">
                      {Number(emp.standard_hours_per_day)}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={emp.is_active}
                        onCheckedChange={() => handleToggle(emp.id, emp.is_active)}
                        className="data-[state=checked]:bg-primary"
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(emp.id)}>
                            <Eye className="mr-2 h-4 w-4" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(emp)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setLeaveEmployee({ id: emp.id, name: emp.name }); setLeaveOpen(true); }}>
                            <CalendarOff className="mr-2 h-4 w-4" /> Mark on Leave
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalCount)} of {totalCount}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline" size="icon" className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={editEmployee}
      />

      <EmployeeDetailDrawer
        employeeId={detailId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <CsvImportDialog open={csvOpen} onOpenChange={setCsvOpen} />

      {leaveEmployee && (
        <MarkLeaveDialog
          open={leaveOpen}
          onOpenChange={setLeaveOpen}
          employeeId={leaveEmployee.id}
          employeeName={leaveEmployee.name}
        />
      )}
    </div>
  );
}
