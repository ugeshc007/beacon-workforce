import { useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  useMaintenanceCall, useMaintenanceAssignments,
  useUpdateMaintenanceCall, useRemoveFromMaintenance,
  useMaintenanceImages, useUploadMaintenanceImage, useDeleteMaintenanceImage,
} from "@/hooks/useMaintenance";
import type { MaintenanceImage } from "@/hooks/useMaintenance";
import { MaintenanceFormDialog } from "@/components/maintenance/MaintenanceFormDialog";
import { MaintenanceAssignDialog } from "@/components/maintenance/MaintenanceAssignDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Pencil, UserPlus, Trash2, MapPin, Phone,
  Calendar, ShieldCheck, Clock, Wrench, ImagePlus, ChevronLeft,
  ChevronRight, X, Download, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const priorityLabel: Record<string, string> = {
  emergency: "🔴 Emergency",
  high: "🟠 High",
  normal: "🟡 Normal",
  low: "🟢 Low",
};

const statusOptions = ["open", "scheduled", "in_progress", "completed", "closed"] as const;

// ── Image Gallery Lightbox ──
function ImageLightbox({
  images,
  initialIndex,
  open,
  onClose,
  onDelete,
  isDeleting,
}: {
  images: MaintenanceImage[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
  onDelete: (img: MaintenanceImage) => void;
  isDeleting: boolean;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const img = images[idx];
  if (!open || !img) return null;

  const prev = () => setIdx((i) => (i > 0 ? i - 1 : images.length - 1));
  const next = () => setIdx((i) => (i < images.length - 1 ? i + 1 : 0));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] p-0 bg-background/95 backdrop-blur-xl border-border overflow-hidden">
        <div className="relative flex flex-col">
          {/* Top bar */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <span className="text-sm text-muted-foreground">
              {idx + 1} / {images.length}
              {img.caption && <span className="ml-2 text-foreground">— {img.caption}</span>}
            </span>
            <div className="flex items-center gap-1">
              {img.signedUrl && (
                <a href={img.signedUrl} target="_blank" rel="noopener noreferrer" download>
                  <Button variant="ghost" size="icon" className="h-8 w-8"><Download className="h-4 w-4" /></Button>
                </a>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(img)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Image */}
          <div className="relative flex items-center justify-center min-h-[50vh] max-h-[70vh] bg-black/20">
            {images.length > 1 && (
              <Button variant="ghost" size="icon" className="absolute left-2 z-10 h-10 w-10 rounded-full bg-background/60 hover:bg-background/80" onClick={prev}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <img
              src={img.signedUrl}
              alt={img.caption || "Maintenance photo"}
              className="max-h-[70vh] max-w-full object-contain"
            />
            {images.length > 1 && (
              <Button variant="ghost" size="icon" className="absolute right-2 z-10 h-10 w-10 rounded-full bg-background/60 hover:bg-background/80" onClick={next}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Info */}
          <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
            <span>Uploaded by {img.users?.name ?? "Unknown"}</span>
            <span>{format(new Date(img.created_at), "dd/MM/yyyy HH:mm")}</span>
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-1.5 p-3 pt-0 overflow-x-auto">
              {images.map((thumb, i) => (
                <button
                  key={thumb.id}
                  onClick={() => setIdx(i)}
                  className={cn(
                    "shrink-0 h-14 w-14 rounded-md overflow-hidden border-2 transition-all",
                    i === idx ? "border-brand ring-1 ring-brand/30" : "border-transparent opacity-60 hover:opacity-100",
                  )}
                >
                  <img src={thumb.signedUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Image Upload & Gallery Section ──
function MaintenanceImagesSection({ callId }: { callId: string }) {
  const { data: images, isLoading } = useMaintenanceImages(callId);
  const uploadMutation = useUploadMaintenanceImage();
  const deleteMutation = useDeleteMaintenanceImage();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [caption, setCaption] = useState("");

  const handleFiles = useCallback(async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      try {
        await uploadMutation.mutateAsync({
          callId,
          file,
          caption: caption.trim() || undefined,
          uploadedBy: user?.id,
        });
      } catch (err: any) {
        toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      }
    }
    setCaption("");
    if (fileRef.current) fileRef.current.value = "";
    toast({ title: "Photos uploaded", description: `${files.length} image(s) added successfully.` });
  }, [callId, caption, user?.id, uploadMutation, toast]);

  const handleDelete = async (img: MaintenanceImage) => {
    try {
      await deleteMutation.mutateAsync({ id: img.id, filePath: img.file_path });
      setLightboxIdx(null);
      toast({ title: "Image deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="glass-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImagePlus className="h-4 w-4 text-brand" />
            Issue Photos ({images?.length ?? 0})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
              Attach Photos
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
          />
        </div>

        {/* Gallery grid */}
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : !images?.length ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No photos attached yet. Upload images to document issues.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setLightboxIdx(i)}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-brand transition-colors"
              >
                <img
                  src={img.signedUrl}
                  alt={img.caption || "Issue photo"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
                {img.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                    <p className="text-[10px] text-white truncate">{img.caption}</p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxIdx !== null && images && (
          <ImageLightbox
            images={images}
            initialIndex={lightboxIdx}
            open={lightboxIdx !== null}
            onClose={() => setLightboxIdx(null)}
            onDelete={handleDelete}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </CardContent>
    </Card>
  );
}

export default function MaintenanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: call, isLoading } = useMaintenanceCall(id ?? null);
  const { data: assignments } = useMaintenanceAssignments(id ?? null);
  const updateMutation = useUpdateMaintenanceCall();
  const removeMutation = useRemoveFromMaintenance();
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const handleStatusChange = async (status: string) => {
    if (!id) return;
    try {
      await updateMutation.mutateAsync({ id, status: status as any });
      toast({ title: `Status updated to ${status.replace("_", " ")}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleRemoveAssignment = async (assignId: string) => {
    try {
      await removeMutation.mutateAsync(assignId);
      toast({ title: "Staff removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  if (!call) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Maintenance call not found</p>
        <Button variant="link" onClick={() => navigate("/maintenance")}>Back to list</Button>
      </div>
    );
  }

  const existingIds = (assignments ?? []).map((a) => a.employee_id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/maintenance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Wrench className="h-5 w-5 text-brand" />
              {call.company_name}
            </h1>
            <p className="text-xs text-muted-foreground">{priorityLabel[call.priority]} priority</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={call.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[150px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Details Card */}
        <Card className="glass-card md:col-span-1">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {call.contact_number && (
              <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" />{call.contact_number}</div>
            )}
            {call.location && (
              <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{call.location}</div>
            )}
            {call.scheduled_date && (
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {new Date(call.scheduled_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Permit: {call.permit_required ? <Badge variant="outline" className="text-[10px] bg-status-overtime/15 text-status-overtime border-status-overtime/30">Required</Badge> : <span className="text-muted-foreground">Not required</span>}
            </div>
            {call.scope && (
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Scope</p>
                <p className="text-sm whitespace-pre-wrap">{call.scope}</p>
              </div>
            )}
            {call.notes && (
              <div className="border-t border-border pt-2 mt-2">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{call.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Staff */}
        <Card className="glass-card md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Assigned Staff ({assignments?.length ?? 0})</CardTitle>
              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => setAssignOpen(true)}>
                <UserPlus className="h-3 w-3" /> Assign
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!assignments?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No staff assigned yet</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-xs font-medium text-brand shrink-0">
                        {a.employees?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{a.employees?.name ?? "Unknown"}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {a.employees?.skill_type === "team_member" ? "Member" : a.employees?.skill_type === "team_leader" ? "TL" : a.employees?.skill_type}
                          </Badge>
                          <span className="font-mono">{a.employees?.employee_code}</span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {a.shift_start?.slice(0, 5)} – {a.shift_end?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleRemoveAssignment(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Issue Photos Gallery */}
      <MaintenanceImagesSection callId={call.id} />

      <MaintenanceFormDialog open={editOpen} onOpenChange={setEditOpen} editCall={call} />
      <MaintenanceAssignDialog open={assignOpen} onOpenChange={setAssignOpen} maintenanceCallId={call.id} existingEmployeeIds={existingIds} />
    </div>
  );
}
