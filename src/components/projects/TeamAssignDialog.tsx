import { toLocalDateStr } from "@/lib/utils";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useEmployees } from "@/hooks/useEmployees";
import { useAssignEmployee } from "@/hooks/useProjects";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, UserPlus } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TeamAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingEmployeeIds: string[];
}

export function TeamAssignDialog({ open, onOpenChange, projectId, existingEmployeeIds }: TeamAssignDialogProps) {
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => toLocalDateStr(new Date()));
  const [shiftStart, setShiftStart] = useState("08:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const { data: empData, isLoading } = useEmployees({ search, status: "active", pageSize: 50 });
  const assignMutation = useAssignEmployee();
  const { toast } = useToast();

  const employees = empData?.data ?? [];
  const available = employees.filter((e) => !existingEmployeeIds.includes(e.id));

  const handleAssign = async (employeeId: string) => {
    try {
      await assignMutation.mutateAsync({
        projectId,
        employeeId,
        date,
        shiftStart,
        shiftEnd,
      });
      toast({ title: "Employee assigned", description: "Successfully added to project team." });
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign Employee to Project</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <DateInput value={date} onChange={setDate} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Shift Start</Label>
            <Input type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Shift End</Label>
            <Input type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees by name, code, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px] -mx-1 px-1">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : available.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "No matching employees found" : "All employees are already assigned"}
            </p>
          ) : (
            <div className="space-y-1">
              {available.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-medium text-brand shrink-0">
                      {emp.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{emp.name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{emp.skill_type}</Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">{emp.employee_code}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-7 text-xs gap-1"
                    disabled={assignMutation.isPending}
                    onClick={() => handleAssign(emp.id)}
                  >
                    <UserPlus className="h-3 w-3" />
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
