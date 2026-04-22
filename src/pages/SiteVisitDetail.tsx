import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Mail, Calendar, User, Pencil, FileCheck2, FolderPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSiteVisit, useSiteVisitPhotos, useUpdateSiteVisit, useConvertSiteVisitToProject, getSiteVisitPhotoUrl } from "@/hooks/useSiteVisits";
import { SiteVisitFormDialog } from "@/components/site-visits/SiteVisitFormDialog";
import { SiteVisitReportSection } from "@/components/site-visits/SiteVisitReportSection";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  completed: "bg-green-500/15 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
  converted: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

export default function SiteVisitDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: visit, isLoading } = useSiteVisit(id ?? null);
  const { data: photos = [] } = useSiteVisitPhotos(id ?? null);
  const update = useUpdateSiteVisit();
  const convert = useConvertSiteVisitToProject();
  const [editOpen, setEditOpen] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos) {
        const url = await getSiteVisitPhotoUrl(p.file_path);
        if (url) map[p.id] = url;
      }
      setPhotoUrls(map);
    })();
  }, [photos]);

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;
  if (!visit) return <div className="p-6 text-muted-foreground">Site visit not found.</div>;

  const handleConvert = async () => {
    if (!confirm(`Create a new project from this site visit for "${visit.client_name}"?`)) return;
    try {
      const proj = await convert.mutateAsync(visit);
      toast({ title: "Project created", description: "Pre-filled with client and site data." });
      navigate(`/projects/${proj.id}`);
    } catch (e: any) {
      toast({ title: "Convert failed", description: e.message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (status: any) => {
    try {
      await update.mutateAsync({ id: visit.id, status });
      toast({ title: `Marked as ${status.replace("_", " ")}` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground truncate">{visit.client_name}</h1>
            <Badge variant="outline" className={statusColors[visit.status]}>{visit.status.replace("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{visit.project_type || "Site Visit"} • {visit.visit_date}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4 mr-2" />Edit</Button>
          {visit.status === "completed" && !visit.converted_to_project_id && (
            <Button onClick={handleConvert} disabled={convert.isPending}>
              {convert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FolderPlus className="h-4 w-4 mr-2" />}
              Convert to Project
            </Button>
          )}
          {visit.converted_to_project_id && (
            <Button asChild variant="secondary">
              <Link to={`/projects/${visit.converted_to_project_id}`}>View Project</Link>
            </Button>
          )}
        </div>
      </div>

      {visit.status !== "converted" && visit.status !== "cancelled" && (
        <Card className="p-3 flex gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground self-center mr-2">Quick Status:</span>
          {visit.status !== "in_progress" && <Button size="sm" variant="outline" onClick={() => handleStatusChange("in_progress")}>Mark In Progress</Button>}
          {visit.status !== "completed" && <Button size="sm" variant="outline" onClick={() => handleStatusChange("completed")}><FileCheck2 className="h-4 w-4 mr-1.5" />Mark Completed</Button>}
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("cancelled")} className="text-destructive">Cancel</Button>
        </Card>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="report">Site Report</TabsTrigger>
          <TabsTrigger value="photos">Photos ({photos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Client</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow icon={User} label="Client" value={visit.client_name} />
              <InfoRow icon={Phone} label="Contact" value={visit.client_contact} />
              <InfoRow icon={Mail} label="Email" value={visit.client_email} />
              <InfoRow icon={MapPin} label="Address" value={visit.site_address} />
            </div>
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground">Brief</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Project Type" value={visit.project_type} />
              <InfoRow label="Priority" value={visit.priority} />
              <InfoRow label="Lead Source" value={visit.lead_source} />
              <InfoRow icon={Calendar} label="Visit Date" value={visit.visit_date} />
              <InfoRow label="Assigned" value={visit.assigned_employee?.name} />
              <InfoRow label="Branch" value={visit.branches?.name} />
            </div>
            {visit.scope_brief && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Scope</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{visit.scope_brief}</p>
              </div>
            )}
            {visit.admin_notes && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Internal Notes</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{visit.admin_notes}</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <SiteVisitReportSection visit={visit} editable />
        </TabsContent>

        <TabsContent value="photos" className="mt-4">
          {photos.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">No photos uploaded yet.</Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {photos.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  {photoUrls[p.id] ? (
                    <img src={photoUrls[p.id]} alt={p.caption ?? "Site photo"} className="w-full h-40 object-cover" />
                  ) : (
                    <div className="w-full h-40 bg-muted animate-pulse" />
                  )}
                  {p.caption && <p className="p-2 text-xs text-muted-foreground truncate">{p.caption}</p>}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <SiteVisitFormDialog open={editOpen} onOpenChange={setEditOpen} edit={visit} />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon?: any; label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3" />}{label}
      </p>
      <p className="text-foreground">{value || "—"}</p>
    </div>
  );
}
