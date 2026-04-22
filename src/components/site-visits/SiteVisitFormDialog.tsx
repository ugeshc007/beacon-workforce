import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useBranches, useEmployees } from "@/hooks/useEmployees";
import { useCreateSiteVisit, useUpdateSiteVisit, type SiteVisit } from "@/hooks/useSiteVisits";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  edit?: SiteVisit | null;
}

const empty = {
  client_name: "",
  client_contact: "",
  client_email: "",
  site_address: "",
  site_latitude: "",
  site_longitude: "",
  project_type: "",
  scope_brief: "",
  visit_date: new Date().toISOString().slice(0, 10),
  priority: "normal" as "low" | "normal" | "high" | "urgent",
  lead_source: "",
  admin_notes: "",
  assigned_employee_id: "",
  branch_id: "",
};

export function SiteVisitFormDialog({ open, onOpenChange, edit }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: branches = [] } = useBranches();
  const { data: empResp } = useEmployees({ status: "active", pageSize: 200, branchId: undefined });
  const employees = empResp?.data ?? [];

  const create = useCreateSiteVisit();
  const update = useUpdateSiteVisit();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        client_name: edit.client_name ?? "",
        client_contact: edit.client_contact ?? "",
        client_email: edit.client_email ?? "",
        site_address: edit.site_address ?? "",
        site_latitude: edit.site_latitude?.toString() ?? "",
        site_longitude: edit.site_longitude?.toString() ?? "",
        project_type: edit.project_type ?? "",
        scope_brief: edit.scope_brief ?? "",
        visit_date: edit.visit_date,
        priority: edit.priority,
        lead_source: edit.lead_source ?? "",
        admin_notes: edit.admin_notes ?? "",
        assigned_employee_id: edit.assigned_employee_id ?? "",
        branch_id: edit.branch_id,
      });
    } else {
      setForm({ ...empty, branch_id: user?.branchId ?? "" });
    }
  }, [open, edit, user?.branchId]);

  const handleSubmit = async () => {
    if (!form.client_name.trim()) {
      toast({ title: "Client name required", variant: "destructive" });
      return;
    }
    if (!form.branch_id) {
      toast({ title: "Branch required", variant: "destructive" });
      return;
    }
    if (!form.visit_date) {
      toast({ title: "Visit date required", variant: "destructive" });
      return;
    }

    const payload = {
      client_name: form.client_name.trim(),
      client_contact: form.client_contact || null,
      client_email: form.client_email || null,
      site_address: form.site_address || null,
      site_latitude: form.site_latitude ? Number(form.site_latitude) : null,
      site_longitude: form.site_longitude ? Number(form.site_longitude) : null,
      project_type: form.project_type || null,
      scope_brief: form.scope_brief || null,
      visit_date: form.visit_date,
      priority: form.priority,
      lead_source: form.lead_source || null,
      admin_notes: form.admin_notes || null,
      assigned_employee_id: form.assigned_employee_id || null,
      branch_id: form.branch_id,
    };

    try {
      if (edit) {
        await update.mutateAsync({ id: edit.id, ...payload });
        toast({ title: "Site visit updated" });
      } else {
        await create.mutateAsync({ ...payload, assigned_by: user?.id ?? null } as any);
        toast({ title: "Site visit created", description: form.assigned_employee_id ? "Assigned to employee." : "Saved as pending." });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edit ? "Edit Site Visit" : "New Site Visit"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Client */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client / Lead</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Client / Company Name *</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label>Contact Number</Label>
                <Input value={form.client_contact} onChange={(e) => setForm({ ...form, client_contact: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Lead Source</Label>
                <Input placeholder="Referral, Website, Walk-in..." value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })} />
              </div>
            </div>
          </section>

          {/* Site */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Site Location</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Site Address</Label>
                <Textarea rows={2} value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} />
              </div>
              <div>
                <Label>Latitude</Label>
                <Input value={form.site_latitude} onChange={(e) => setForm({ ...form, site_latitude: e.target.value })} placeholder="25.2048" />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input value={form.site_longitude} onChange={(e) => setForm({ ...form, site_longitude: e.target.value })} placeholder="55.2708" />
              </div>
            </div>
          </section>

          {/* Project Brief */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Brief</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project Type</Label>
                <Input placeholder="Indoor / Outdoor LED, etc." value={form.project_type} onChange={(e) => setForm({ ...form, project_type: e.target.value })} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Scope Brief</Label>
                <Textarea rows={3} value={form.scope_brief} onChange={(e) => setForm({ ...form, scope_brief: e.target.value })} placeholder="Brief description of the work expected..." />
              </div>
            </div>
          </section>

          {/* Assignment */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignment</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Visit Date *</Label>
                <DateInput value={form.visit_date} onChange={(v) => setForm({ ...form, visit_date: v })} />
              </div>
              <div>
                <Label>Branch *</Label>
                <Select value={form.branch_id} onValueChange={(v) => setForm({ ...form, branch_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {branches.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Assign Employee</Label>
                <Select value={form.assigned_employee_id || "unassigned"} onValueChange={(v) => setForm({ ...form, assigned_employee_id: v === "unassigned" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">— Unassigned —</SelectItem>
                    {employees
                      .filter((e) => !form.branch_id || e.branch_id === form.branch_id)
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.employee_code})</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Internal Notes</Label>
                <Textarea rows={2} value={form.admin_notes} onChange={(e) => setForm({ ...form, admin_notes: e.target.value })} />
              </div>
            </div>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {edit ? "Save Changes" : "Create Site Visit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
