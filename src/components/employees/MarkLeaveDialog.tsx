import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useCreateLeave } from "@/hooks/useLeave";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
}

export function MarkLeaveDialog({ open, onOpenChange, employeeId, employeeName }: Props) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const createLeave = useCreateLeave();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }

    try {
      await createLeave.mutateAsync({
        employee_id: employeeId,
        start_date: startDate,
        end_date: endDate,
        reason: reason || undefined,
      });
      toast({ title: "Leave recorded", description: `${employeeName} marked on leave from ${startDate} to ${endDate}. They will be auto-excluded from scheduling during this period.` });
      onOpenChange(false);
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark on Leave</DialogTitle>
          <DialogDescription>
            {employeeName} will be excluded from auto-assign during this period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <DateInput value={startDate} onChange={setStartDate} required />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Annual leave, sick leave, personal..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createLeave.isPending}>
              {createLeave.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark on Leave
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
