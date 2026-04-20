import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { toLocalDateStr } from "@/lib/utils";
import { useDailyLogs, useCreateDailyLog, useUpdateDailyLog, useDeleteDailyLog, uploadDailyLogPhoto, getSignedPhotoUrl } from "@/hooks/useDailyLogs";
import { DateInput } from "@/components/ui/date-input";
import type { DailyLog, DailyLogStatus } from "@/hooks/useDailyLogs";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Send, Camera, AlertTriangle, TrendingUp, Trash2, ImageIcon, X, User, Pencil,
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
        className="h-20 w-20 object-cover rounded-md border border-border hover:border-brand transition-colors"
        alt={`Site photo ${index + 1}`}
      />
    </a>
  );
}


interface Props {
  projectId: string;
}

export function ProjectDailyLogTab({ projectId }: Props) {
  const { data: logs, isLoading } = useDailyLogs(projectId);
  const createMutation = useCreateDailyLog();
  const updateMutation = useUpdateDailyLog();
  const deleteMutation = useDeleteDailyLog();
  const { user } = useAuth();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [description, setDescription] = useState("");
  const [logDate, setLogDate] = useState(toLocalDateStr(new Date()));
  const [issues, setIssues] = useState("");
  const [completionPct, setCompletionPct] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<DailyLogStatus>("pending");
  const [taskStartDate, setTaskStartDate] = useState("");
  const [taskEndDate, setTaskEndDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setDescription("");
    setLogDate(toLocalDateStr(new Date()));
    setIssues("");
    setCompletionPct("");
    setPhotos([]);
    setExistingPhotos([]);
    setStatus("pending");
    setTaskStartDate("");
    setTaskEndDate("");
    setShowForm(false);
    setEditingLog(null);
  };

  const startEdit = (log: DailyLog) => {
    setEditingLog(log);
    setDescription(log.description);
    setLogDate(log.date);
    setIssues(log.issues ?? "");
    setCompletionPct(log.completion_pct?.toString() ?? "");
    setExistingPhotos(log.photo_urls ?? []);
    setStatus(log.status ?? "pending");
    setTaskStartDate(log.task_start_date ?? "");
    setTaskEndDate(log.task_end_date ?? "");
    setPhotos([]);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      let newPhotoUrls: string[] = [];
      for (const file of photos) {
        const url = await uploadDailyLogPhoto(file, projectId);
        newPhotoUrls.push(url);
      }

      const allPhotos = [...existingPhotos, ...newPhotoUrls];

      if (editingLog) {
        await updateMutation.mutateAsync({
          id: editingLog.id,
          projectId,
          description: description.trim(),
          date: logDate,
          issues: issues.trim() || null,
          completion_pct: completionPct ? parseInt(completionPct) : null,
          photo_urls: allPhotos,
          status,
          task_start_date: taskStartDate || null,
          task_end_date: taskEndDate || null,
        });
        toast({ title: "Update edited" });
      } else {
        await createMutation.mutateAsync({
          project_id: projectId,
          description: description.trim(),
          date: logDate,
          completion_pct: completionPct ? parseInt(completionPct) : null,
          issues: issues.trim() || null,
          photo_urls: allPhotos,
          posted_by: user?.id ?? null,
          status,
          task_start_date: taskStartDate || null,
          task_end_date: taskEndDate || null,
        });
        toast({ title: "Daily update added" });
      }
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (logId: string) => {
    try {
      await deleteMutation.mutateAsync({ id: logId, projectId });
      toast({ title: "Update deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeExistingPhoto = (idx: number) => {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  // Group logs by date
  const logsByDate = (logs ?? []).reduce<Record<string, typeof logs>>((acc, log) => {
    const d = log.date;
    if (!acc[d]) acc[d] = [];
    acc[d]!.push(log);
    return acc;
  }, {});

  return (
    <Card className="glass-card">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">{logs?.length ?? 0} update{(logs?.length ?? 0) !== 1 ? "s" : ""}</p>
          {!showForm && (
            <Button size="sm" className="gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Update
            </Button>
          )}
        </div>

        {/* Add/Edit update form */}
        {showForm && (
          <Card className="mb-6 border-brand/30 bg-brand/5">
            <CardContent className="pt-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">
                {editingLog ? "Edit Update" : "New Update"}
              </p>
              <Textarea
                placeholder="What was done today? Describe the work completed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                  <DateInput value={logDate} onChange={setLogDate} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <Select value={status} onValueChange={(v) => setStatus(v as DailyLogStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="on_hold">On Hold</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
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
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Issues / Blockers</label>
                  <Input
                    placeholder="Any problems encountered?"
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                  />
                </div>
              </div>

              {/* Existing photos (edit mode) */}
              {existingPhotos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {existingPhotos.map((url, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={url}
                        className="h-16 w-16 object-cover rounded-md border border-border"
                        alt=""
                      />
                      <button
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeExistingPhoto(i)}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Photo upload */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => fileRef.current?.click()}
                >
                  <Camera className="h-3.5 w-3.5" /> Attach Photos
                </Button>
                {photos.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {photos.map((f, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={URL.createObjectURL(f)}
                          className="h-16 w-16 object-cover rounded-md border border-border"
                          alt=""
                        />
                        <button
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removePhoto(i)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSubmit}
                  disabled={uploading || createMutation.isPending || updateMutation.isPending}
                >
                  <Send className="h-3.5 w-3.5" />
                  {uploading ? "Uploading..." : editingLog ? "Save Changes" : "Post Update"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Log entries */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : !logs?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No daily updates yet</p>
            <p className="text-xs mt-1">Start tracking progress by adding your first update</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(logsByDate)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([date, entries]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 rounded-full bg-brand" />
                    <span className="text-xs font-semibold text-foreground">
                      {format(new Date(date + "T00:00:00"), "EEE, dd MMM yyyy")}
                    </span>
                    <Badge variant="outline" className="text-[10px]">{entries!.length} update{entries!.length !== 1 ? "s" : ""}</Badge>
                  </div>

                  <div className="space-y-3 ml-3 border-l-2 border-border pl-4">
                    {entries!.map((log) => (
                      <div key={log.id} className="bg-accent/20 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm text-foreground">{log.description}</p>
                              <Select
                                value={log.status ?? "pending"}
                                onValueChange={async (v) => {
                                  try {
                                    await updateMutation.mutateAsync({
                                      id: log.id,
                                      projectId,
                                      status: v,
                                    });
                                    toast({ title: "Status updated" });
                                  } catch (err: any) {
                                    toast({ title: "Error", description: err.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <SelectTrigger className={`h-5 w-auto text-[10px] px-2 py-0 border rounded-full gap-1 ${
                                  log.status === "completed" ? "border-status-present/40 text-status-present" :
                                  log.status === "in_progress" ? "border-brand/40 text-brand" :
                                  log.status === "on_hold" ? "border-status-overtime/40 text-status-overtime" :
                                  "border-muted-foreground/40 text-muted-foreground"
                                }`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="on_hold">On Hold</SelectItem>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-brand"
                              onClick={() => startEdit(log)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDelete(log.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {log.completion_pct !== null && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-brand" />
                              {log.completion_pct}% complete
                            </span>
                          )}
                          {log.issues && (
                            <span className="flex items-center gap-1 text-status-overtime">
                              <AlertTriangle className="h-3 w-3" />
                              {log.issues}
                            </span>
                          )}
                          <span className="flex items-center gap-1 ml-auto">
                            <User className="h-3 w-3" />
                            {log.users?.name ?? log.employees?.name ?? "Unknown"} · {format(new Date(log.created_at), "HH:mm")}
                          </span>
                        </div>

                        {log.photo_urls?.length > 0 && (
                          <div className="flex gap-2 flex-wrap mt-1">
                            {log.photo_urls.map((url, i) => (
                              <SignedPhoto key={i} path={url} index={i} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
