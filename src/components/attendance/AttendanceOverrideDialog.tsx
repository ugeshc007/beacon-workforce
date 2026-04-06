import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOverrideAttendance, type AttendanceLog } from "@/hooks/useAttendance";
import { useToast } from "@/hooks/use-toast";

interface Props {
  log: AttendanceLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toLocalInput = (ts: string | null) => {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function AttendanceOverrideDialog({ log, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const override = useOverrideAttendance();

  const [form, setForm] = useState({
    office_punch_in: toLocalInput(log?.office_punch_in ?? null),
    travel_start_time: toLocalInput(log?.travel_start_time ?? null),
    site_arrival_time: toLocalInput(log?.site_arrival_time ?? null),
    work_start_time: toLocalInput(log?.work_start_time ?? null),
    work_end_time: toLocalInput(log?.work_end_time ?? null),
    office_punch_out: toLocalInput(log?.office_punch_out ?? null),
    notes: log?.notes ?? "",
    override_reason: "",
  });

  // Reset form when log changes
  useState(() => {
    if (log) {
      setForm({
        office_punch_in: toLocalInput(log.office_punch_in),
        travel_start_time: toLocalInput(log.travel_start_time),
        site_arrival_time: toLocalInput(log.site_arrival_time),
        work_start_time: toLocalInput(log.work_start_time),
        work_end_time: toLocalInput(log.work_end_time),
        office_punch_out: toLocalInput(log.office_punch_out),
        notes: log.notes ?? "",
        override_reason: "",
      });
    }
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!log || !form.override_reason.trim()) {
      toast({ title: "Override reason is required", variant: "destructive" });
      return;
    }
    try {
      await override.mutateAsync({
        id: log.id,
        office_punch_in: form.office_punch_in ? new Date(form.office_punch_in).toISOString() : null,
        travel_start_time: form.travel_start_time ? new Date(form.travel_start_time).toISOString() : null,
        site_arrival_time: form.site_arrival_time ? new Date(form.site_arrival_time).toISOString() : null,
        work_start_time: form.work_start_time ? new Date(form.work_start_time).toISOString() : null,
        work_end_time: form.work_end_time ? new Date(form.work_end_time).toISOString() : null,
        office_punch_out: form.office_punch_out ? new Date(form.office_punch_out).toISOString() : null,
        notes: form.notes || null,
        override_reason: form.override_reason,
      });
      toast({ title: "Attendance overridden" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (!log) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override Attendance — {log.employees?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Punch In</Label><Input type="datetime-local" value={form.office_punch_in} onChange={(e) => set("office_punch_in", e.target.value)} /></div>
            <div><Label className="text-xs">Travel Start</Label><Input type="datetime-local" value={form.travel_start_time} onChange={(e) => set("travel_start_time", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Site Arrival</Label><Input type="datetime-local" value={form.site_arrival_time} onChange={(e) => set("site_arrival_time", e.target.value)} /></div>
            <div><Label className="text-xs">Work Start</Label><Input type="datetime-local" value={form.work_start_time} onChange={(e) => set("work_start_time", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Work End</Label><Input type="datetime-local" value={form.work_end_time} onChange={(e) => set("work_end_time", e.target.value)} /></div>
            <div><Label className="text-xs">Punch Out</Label><Input type="datetime-local" value={form.office_punch_out} onChange={(e) => set("office_punch_out", e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
          <div>
            <Label className="text-xs text-destructive">Override Reason *</Label>
            <Input value={form.override_reason} onChange={(e) => set("override_reason", e.target.value)} placeholder="Reason for manual correction…" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={override.isPending}>Save Override</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
