import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import { useBranches } from "@/hooks/useEmployees";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

const steps = ["Basic Info", "Client", "Location & GPS", "Staffing"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProject?: Tables<"projects"> | null;
}

export function ProjectFormDialog({ open, onOpenChange, editProject }: Props) {
  const { toast } = useToast();
  const create = useCreateProject();
  const update = useUpdateProject();
  const { data: branches } = useBranches();
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    name: editProject?.name ?? "",
    status: editProject?.status ?? "planned",
    branch_id: editProject?.branch_id ?? "",
    start_date: editProject?.start_date ?? "",
    end_date: editProject?.end_date ?? "",
    budget: editProject?.budget?.toString() ?? "",
    project_value: editProject?.project_value?.toString() ?? "",
    notes: editProject?.notes ?? "",
    client_name: editProject?.client_name ?? "",
    client_phone: editProject?.client_phone ?? "",
    client_email: editProject?.client_email ?? "",
    site_address: editProject?.site_address ?? "",
    site_latitude: editProject?.site_latitude?.toString() ?? "",
    site_longitude: editProject?.site_longitude?.toString() ?? "",
    site_gps_radius: editProject?.site_gps_radius?.toString() ?? "100",
    required_technicians: editProject?.required_technicians?.toString() ?? "0",
    required_helpers: editProject?.required_helpers?.toString() ?? "0",
    required_supervisors: editProject?.required_supervisors?.toString() ?? "0",
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name || !form.branch_id) {
      toast({ title: "Name and branch are required", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      status: form.status as any,
      branch_id: form.branch_id,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      budget: form.budget ? parseFloat(form.budget) : null,
      project_value: form.project_value ? parseFloat(form.project_value) : null,
      notes: form.notes || null,
      client_name: form.client_name || null,
      client_phone: form.client_phone || null,
      client_email: form.client_email || null,
      site_address: form.site_address || null,
      site_latitude: form.site_latitude ? parseFloat(form.site_latitude) : null,
      site_longitude: form.site_longitude ? parseFloat(form.site_longitude) : null,
      site_gps_radius: parseInt(form.site_gps_radius) || 100,
      required_technicians: parseInt(form.required_technicians) || 0,
      required_helpers: parseInt(form.required_helpers) || 0,
      required_supervisors: parseInt(form.required_supervisors) || 0,
    };
    try {
      if (editProject) {
        await update.mutateAsync({ id: editProject.id, ...payload });
        toast({ title: "Project updated" });
      } else {
        await create.mutateAsync(payload);
        toast({ title: "Project created" });
      }
      onOpenChange(false);
      setStep(0);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setStep(0); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editProject ? "Edit" : "Create"} Project</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex gap-1 mb-2">
          {steps.map((s, i) => (
            <button
              key={s}
              onClick={() => setStep(i)}
              className={`flex-1 text-[10px] py-1.5 rounded-md font-medium transition-colors ${
                i === step ? "bg-brand text-white" : i < step ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="space-y-4 py-2 min-h-[220px]">
          {step === 0 && (
            <>
              <div><Label>Project Name *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Branch *</Label>
                  <Select value={form.branch_id} onValueChange={(v) => set("branch_id", v)}>
                    <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                    <SelectContent>{branches?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Budget (AED)</Label><Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} /></div>
                <div><Label>Project Value (AED)</Label><Input type="number" value={form.project_value} onChange={(e) => set("project_value", e.target.value)} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
            </>
          )}

          {step === 1 && (
            <>
              <div><Label>Client Name</Label><Input value={form.client_name} onChange={(e) => set("client_name", e.target.value)} /></div>
              <div><Label>Client Phone</Label><Input value={form.client_phone} onChange={(e) => set("client_phone", e.target.value)} /></div>
              <div><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} /></div>
            </>
          )}

          {step === 2 && (
            <>
              <div><Label>Site Address</Label><Input value={form.site_address} onChange={(e) => set("site_address", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Latitude</Label><Input type="number" step="any" value={form.site_latitude} onChange={(e) => set("site_latitude", e.target.value)} /></div>
                <div><Label>Longitude</Label><Input type="number" step="any" value={form.site_longitude} onChange={(e) => set("site_longitude", e.target.value)} /></div>
              </div>
              <div><Label>GPS Radius (meters)</Label><Input type="number" value={form.site_gps_radius} onChange={(e) => set("site_gps_radius", e.target.value)} /></div>
            </>
          )}

          {step === 3 && (
            <>
              <div><Label>Technicians Required</Label><Input type="number" value={form.required_technicians} onChange={(e) => set("required_technicians", e.target.value)} /></div>
              <div><Label>Helpers Required</Label><Input type="number" value={form.required_helpers} onChange={(e) => set("required_helpers", e.target.value)} /></div>
              <div><Label>Supervisors Required</Label><Input type="number" value={form.required_supervisors} onChange={(e) => set("required_supervisors", e.target.value)} /></div>
            </>
          )}
        </div>

        <div className="flex justify-between pt-2">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={create.isPending || update.isPending}>
              <Check className="h-4 w-4 mr-1" /> {editProject ? "Update" : "Create"} Project
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
