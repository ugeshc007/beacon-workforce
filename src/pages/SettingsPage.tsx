import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2, MapPin, Clock, Bell, Shield, Database, Save, Plus, Pencil, Trash2,
  Map, FileText, Download, Eye,
} from "lucide-react";
import {
  useSettings, useSaveSettings, useBranchList, useCreateBranch, useUpdateBranch, useDeleteBranch,
  useOffices, useCreateOffice, useUpdateOffice, useDeleteOffice,
  useSystemAuditLog, useAssignmentAuditLog,
  type SettingsMap,
} from "@/hooks/useSettings";
import { useRolePermissions, useUpdatePermission, useSkillPermissions, useUpdateSkillPermission } from "@/hooks/usePermissions";
import { useCustomSkills } from "@/hooks/useCustomSkills";
import { useAuth } from "@/hooks/useAuth";
import { DateInput } from "@/components/ui/date-input";
import { downloadCsv } from "@/lib/csv-export";
import LocationPickerMap from "@/components/settings/LocationPickerMap";
import { SkillRolesSection } from "@/components/settings/SkillRolesSection";
import { PublicHolidaysSection } from "@/components/settings/PublicHolidaysSection";

// ─── helpers ────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionCard({ icon: Icon, title, desc, children, onSave, saving }: {
  icon: React.ElementType; title: string; desc: string;
  children: React.ReactNode; onSave?: () => void; saving?: boolean;
}) {
  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-brand" /> {title}
        </CardTitle>
        <CardDescription className="text-xs">{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {children}
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={saving} className="mt-2">
            <Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Branch dialog ──────────────────────────────────────────
function BranchDialog({ branch, open, onOpenChange }: {
  branch?: { id: string; name: string; city: string | null; address: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const saving = create.isPending || update.isPending;

  // Sync form fields when branch changes or dialog opens
  useEffect(() => {
    if (open) {
      setName(branch?.name ?? "");
      setCity(branch?.city ?? "");
      setAddress(branch?.address ?? "");
    }
  }, [open, branch]);

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), city: city.trim() || undefined, address: address.trim() || undefined };
    if (branch) {
      update.mutate({ id: branch.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{branch ? "Edit Branch" : "New Branch"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Branch Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dubai Main" /></Field>
          <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Dubai" /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" /></Field>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Office dialog ──────────────────────────────────────────
function OfficeDialog({ office, branchId, open, onOpenChange }: {
  office?: { id: string; name: string; address: string | null; latitude: number | null; longitude: number | null; gps_radius_meters: number } | null;
  branchId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [radius, setRadius] = useState("100");
  const [showMap, setShowMap] = useState(false);
  const create = useCreateOffice();
  const update = useUpdateOffice();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (open) {
      setName(office?.name ?? "");
      setAddress(office?.address ?? "");
      setLat(office?.latitude?.toString() ?? "");
      setLng(office?.longitude?.toString() ?? "");
      setRadius(office?.gps_radius_meters?.toString() ?? "100");
      setShowMap(false);
    }
  }, [open, office]);

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = {
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: lat ? parseFloat(lat) : undefined,
      longitude: lng ? parseFloat(lng) : undefined,
      gps_radius_meters: parseInt(radius) || 100,
    };
    if (office) {
      update.mutate({ id: office.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate({ branch_id: branchId, ...payload }, { onSuccess: () => onOpenChange(false) });
    }
  };

  const handleMapSelect = (selectedLat: number, selectedLng: number) => {
    setLat(selectedLat.toFixed(6));
    setLng(selectedLng.toFixed(6));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{office ? "Edit Office" : "New Office"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Office Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Head Office" /></Field>
          <Field label="Address"><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" hint="e.g. 25.2048">
              <Input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="25.2048" />
            </Field>
            <Field label="Longitude" hint="e.g. 55.2708">
              <div className="flex gap-1.5">
                <Input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="55.2708" className="flex-1" />
                <Button type="button" size="icon" variant={showMap ? "default" : "outline"} className="h-9 w-9 shrink-0" onClick={() => setShowMap(!showMap)} title="Pick from map">
                  <MapPin className="h-4 w-4" />
                </Button>
              </div>
            </Field>
          </div>
          {showMap && (
            <LocationPickerMap
              lat={lat ? parseFloat(lat) : null}
              lng={lng ? parseFloat(lng) : null}
              onSelect={handleMapSelect}
            />
          )}
          <Field label="GPS Radius (m)" hint="Punch-in valid within this radius of the office.">
            <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="100" />
          </Field>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Office list per branch ─────────────────────────────────
function BranchOfficeList({ branchId }: { branchId: string }) {
  const { data: offices, isLoading } = useOffices(branchId);
  const deleteOffice = useDeleteOffice();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOffice, setEditingOffice] = useState<typeof offices extends (infer T)[] ? T : never | null>(null);

  return (
    <div className="mt-2 mx-3 mb-3 p-3 space-y-1.5 rounded-lg border border-border/30 bg-muted/10">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Offices</p>
        <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={() => { setEditingOffice(null); setDialogOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Add Office
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-8 rounded" />
      ) : !offices?.length ? (
        <p className="text-[11px] text-muted-foreground italic">No offices configured. Add one with lat/lng for GPS validation.</p>
      ) : (
        offices.map((o) => (
          <div key={o.id} className="flex items-center justify-between p-2 rounded border border-border/30 bg-muted/10 text-xs">
            <div>
              <span className="font-medium text-foreground">{o.name}</span>
              {o.latitude && o.longitude ? (
                <span className="text-muted-foreground ml-2">📍 {Number(o.latitude).toFixed(4)}, {Number(o.longitude).toFixed(4)} ({o.gps_radius_meters}m)</span>
              ) : (
                <span className="text-amber-400 ml-2">⚠ No coordinates set</span>
              )}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingOffice(o); setDialogOpen(true); }}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteOffice.mutate(o.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))
      )}
      <OfficeDialog office={editingOffice} branchId={branchId} open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingOffice(null); }} />
    </div>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();
  const { data: branches, isLoading: branchesLoading } = useBranchList();
  const deleteBranch = useDeleteBranch();

  const [form, setForm] = useState<SettingsMap>({});
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<typeof branches extends (infer T)[] ? T : never | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key: string) => set(key, form[key] === "true" ? "false" : "true");
  const isOn = (key: string) => form[key] === "true";

  if (isLoading) {
    return (
      <div className="max-w-4xl space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
      </div>
    );
  }

  const saveSection = (keys: string[]) => {
    const subset: SettingsMap = {};
    for (const k of keys) subset[k] = form[k] ?? "";
    save.mutate(subset);
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key ? "****" : "";
    return key.slice(0, 6) + "****" + key.slice(-4);
  };

  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="maps">Maps</TabsTrigger>
          <TabsTrigger value="gps">Location</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Rules</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          {isAdmin && <TabsTrigger value="permissions">Roles</TabsTrigger>}
          {isAdmin && <TabsTrigger value="skills">Skill Roles</TabsTrigger>}
          {isAdmin && <TabsTrigger value="holidays">Public Holidays</TabsTrigger>}
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        {/* ── Company ─────────────────────── */}
        <TabsContent value="company">
          <SectionCard icon={Building2} title="Company Information" desc="Basic company details used across the platform."
            onSave={() => saveSection(["company_name", "company_email", "company_phone", "currency", "timezone"])} saving={save.isPending}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Company Name"><Input value={form.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} placeholder="BeBright LLC" /></Field>
              <Field label="Contact Email"><Input type="email" value={form.company_email ?? ""} onChange={(e) => set("company_email", e.target.value)} placeholder="info@bebright.ae" /></Field>
              <Field label="Phone"><Input value={form.company_phone ?? ""} onChange={(e) => set("company_phone", e.target.value)} placeholder="+971 …" /></Field>
              <Field label="Currency"><Input value={form.currency ?? "AED"} onChange={(e) => set("currency", e.target.value)} /></Field>
              <Field label="Timezone" hint="IANA timezone identifier">
                <Input value={form.timezone ?? "Asia/Dubai"} onChange={(e) => set("timezone", e.target.value)} />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Maps ────────────────────────── */}
        <TabsContent value="maps">
          <SectionCard icon={Map} title="Google Maps Integration" desc="Configure Google Maps API key for map features. The key is stored encrypted and never shown in full."
            onSave={() => saveSection(["google_maps_api_key", "google_maps_enabled"])} saving={save.isPending}>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant={form.google_maps_api_key ? "default" : "outline"} className="text-xs">
                  {form.google_maps_api_key ? "Configured" : "Not Configured"}
                </Badge>
                <div className="flex items-center gap-2">
                  <Switch checked={isOn("google_maps_enabled")} onCheckedChange={() => toggle("google_maps_enabled")} />
                  <span className="text-xs text-muted-foreground">{isOn("google_maps_enabled") ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
              <Field label="Google Maps API Key" hint="Enter your Google Maps API key. It will be masked after saving.">
                <Input
                  type="password"
                  value={form.google_maps_api_key ?? ""}
                  onChange={(e) => set("google_maps_api_key", e.target.value)}
                  placeholder={form.google_maps_api_key ? maskKey(form.google_maps_api_key) : "AIzaSy…"}
                />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── GPS / Location ──────────────── */}
        <TabsContent value="gps">
          <SectionCard icon={MapPin} title="GPS & Location Settings" desc="Control geofence radii, accuracy requirements, GPS mode, and spoof detection."
            onSave={() => saveSection(["gps_office_radius", "gps_site_radius", "gps_accuracy_threshold", "gps_spoof_detection", "gps_mode"])} saving={save.isPending}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Office Geofence Radius (m)" hint="Default radius around the office for punch-in validation.">
                <Input type="number" value={form.gps_office_radius ?? "100"} onChange={(e) => set("gps_office_radius", e.target.value)} />
              </Field>
              <Field label="Site Geofence Radius (m)" hint="Default radius around project sites for arrival validation.">
                <Input type="number" value={form.gps_site_radius ?? "150"} onChange={(e) => set("gps_site_radius", e.target.value)} />
              </Field>
              <Field label="Accuracy Threshold (m)" hint="GPS readings less accurate than this are flagged.">
                <Input type="number" value={form.gps_accuracy_threshold ?? "50"} onChange={(e) => set("gps_accuracy_threshold", e.target.value)} />
              </Field>
              <Field label="GPS Mode" hint="Strict: reject invalid GPS. Smart: flag but allow. Allow Map: let user confirm on map.">
                <Select value={form.gps_mode ?? "strict"} onValueChange={(v) => set("gps_mode", v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="smart">Smart</SelectItem>
                    <SelectItem value="allow_map">Allow Map Confirmation</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Spoof Detection">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("gps_spoof_detection")} onCheckedChange={() => toggle("gps_spoof_detection")} />
                  <span className="text-xs text-muted-foreground">{isOn("gps_spoof_detection") ? "Enabled" : "Disabled"}</span>
                </div>
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Attendance Rules ────────────── */}
        <TabsContent value="attendance">
          <SectionCard icon={Clock} title="Attendance & Overtime Rules" desc="Define working hours, OT, break, travel, and approval rules."
            onSave={() => saveSection(["standard_work_hours", "weekly_off_day", "friday_off", "late_threshold_minutes", "late_work_start_threshold_minutes", "break_duration_minutes", "travel_time_paid", "travel_delay_threshold_minutes", "office_punch_in_mandatory", "expense_approval_threshold"])} saving={save.isPending}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Standard Work Hours / Day">
                <Input type="number" value={form.standard_work_hours ?? "8"} onChange={(e) => set("standard_work_hours", e.target.value)} />
              </Field>
              <Field label="Late Threshold (minutes)" hint="Minutes after shift start before marked late.">
                <Input type="number" value={form.late_threshold_minutes ?? "15"} onChange={(e) => set("late_threshold_minutes", e.target.value)} />
              </Field>
              <Field label="Late Work Start Threshold (minutes)" hint="Minutes after shift start before a late-work-start alert is sent.">
                <Input type="number" value={form.late_work_start_threshold_minutes ?? "15"} onChange={(e) => set("late_work_start_threshold_minutes", e.target.value)} />
              </Field>
              <Field label="Travel Delay Threshold (minutes)" hint="Alert if travel exceeds this duration.">
                <Input type="number" value={form.travel_delay_threshold_minutes ?? "30"} onChange={(e) => set("travel_delay_threshold_minutes", e.target.value)} />
              </Field>
              <Field label="Break Duration (minutes)">
                <Input type="number" value={form.break_duration_minutes ?? "60"} onChange={(e) => set("break_duration_minutes", e.target.value)} />
              </Field>
              <Field label="Weekly Off Day" hint="Company's standard non-working day.">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.weekly_off_day ?? "sunday"}
                  onChange={(e) => set("weekly_off_day", e.target.value)}
                >
                  <option value="sunday">Sunday</option>
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="none">No weekly off</option>
                </select>
              </Field>
              <Field label="Office Punch-in Mandatory">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("office_punch_in_mandatory")} onCheckedChange={() => toggle("office_punch_in_mandatory")} />
                  <span className="text-xs text-muted-foreground">{isOn("office_punch_in_mandatory") ? "Required before travel" : "Optional"}</span>
                </div>
              </Field>
              <Field label="Travel Time Paid">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("travel_time_paid")} onCheckedChange={() => toggle("travel_time_paid")} />
                  <span className="text-xs text-muted-foreground">{isOn("travel_time_paid") ? "Travel hours counted" : "Travel not counted"}</span>
                </div>
              </Field>
              <Field label="Expense Approval Threshold (AED)" hint="Expenses above this amount require manager approval.">
                <Input type="number" value={form.expense_approval_threshold ?? "500"} onChange={(e) => set("expense_approval_threshold", e.target.value)} />
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Notifications ───────────────── */}
        <TabsContent value="notifications">
          <div className="space-y-6">
            <SectionCard icon={Bell} title="Notification Rules" desc="Configure alert timing, thresholds, and per-alert-type toggles."
              onSave={async () => {
                await saveSection([
                  "notification_morning_briefing", "notification_absent_alert_delay", "notification_ot_warning_hours",
                  "notification_absent_inapp", "notification_late_inapp", "notification_ot_inapp", "notification_shortage_inapp",
                  "escalation_delay_minutes",
                  "cron_absent_check_time", "cron_morning_briefing_time",
                ]);
                const { supabase } = await import("@/integrations/supabase/client");
                const absentTime = form.cron_absent_check_time;
                if (absentTime && /^\d{2}:\d{2}$/.test(absentTime)) {
                  try { await supabase.functions.invoke("update-cron-schedule", { body: { time_uae: absentTime } }); } catch {}
                }
                const briefingTime = form.cron_morning_briefing_time;
                if (briefingTime && /^\d{2}:\d{2}$/.test(briefingTime)) {
                  try { await supabase.functions.invoke("update-cron-schedule", { body: { time_uae: briefingTime, job: "morning-briefing" } }); } catch {}
                }
              }} saving={save.isPending}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Morning Briefing">
                  <div className="flex items-center gap-2 pt-1">
                    <Switch checked={isOn("notification_morning_briefing")} onCheckedChange={() => toggle("notification_morning_briefing")} />
                    <span className="text-xs text-muted-foreground">{isOn("notification_morning_briefing") ? "Enabled" : "Disabled"}</span>
                  </div>
                </Field>
                <Field label="Briefing Time (UAE)" hint="Daily time to send morning briefing. 24h format.">
                  <Input type="time" value={form.cron_morning_briefing_time ?? "07:00"} onChange={(e) => set("cron_morning_briefing_time", e.target.value)} />
                </Field>
                <Field label="Absent Check Time (UAE)" hint="Daily time to run absence check.">
                  <Input type="time" value={form.cron_absent_check_time ?? "09:00"} onChange={(e) => set("cron_absent_check_time", e.target.value)} />
                </Field>
                <Field label="Absent Alert Delay (min)" hint="Minutes after shift start to send absence alerts.">
                  <Input type="number" value={form.notification_absent_alert_delay ?? "30"} onChange={(e) => set("notification_absent_alert_delay", e.target.value)} />
                </Field>
                <Field label="OT Warning Threshold (hours)" hint="Alert when OT exceeds this in a month.">
                  <Input type="number" value={form.notification_ot_warning_hours ?? "20"} onChange={(e) => set("notification_ot_warning_hours", e.target.value)} />
                </Field>
                <Field label="Escalation Delay (minutes)" hint="If alert not dismissed, escalate to next manager level.">
                  <Input type="number" value={form.escalation_delay_minutes ?? "30"} onChange={(e) => set("escalation_delay_minutes", e.target.value)} />
                </Field>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-xs font-medium text-foreground mb-3">Per-Alert-Type Toggles (In-App)</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { key: "notification_absent_inapp", label: "Absent Employee" },
                    { key: "notification_late_inapp", label: "Late Arrival / Late Work Start" },
                    { key: "notification_ot_inapp", label: "OT Threshold" },
                    { key: "notification_shortage_inapp", label: "Manpower Shortage" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between rounded-lg border border-border/50 p-2.5">
                      <span className="text-xs text-foreground">{item.label}</span>
                      <Switch checked={isOn(item.key)} onCheckedChange={() => toggle(item.key)} />
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>
        </TabsContent>

        {/* ── Branches ────────────────────── */}
        <TabsContent value="branches">
          <Card className="glass-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-brand" /> Branch Management
                </CardTitle>
                <CardDescription className="text-xs mt-1">Manage company branches and locations.</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setEditingBranch(null); setBranchDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Branch
              </Button>
            </CardHeader>
            <CardContent>
              {branchesLoading ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
              ) : !branches?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No branches created yet.</p>
              ) : (
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="rounded-lg border border-border/50 bg-muted/20">
                      <div className="flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[b.city, b.address].filter(Boolean).join(" · ") || "No address"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {new Date(b.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </Badge>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingBranch(b); setBranchDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingBranch({ id: b.id, name: b.name })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <BranchOfficeList branchId={b.id} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <BranchDialog
            branch={editingBranch}
            open={branchDialogOpen}
            onOpenChange={(open) => { setBranchDialogOpen(open); if (!open) setEditingBranch(null); }}
          />
          <AlertDialog open={!!deletingBranch} onOpenChange={(open) => { if (!open) setDeletingBranch(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete branch "{deletingBranch?.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the branch. Deletion is blocked if the branch has active employees or projects.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteBranch.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    if (deletingBranch) {
                      deleteBranch.mutate(deletingBranch.id, { onSuccess: () => setDeletingBranch(null) });
                    }
                  }}
                >
                  {deleteBranch.isPending ? "Deleting…" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* ── Permissions ─────────────────── */}
        {isAdmin && (
          <TabsContent value="permissions">
            <PermissionMatrix />
          </TabsContent>
        )}

        {/* ── Skill Roles ─────────────────── */}
        {isAdmin && (
          <TabsContent value="skills">
            <SkillRolesSection />
          </TabsContent>
        )}

        {/* ── Public Holidays ─────────────── */}
        {isAdmin && (
          <TabsContent value="holidays">
            <PublicHolidaysSection />
          </TabsContent>
        )}

        {/* ── System ──────────────────────── */}
        <TabsContent value="system">
          <div className="space-y-6">
            <SectionCard icon={Database} title="System Information" desc="Platform details and diagnostics.">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Platform</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">BeBright Planner v2.0</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Backend</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">Cloud</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Region</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">Middle East (UAE)</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Currency</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">{form.currency || "AED"}</p>
                </div>
              </div>
            </SectionCard>

            {isAdmin && <SystemAuditLogSection />}
            {isAdmin && <AssignmentAuditLogSection />}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── System Audit Log ───────────────────────────────────────
function SystemAuditLogSection() {
  const [moduleFilter, setModuleFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useSystemAuditLog({
    module: moduleFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand" /> System Audit Log
          </CardTitle>
          <CardDescription className="text-xs mt-1">All data changes, filterable by user/module/date.</CardDescription>
        </div>
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {
            downloadCsv("system-audit-log.csv",
              ["Date", "User", "Module", "Action", "Record ID"],
              data.map((r: any) => [
                new Date(r.created_at).toLocaleString("en-GB"),
                r.users?.name ?? "System",
                r.module, r.action, r.record_id ?? "",
              ])
            );
          }}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3 flex-wrap">
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Module" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {["projects", "employees", "attendance", "schedule", "settings", "timesheets"].map((m) => (
                <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateInput value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-[150px]" />
          <DateInput value={dateTo} onChange={setDateTo} placeholder="To" className="w-[150px]" />
        </div>

        {isLoading ? <Skeleton className="h-40 rounded-lg" /> : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No audit log entries found.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">User</th>
                  <th className="text-left py-2 font-medium">Module</th>
                  <th className="text-left py-2 font-medium">Action</th>
                  <th className="text-left py-2 font-medium">Record</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-1.5 text-xs">{r.users?.name ?? "System"}</td>
                    <td className="py-1.5"><Badge variant="outline" className="text-[10px] capitalize">{r.module}</Badge></td>
                    <td className="py-1.5 text-xs capitalize">{r.action}</td>
                    <td className="py-1.5 text-xs text-muted-foreground font-mono">{r.record_id ? r.record_id.slice(0, 8) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Assignment Audit Log ───────────────────────────────────
function AssignmentAuditLogSection() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useAssignmentAuditLog({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-brand" /> Assignment Audit Log
          </CardTitle>
          <CardDescription className="text-xs mt-1">Schedule changes with before/after state.</CardDescription>
        </div>
        {data && data.length > 0 && (
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {
            downloadCsv("assignment-audit-log.csv",
              ["Date", "Changed By", "Project", "Change Type", "Assignment Date", "Reason"],
              data.map((r: any) => [
                new Date(r.created_at).toLocaleString("en-GB"),
                r.users?.name ?? "System",
                r.projects?.name ?? "—",
                r.change_type, r.date ?? "", r.reason ?? "",
              ])
            );
          }}><Download className="h-3.5 w-3.5 mr-1" />Export CSV</Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <DateInput value={dateFrom} onChange={setDateFrom} placeholder="From" className="w-[150px]" />
          <DateInput value={dateTo} onChange={setDateTo} placeholder="To" className="w-[150px]" />
        </div>

        {isLoading ? <Skeleton className="h-40 rounded-lg" /> : !data?.length ? (
          <p className="text-sm text-muted-foreground text-center py-6">No assignment changes found.</p>
        ) : (
          <ScrollArea className="h-[300px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border sticky top-0 bg-background">
                  <th className="text-left py-2 font-medium">Date</th>
                  <th className="text-left py-2 font-medium">Changed By</th>
                  <th className="text-left py-2 font-medium">Project</th>
                  <th className="text-left py-2 font-medium">Change</th>
                  <th className="text-left py-2 font-medium">For Date</th>
                  <th className="text-left py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/30">
                    <td className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-1.5 text-xs">{r.users?.name ?? "System"}</td>
                    <td className="py-1.5 text-xs font-medium">{r.projects?.name ?? "—"}</td>
                    <td className="py-1.5"><Badge variant="outline" className="text-[10px] capitalize">{r.change_type}</Badge></td>
                    <td className="py-1.5 text-xs">{r.date ?? "—"}</td>
                    <td className="py-1.5 text-xs text-muted-foreground max-w-[200px] truncate">{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Permission Matrix ──────────────────────────────────────
const MODULES = ["dashboard", "projects", "employees", "schedule", "attendance", "timesheets", "reports", "settings"];
const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
const ROLES = ["admin", "manager", "team_leader"];

function PermissionMatrix() {
  const { data: permissions, isLoading } = useRolePermissions();
  const { data: skillPerms, isLoading: skillsLoading } = useSkillPermissions();
  const { data: customSkills } = useCustomSkills();
  const updatePerm = useUpdatePermission();
  const updateSkillPerm = useUpdateSkillPermission();

  if (isLoading || skillsLoading) return <Skeleton className="h-64 rounded-xl" />;

  const getPermission = (role: string, module: string) =>
    permissions?.find((p) => p.role === role && p.module === module);
  const getSkillPermission = (skillId: string, module: string) =>
    skillPerms?.find((p) => p.custom_skill_id === skillId && p.module === module);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand" /> Permission Matrix
        </CardTitle>
        <CardDescription className="text-xs">
          Configure what each role and custom skill can do per module. Strict mode: a user must have permission from BOTH their role AND skill.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto space-y-8">
          {/* System roles */}
          {ROLES.map((role) => (
            <div key={role}>
              <h3 className="text-sm font-semibold capitalize text-foreground mb-3 flex items-center gap-2">
                <Badge variant={role === "admin" ? "default" : "outline"} className="text-[10px]">{role}</Badge>
                <span className="text-[10px] text-muted-foreground font-normal">System role</span>
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium w-40">Module</th>
                    <th className="text-center py-2 font-medium">View</th>
                    <th className="text-center py-2 font-medium">Create</th>
                    <th className="text-center py-2 font-medium">Edit</th>
                    <th className="text-center py-2 font-medium">Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((mod) => {
                    const perm = getPermission(role, mod);
                    if (!perm) return null;
                    return (
                      <tr key={mod} className="border-b border-border/50 last:border-0">
                        <td className="py-2 capitalize font-medium">{mod}</td>
                        {ACTIONS.map((action) => (
                          <td key={action} className="py-2 text-center">
                            <Checkbox
                              checked={perm[action]}
                              disabled={role === "admin" || updatePerm.isPending}
                              onCheckedChange={(checked) => {
                                updatePerm.mutate({ id: perm.id, field: action, value: !!checked });
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* Custom skills */}
          {customSkills && customSkills.length > 0 && (
            <div className="pt-4 border-t border-border">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Custom Skill Roles</h2>
              {customSkills.map((skill) => (
                <div key={skill.id} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-semibold capitalize text-foreground mb-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-brand/40 text-brand">{skill.name}</Badge>
                    {!skill.is_active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-border">
                        <th className="text-left py-2 font-medium w-40">Module</th>
                        <th className="text-center py-2 font-medium">View</th>
                        <th className="text-center py-2 font-medium">Create</th>
                        <th className="text-center py-2 font-medium">Edit</th>
                        <th className="text-center py-2 font-medium">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod) => {
                        const perm = getSkillPermission(skill.id, mod);
                        if (!perm) return null;
                        return (
                          <tr key={mod} className="border-b border-border/50 last:border-0">
                            <td className="py-2 capitalize font-medium">{mod}</td>
                            {ACTIONS.map((action) => (
                              <td key={action} className="py-2 text-center">
                                <Checkbox
                                  checked={perm[action]}
                                  disabled={updateSkillPerm.isPending}
                                  onCheckedChange={(checked) => {
                                    updateSkillPerm.mutate({ id: perm.id, field: action, value: !!checked });
                                  }}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
