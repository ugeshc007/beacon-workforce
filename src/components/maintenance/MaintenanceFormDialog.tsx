import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useCreateMaintenanceCall, useUpdateMaintenanceCall, MaintenanceCall } from "@/hooks/useMaintenance";
import { useBranches } from "@/hooks/useEmployees";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editCall?: MaintenanceCall | null;
}

export function MaintenanceFormDialog({ open, onOpenChange, editCall }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const createMutation = useCreateMaintenanceCall();
  const updateMutation = useUpdateMaintenanceCall();
  const { data: branches } = useBranches();
  const isEdit = !!editCall;

  const [form, setForm] = useState({
    company_name: "",
    contact_number: "",
    location: "",
    scope: "",
    permit_required: false,
    priority: "normal" as "emergency" | "high" | "normal" | "low",
    scheduled_date: "",
    notes: "",
    branch_id: "",
  });

  useEffect(() => {
    if (editCall) {
      setForm({
        company_name: editCall.company_name,
        contact_number: editCall.contact_number ?? "",
        location: editCall.location ?? "",
        scope: editCall.scope ?? "",
        permit_required: editCall.permit_required,
        priority: editCall.priority,
        scheduled_date: editCall.scheduled_date ?? "",
        notes: editCall.notes ?? "",
        branch_id: editCall.branch_id,
      });
    } else {
      setForm({
        company_name: "",
        contact_number: "",
        location: "",
        scope: "",
        permit_required: false,
        priority: "normal",
        scheduled_date: "",
        notes: "",
        branch_id: user?.branchId ?? "",
      });
    }
  }, [editCall, open, user?.branchId]);

  const handleSubmit = async () => {
    if (!form.company_name.trim()) {
      toast({ title: "Company name is required", variant: "destructive" });
      return;
    }
    if (!form.branch_id) {
      toast({ title: "Please select a branch", variant: "destructive" });
      return;
    }
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: editCall!.id,
          ...form,
          scheduled_date: form.scheduled_date || null,
          contact_number: form.contact_number || null,
          location: form.location || null,
          scope: form.scope || null,
          notes: form.notes || null,
        });
        toast({ title: "Maintenance call updated" });
      } else {
        await createMutation.mutateAsync({
          ...form,
          scheduled_date: form.scheduled_date || null,
          contact_number: form.contact_number || null,
          location: form.location || null,
          scope: form.scope || null,
          notes: form.notes || null,
          branch_id: form.branch_id,
          created_by: user?.id ?? null,
          status: "open",
        });
        toast({ title: "Maintenance call created" });
      }
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const set = (key: string, value: any) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit" : "New"} Maintenance Call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Company Name *</Label>
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Enter company name" />
            </div>
            <div>
              <Label>Contact Number</Label>
              <Input value={form.contact_number} onChange={(e) => set("contact_number", e.target.value)} placeholder="+971..." />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="emergency">🔴 Emergency</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="normal">🟡 Normal</SelectItem>
                  <SelectItem value="low">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Site address or area" />
          </div>

          <div>
            <Label>Scope</Label>
            <Textarea value={form.scope} onChange={(e) => set("scope", e.target.value)} placeholder="Describe the maintenance work needed" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scheduled Date</Label>
              <DateInput value={form.scheduled_date} onChange={(v) => set("scheduled_date", v)} />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <Switch checked={form.permit_required} onCheckedChange={(v) => set("permit_required", v)} />
              <Label className="cursor-pointer">Permit Required</Label>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any additional notes" rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
