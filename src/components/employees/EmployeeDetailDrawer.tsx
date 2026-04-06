import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployee, useEmployeeStats } from "@/hooks/useEmployees";
import { User, Phone, Mail, MapPin, Clock, Briefcase, TrendingUp, DollarSign } from "lucide-react";

interface Props {
  employeeId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatItem({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export function EmployeeDetailDrawer({ employeeId, open, onOpenChange }: Props) {
  const { data: employee, isLoading } = useEmployee(employeeId);
  const { data: stats, isLoading: statsLoading } = useEmployeeStats(employeeId);

  const skillColors: Record<string, string> = {
    technician: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    helper: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    supervisor: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Employee Details</SheetTitle>
          <SheetDescription>View profile and performance</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !employee ? (
          <p className="text-muted-foreground text-sm mt-6">Employee not found.</p>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Profile Header */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold truncate">{employee.name}</h3>
                <p className="text-sm text-muted-foreground">{employee.employee_code}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className={skillColors[employee.skill_type]}>
                    {employee.skill_type}
                  </Badge>
                  <Badge variant={employee.is_active ? "default" : "secondary"}>
                    {employee.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Contact</h4>
              {employee.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.phone}</span>
                </div>
              )}
              {employee.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.email}</span>
                </div>
              )}
              {employee.designation && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{employee.designation}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{(employee as any).branches?.name ?? "—"}</span>
              </div>
            </div>

            <Separator />

            {/* This Month Stats */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">This Month</h4>
              {statsLoading ? (
                <div className="grid grid-cols-2 gap-2">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-2">
                  <StatItem icon={Clock} label="Total Hours" value={`${stats.totalHours}h`} />
                  <StatItem icon={Clock} label="OT Hours" value={`${stats.otHours}h`} />
                  <StatItem icon={TrendingUp} label="Utilization" value={`${stats.utilization}%`} />
                  <StatItem icon={DollarSign} label="Total Cost" value={`AED ${(stats.regularCost + stats.otCost).toLocaleString()}`} />
                </div>
              ) : null}
            </div>

            {/* Current Assignment */}
            {stats?.todayAssignment && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Today's Assignment</h4>
                  <div className="p-3 rounded-lg border border-border bg-card">
                    <p className="text-sm font-medium">{(stats.todayAssignment as any).projects?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(stats.todayAssignment as any).projects?.site_address}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stats.todayAssignment.shift_start} — {stats.todayAssignment.shift_end}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Rates */}
            <Separator />
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rates</h4>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Hourly</p>
                  <p className="font-semibold">AED {Number(employee.hourly_rate)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">OT Rate</p>
                  <p className="font-semibold">AED {Number(employee.overtime_rate)}</p>
                </div>
                <div className="p-2 rounded bg-muted/50 text-center">
                  <p className="text-xs text-muted-foreground">Std Hours</p>
                  <p className="font-semibold">{Number(employee.standard_hours_per_day)}h</p>
                </div>
              </div>
            </div>

            {employee.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{employee.notes}</p>
                </div>
              </>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
