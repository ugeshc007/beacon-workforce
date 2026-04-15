import { useState, useEffect, useMemo, useRef } from "react";
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
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2 } from "lucide-react";

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
  const { data: projects } = useProjects();
  const isEdit = !!editCall;
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Extract unique client names from projects
  const clientNames = useMemo(() => {
    if (!projects) return [];
    const names = new Set<string>();
    projects.forEach((p) => {
      if (p.client_name?.trim()) names.add(p.client_name.trim());
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [projects]);

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

  // Filter suggestions based on input
  const filteredClients = useMemo(() => {
    if (!form.company_name.trim()) return clientNames;
    const q = form.company_name.toLowerCase();
    return clientNames.filter((n) => n.toLowerCase().includes(q));
  }, [form.company_name, clientNames]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectClient = (name: string) => {
    setForm((f) => ({ ...f, company_name: name }));
    setShowSuggestions(false);

    // Auto-fill contact info from project if available
    const project = projects?.find((p) => p.client_name === name);
    if (project) {
      setForm((f) => ({
        ...f,
        company_name: name,
        contact_number: f.contact_number || project.client_phone || "",
        location: f.location || project.site_address || "",
      }));
    }
  };

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
            <div className="col-span-2 relative">
              <Label>Company Name *</Label>
              <Input
                ref={inputRef}
                value={form.company_name}
                onChange={(e) => {
                  set("company_name", e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Enter or select existing client"
                autoComplete="off"
              />
              {showSuggestions && filteredClients.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 top-full left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-popover shadow-lg"
                >
                  {filteredClients.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                      onClick={() => selectClient(name)}
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{name}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">Existing Client</span>
                    </button>
                  ))}
                </div>
              )}
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
            <Label>Branch *</Label>
            <Select value={form.branch_id} onValueChange={(v) => set("branch_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches?.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
