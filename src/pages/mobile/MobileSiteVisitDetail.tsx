import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Camera, Save, CheckCircle2, Loader2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSiteVisit, useSiteVisitPhotos, useUpdateSiteVisit, useUploadSiteVisitPhoto, useDeleteSiteVisitPhoto, getSiteVisitPhotoUrl } from "@/hooks/useSiteVisits";
import { useToast } from "@/hooks/use-toast";
import { SiteVisitWorkflowCard } from "@/components/mobile/SiteVisitWorkflowCard";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-400",
  completed: "bg-green-500/15 text-green-400",
  cancelled: "bg-red-500/15 text-red-400",
  converted: "bg-purple-500/15 text-purple-400",
};

export default function MobileSiteVisitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: visit, isLoading } = useSiteVisit(id ?? null);
  const { data: photos = [] } = useSiteVisitPhotos(id ?? null);
  const update = useUpdateSiteVisit();
  const upload = useUploadSiteVisitPhoto();
  const delPhoto = useDeleteSiteVisitPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    site_accessibility: "", site_dimensions: "", screen_type: "", screen_size: "", mounting_type: "",
    power_availability: "", data_availability: "", internet_available: false,
    structural_notes: "", environmental_notes: "", challenges: "", recommendations: "", employee_notes: "",
    signed_by_name: "",
  });

  useEffect(() => {
    if (!visit) return;
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

  useEffect(() => {
    (async () => {
      const m: Record<string, string> = {};
      for (const p of photos) {
        const u = await getSiteVisitPhotoUrl(p.file_path);
        if (u) m[p.id] = u;
      }
      setPhotoUrls(m);
    })();
  }, [photos]);

  if (isLoading) return <div className="p-6 text-muted-foreground text-center">Loading...</div>;
  if (!visit) return <div className="p-6 text-muted-foreground text-center">Not found.</div>;

  const saveDraft = async () => {
    try {
      const newStatus = visit.status === "pending" ? "in_progress" : visit.status;
      await update.mutateAsync({ id: visit.id, ...form, status: newStatus });
      toast({ title: "Draft saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!form.signed_by_name.trim()) {
      toast({ title: "Please enter your name to sign off", variant: "destructive" });
      return;
    }
    if (!confirm("Submit this site visit report? You can still edit later if needed.")) return;
    try {
      await update.mutateAsync({
        id: visit.id,
        ...form,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: "Report submitted ✓" });
      navigate("/m/site-visits");
    } catch (e: any) {
      toast({ title: "Submit failed", description: e.message, variant: "destructive" });
    }
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await upload.mutateAsync({ siteVisitId: visit.id, file });
      toast({ title: "Photo uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ro = visit.status === "completed" || visit.status === "converted" || visit.status === "cancelled";

  return (
    <div className="p-4 pb-24 space-y-4 safe-area-inset">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-foreground truncate">{visit.client_name}</h1>
          <Badge variant="outline" className={statusColors[visit.status]}>{visit.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <Card className="p-3 space-y-1.5 text-sm">
        {visit.site_address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{visit.site_address}</p>}
        {visit.client_contact && <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5 shrink-0" />{visit.client_contact}</p>}
        {visit.scope_brief && <p className="text-foreground pt-1.5 border-t border-border/50">{visit.scope_brief}</p>}
      </Card>

      {/* Step-by-step workflow (Travel → Arrive → Survey → Break → End) */}
      <SiteVisitWorkflowCard siteVisitId={visit.id} />

      <Tabs defaultValue="site" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="site">Site</TabsTrigger>
          <TabsTrigger value="install">Install</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="space-y-3 mt-3">
          <MField label="Accessibility" v={form.site_accessibility} on={(v) => setForm({ ...form, site_accessibility: v })} ro={ro} ph="Easy / Hard / Restricted" />
          <MField label="Dimensions" v={form.site_dimensions} on={(v) => setForm({ ...form, site_dimensions: v })} ro={ro} ph="W x H x D" />
          <MField label="Power" v={form.power_availability} on={(v) => setForm({ ...form, power_availability: v })} ro={ro} ph="220V / 3-phase" />
          <MField label="Data / Network" v={form.data_availability} on={(v) => setForm({ ...form, data_availability: v })} ro={ro} />
          <Card className="p-3 flex items-center justify-between">
            <Label>Internet Available</Label>
            <Switch checked={form.internet_available} onCheckedChange={(c) => !ro && setForm({ ...form, internet_available: c })} disabled={ro} />
          </Card>
        </TabsContent>

        <TabsContent value="install" className="space-y-3 mt-3">
          <MField label="Screen Type" v={form.screen_type} on={(v) => setForm({ ...form, screen_type: v })} ro={ro} ph="Indoor P2.5 / Outdoor P5" />
          <MField label="Screen Size" v={form.screen_size} on={(v) => setForm({ ...form, screen_size: v })} ro={ro} />
          <MField label="Mounting" v={form.mounting_type} on={(v) => setForm({ ...form, mounting_type: v })} ro={ro} ph="Wall / Truss / Stand" />
        </TabsContent>

        <TabsContent value="notes" className="space-y-3 mt-3">
          <MText label="Structural Notes" v={form.structural_notes} on={(v) => setForm({ ...form, structural_notes: v })} ro={ro} />
          <MText label="Environmental" v={form.environmental_notes} on={(v) => setForm({ ...form, environmental_notes: v })} ro={ro} />
          <MText label="Challenges" v={form.challenges} on={(v) => setForm({ ...form, challenges: v })} ro={ro} />
          <MText label="Recommendations" v={form.recommendations} on={(v) => setForm({ ...form, recommendations: v })} ro={ro} />
          <MText label="Other Notes" v={form.employee_notes} on={(v) => setForm({ ...form, employee_notes: v })} ro={ro} />
          <MField label="Sign-off (your name)" v={form.signed_by_name} on={(v) => setForm({ ...form, signed_by_name: v })} ro={ro} />
        </TabsContent>

        <TabsContent value="photos" className="space-y-3 mt-3">
          {!ro && (
            <>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="w-full" variant="outline">
                {upload.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                Take / Upload Photo
              </Button>
            </>
          )}
          {photos.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No photos yet.</Card>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p) => (
                <Card key={p.id} className="overflow-hidden relative">
                  {photoUrls[p.id] ? (
                    <img src={photoUrls[p.id]} alt="" className="w-full h-32 object-cover" />
                  ) : (
                    <div className="w-full h-32 bg-muted animate-pulse" />
                  )}
                  {!ro && (
                    <Button size="icon" variant="destructive" className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => delPhoto.mutate({ id: p.id, filePath: p.file_path, siteVisitId: visit.id })}>
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {!ro && (
        <div className="grid grid-cols-2 gap-2 sticky bottom-20">
          <Button variant="outline" onClick={saveDraft} disabled={update.isPending}>
            <Save className="h-4 w-4 mr-2" />Save Draft
          </Button>
          <Button onClick={submit} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}

function MField({ label, v, on, ro, ph }: { label: string; v: string; on: (v: string) => void; ro?: boolean; ph?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={v} onChange={(e) => on(e.target.value)} disabled={ro} placeholder={ph} />
    </div>
  );
}
function MText({ label, v, on, ro }: { label: string; v: string; on: (v: string) => void; ro?: boolean }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={v} onChange={(e) => on(e.target.value)} disabled={ro} />
    </div>
  );
}
