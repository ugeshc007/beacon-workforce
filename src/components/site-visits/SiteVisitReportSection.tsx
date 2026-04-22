import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useUpdateSiteVisit, type SiteVisit } from "@/hooks/useSiteVisits";
import { useToast } from "@/hooks/use-toast";

interface Props {
  visit: SiteVisit;
  editable?: boolean;
}

export function SiteVisitReportSection({ visit, editable }: Props) {
  const update = useUpdateSiteVisit();
  const { toast } = useToast();
  const [form, setForm] = useState({
    site_accessibility: visit.site_accessibility ?? "",
    site_dimensions: visit.site_dimensions ?? "",
    screen_type: visit.screen_type ?? "",
    screen_size: visit.screen_size ?? "",
    mounting_type: visit.mounting_type ?? "",
    power_availability: visit.power_availability ?? "",
    data_availability: visit.data_availability ?? "",
    internet_available: visit.internet_available ?? false,
    structural_notes: visit.structural_notes ?? "",
    environmental_notes: visit.environmental_notes ?? "",
    challenges: visit.challenges ?? "",
    recommendations: visit.recommendations ?? "",
    employee_notes: visit.employee_notes ?? "",
    signed_by_name: visit.signed_by_name ?? "",
  });

  useEffect(() => {
    setForm({
      site_accessibility: visit.site_accessibility ?? "",
      site_dimensions: visit.site_dimensions ?? "",
      screen_type: visit.screen_type ?? "",
      screen_size: visit.screen_size ?? "",
      mounting_type: visit.mounting_type ?? "",
      power_availability: visit.power_availability ?? "",
      data_availability: visit.data_availability ?? "",
      internet_available: visit.internet_available ?? false,
      structural_notes: visit.structural_notes ?? "",
      environmental_notes: visit.environmental_notes ?? "",
      challenges: visit.challenges ?? "",
      recommendations: visit.recommendations ?? "",
      employee_notes: visit.employee_notes ?? "",
      signed_by_name: visit.signed_by_name ?? "",
    });
  }, [visit]);

  const save = async () => {
    try {
      await update.mutateAsync({ id: visit.id, ...form });
      toast({ title: "Report saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const ro = !editable;

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Site Conditions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Accessibility" value={form.site_accessibility} onChange={(v) => setForm({ ...form, site_accessibility: v })} ro={ro} placeholder="Easy / Difficult / Restricted hours" />
          <Field label="Site Dimensions" value={form.site_dimensions} onChange={(v) => setForm({ ...form, site_dimensions: v })} ro={ro} placeholder="W x H x D (m)" />
          <Field label="Power Availability" value={form.power_availability} onChange={(v) => setForm({ ...form, power_availability: v })} ro={ro} placeholder="220V / 3-phase / None" />
          <Field label="Data / Network" value={form.data_availability} onChange={(v) => setForm({ ...form, data_availability: v })} ro={ro} placeholder="LAN port / WiFi / None" />
          <div className="col-span-2 flex items-center justify-between p-3 rounded-md bg-muted/30">
            <Label>Internet Available on Site</Label>
            <Switch checked={form.internet_available} onCheckedChange={(c) => !ro && setForm({ ...form, internet_available: c })} disabled={ro} />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Installation Specs</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Screen Type" value={form.screen_type} onChange={(v) => setForm({ ...form, screen_type: v })} ro={ro} placeholder="Indoor P2.5 / Outdoor P5" />
          <Field label="Screen Size" value={form.screen_size} onChange={(v) => setForm({ ...form, screen_size: v })} ro={ro} placeholder="3m x 2m" />
          <div className="col-span-2">
            <Field label="Mounting Type" value={form.mounting_type} onChange={(v) => setForm({ ...form, mounting_type: v })} ro={ro} placeholder="Wall / Truss / Floor stand" />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="font-semibold text-foreground">Notes & Recommendations</h3>
        <TextField label="Structural Notes" value={form.structural_notes} onChange={(v) => setForm({ ...form, structural_notes: v })} ro={ro} />
        <TextField label="Environmental Notes" value={form.environmental_notes} onChange={(v) => setForm({ ...form, environmental_notes: v })} ro={ro} placeholder="Sun, wind, dust, weatherproofing..." />
        <TextField label="Challenges" value={form.challenges} onChange={(v) => setForm({ ...form, challenges: v })} ro={ro} />
        <TextField label="Recommendations" value={form.recommendations} onChange={(v) => setForm({ ...form, recommendations: v })} ro={ro} />
        <TextField label="Additional Notes" value={form.employee_notes} onChange={(v) => setForm({ ...form, employee_notes: v })} ro={ro} />
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold text-foreground">Sign-off</h3>
        <Field label="Signed By (printed name)" value={form.signed_by_name} onChange={(v) => setForm({ ...form, signed_by_name: v })} ro={ro} />
        {visit.completed_at && (
          <p className="text-xs text-muted-foreground">Completed at: {new Date(visit.completed_at).toLocaleString()}</p>
        )}
      </Card>

      {editable && (
        <div className="flex justify-end">
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Report
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, ro, placeholder }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={ro} placeholder={placeholder} />
    </div>
  );
}

function TextField({ label, value, onChange, ro, placeholder }: { label: string; value: string; onChange: (v: string) => void; ro?: boolean; placeholder?: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} disabled={ro} placeholder={placeholder} />
    </div>
  );
}
