import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import { useDailyLogs, useCreateDailyLog, useUpdateDailyLog, uploadDailyLogPhoto, getSignedPhotoUrl } from "@/hooks/useDailyLogs";
import { usePhotoCapture } from "@/hooks/usePhotoCapture";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { DailyLogStatus } from "@/hooks/useDailyLogs";
import {
  Plus, Send, Camera, AlertTriangle, TrendingUp, ImageIcon, X, User, FileText,
  CheckCircle2, Clock, Loader2,
} from "lucide-react";

function SignedPhoto({ path, index }: { path: string; index: number }) {
  const [src, setSrc] = useState(path);
  useEffect(() => {
    getSignedPhotoUrl(path).then(setSrc);
  }, [path]);
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        className="h-20 w-20 object-cover rounded-lg border border-border"
        alt={`Site photo ${index + 1}`}
      />
    </a>
  );
}

const statusConfig: Record<string, { label: string; color: string }> = {
  on_hold: { label: "On Hold", color: "text-status-overtime border-status-overtime/40" },
  pending: { label: "Pending", color: "text-muted-foreground border-muted-foreground/40" },
  in_progress: { label: "In Progress", color: "text-brand border-brand/40" },
  completed: { label: "Completed", color: "text-status-present border-status-present/40" },
};

export default function MobileDailyLog() {
  const { employee } = useMobileAuth();
  const { assignment } = useMobileWorkflow();
  const { toast } = useToast();
  const { captureAndUpload, uploading: cameraUploading } = usePhotoCapture();

  const projectId = assignment?.projectId || null;
  const { data: logs, isLoading } = useDailyLogs(projectId);
  const createMutation = useCreateDailyLog();
  const updateMutation = useUpdateDailyLog();

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [issues, setIssues] = useState("");
  const [completionPct, setCompletionPct] = useState("");
  const [status, setStatus] = useState<DailyLogStatus>("in_progress");
  const [photos, setPhotos] = useState<string[]>([]); // storage paths
  const [localPhotos, setLocalPhotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setIssues("");
    setCompletionPct("");
    setStatus("in_progress");
    setPhotos([]);
    setLocalPhotos([]);
    setShowForm(false);
  };

  const handleCameraCapture = async () => {
    if (!projectId) return;
    const path = await captureAndUpload(projectId);
    if (path) {
      setPhotos((prev) => [...prev, path]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !projectId) return;
    const files = Array.from(e.target.files);
    setUploading(true);
    try {
      for (const file of files) {
        const path = await uploadDailyLogPhoto(file, projectId);
        setPhotos((prev) => [...prev, path]);
      }
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    if (!projectId) {
      toast({ title: "No project assigned today", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      await createMutation.mutateAsync({
        project_id: projectId,
        description: description.trim(),
        issues: issues.trim() || null,
        completion_pct: completionPct ? parseInt(completionPct) : null,
        photo_urls: photos,
        employee_id: employee?.id || null,
        status,
      });
      // Notify branch managers
      try {
        await supabase.functions.invoke("notify-daily-log", {
          body: {
            project_id: projectId,
            employee_name: employee?.name || "Employee",
            description: description.trim(),
            status,
          },
        });
      } catch {}
      toast({ title: "Daily update posted ✓" });
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (logId: string, newStatus: string) => {
    if (!projectId) return;
    try {
      await updateMutation.mutateAsync({ id: logId, projectId, status: newStatus });
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (!projectId) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-4 text-center">
        <AlertTriangle className="h-10 w-10 text-status-traveling mb-3" />
        <p className="font-semibold text-foreground">No Project Assigned</p>
        <p className="text-sm text-muted-foreground mt-1">You need a project assignment for today to post daily logs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-3 pt-3 pb-24 safe-area-inset max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-foreground leading-tight">Daily Log</h1>
          <p className="text-xs text-muted-foreground truncate">{assignment?.projectName}</p>
        </div>
        {!showForm && (
          <Button size="sm" className="gap-1 shrink-0 text-xs px-2.5 h-8" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        )}
      </div>

      {/* New Update Form */}
      {showForm && (
        <Card className="p-3 border-brand/30 bg-brand/5 space-y-2.5 overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Post Update</p>

          <Textarea
            placeholder="What work was done? Describe the progress..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="bg-background"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as DailyLogStatus)}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Completion %</label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 45"
                value={completionPct}
                onChange={(e) => setCompletionPct(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Issues / Blockers</label>
            <Textarea
              placeholder="Report any problems, complaints, or blockers..."
              value={issues}
              onChange={(e) => setIssues(e.target.value)}
              rows={2}
              className="bg-background"
            />
          </div>

          {/* Photos */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Site Photos</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleCameraCapture}
                disabled={cameraUploading}
              >
                <Camera className="h-3.5 w-3.5" />
                {cameraUploading ? "Capturing..." : "Camera"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                {uploading ? "Uploading..." : "Gallery"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {photos.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((path, i) => (
                  <div key={i} className="relative group">
                    <SignedPhoto path={path} index={i} />
                    <button
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-5 w-5 flex items-center justify-center"
                      onClick={() => removePhoto(i)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleSubmit}
              disabled={uploading || cameraUploading || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Post Update
            </Button>
          </div>
        </Card>
      )}

      {/* Log entries */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
        </div>
      ) : !logs?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No daily logs yet</p>
          <p className="text-xs mt-1">Tap "New Update" to post your first progress report</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const sc = statusConfig[log.status] || statusConfig.pending;
            return (
              <Card key={log.id} className="p-3 border-border/50 bg-card space-y-2">
                {/* Description + status */}
                <div className="flex items-start justify-between gap-1.5">
                  <p className="text-sm text-foreground flex-1 break-words min-w-0">{log.description}</p>
                  <Select
                    value={log.status ?? "pending"}
                    onValueChange={(v) => handleStatusChange(log.id, v)}
                  >
                    <SelectTrigger className={`h-6 w-auto text-[10px] px-2 py-0 border rounded-full gap-1 shrink-0 max-w-[100px] ${sc.color}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {log.completion_pct !== null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-brand" />
                      {log.completion_pct}%
                    </span>
                  )}
                  {log.issues && (
                    <span className="flex items-center gap-1 text-status-absent">
                      <AlertTriangle className="h-3 w-3" />
                      {log.issues}
                    </span>
                  )}
                  <span className="flex items-center gap-1 ml-auto">
                    <Clock className="h-3 w-3" />
                    {format(new Date(log.created_at), "dd MMM · HH:mm")}
                  </span>
                </div>

                {/* Photos */}
                {log.photo_urls?.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-1">
                    {log.photo_urls.map((url, i) => (
                      <SignedPhoto key={i} path={url} index={i} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
