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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2, MapPin, Clock, Bell, Shield, Database, Save, Plus, Pencil,
} from "lucide-react";
import {
  useSettings, useSaveSettings, useBranchList, useCreateBranch, useUpdateBranch,
  type SettingsMap,
} from "@/hooks/useSettings";
import { useRolePermissions, useUpdatePermission } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";

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
function BranchDialog({ branch, onClose }: {
  branch?: { id: string; name: string; city: string | null; address: string | null } | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(branch?.name ?? "");
  const [city, setCity] = useState(branch?.city ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const saving = create.isPending || update.isPending;

  const handleSave = () => {
    if (!name.trim()) return;
    const payload = { name: name.trim(), city: city.trim() || undefined, address: address.trim() || undefined };
    if (branch) {
      update.mutate({ id: branch.id, ...payload }, { onSuccess: onClose });
    } else {
      create.mutate(payload, { onSuccess: onClose });
    }
  };

  return (
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
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { data: settings, isLoading } = useSettings();
  const save = useSaveSettings();
  const { data: branches, isLoading: branchesLoading } = useBranchList();

  const [form, setForm] = useState<SettingsMap>({});
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<typeof branches extends (infer T)[] ? T : never | null>(null);

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

  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="gps">GPS & Location</TabsTrigger>
          <TabsTrigger value="attendance">Work & Overtime</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          {isAdmin && <TabsTrigger value="permissions">Permissions</TabsTrigger>}
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

        {/* ── GPS ─────────────────────────── */}
        <TabsContent value="gps">
          <SectionCard icon={MapPin} title="GPS & Location Thresholds" desc="Control geofence radii, accuracy requirements, and spoof detection."
            onSave={() => saveSection(["gps_office_radius", "gps_site_radius", "gps_accuracy_threshold", "gps_spoof_detection"])} saving={save.isPending}>
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
              <Field label="Spoof Detection">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("gps_spoof_detection")} onCheckedChange={() => toggle("gps_spoof_detection")} />
                  <span className="text-xs text-muted-foreground">{isOn("gps_spoof_detection") ? "Enabled" : "Disabled"}</span>
                </div>
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Attendance / OT ─────────────── */}
        <TabsContent value="attendance">
          <SectionCard icon={Clock} title="Working Hours & Overtime" desc="Define standard hours, OT multiplier, break duration, and travel rules."
            onSave={() => saveSection(["standard_work_hours", "overtime_multiplier", "friday_off", "late_threshold_minutes", "break_duration_minutes", "travel_time_paid"])} saving={save.isPending}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Standard Work Hours / Day">
                <Input type="number" value={form.standard_work_hours ?? "8"} onChange={(e) => set("standard_work_hours", e.target.value)} />
              </Field>
              <Field label="Overtime Multiplier" hint="e.g. 1.5 means 150% of hourly rate.">
                <Input type="number" step="0.1" value={form.overtime_multiplier ?? "1.5"} onChange={(e) => set("overtime_multiplier", e.target.value)} />
              </Field>
              <Field label="Late Threshold (minutes)" hint="Minutes after shift start before marked late.">
                <Input type="number" value={form.late_threshold_minutes ?? "15"} onChange={(e) => set("late_threshold_minutes", e.target.value)} />
              </Field>
              <Field label="Break Duration (minutes)">
                <Input type="number" value={form.break_duration_minutes ?? "60"} onChange={(e) => set("break_duration_minutes", e.target.value)} />
              </Field>
              <Field label="Friday Off">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("friday_off")} onCheckedChange={() => toggle("friday_off")} />
                  <span className="text-xs text-muted-foreground">{isOn("friday_off") ? "Friday is a day off" : "Friday is a work day"}</span>
                </div>
              </Field>
              <Field label="Travel Time Paid">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("travel_time_paid")} onCheckedChange={() => toggle("travel_time_paid")} />
                  <span className="text-xs text-muted-foreground">{isOn("travel_time_paid") ? "Travel hours counted" : "Travel not counted"}</span>
                </div>
              </Field>
            </div>
          </SectionCard>
        </TabsContent>

        {/* ── Notifications ───────────────── */}
        <TabsContent value="notifications">
          <SectionCard icon={Bell} title="Notification Rules" desc="Configure alert timing and thresholds."
            onSave={async () => {
              await saveSection(["notification_morning_briefing", "notification_absent_alert_delay", "notification_ot_warning_hours", "cron_absent_check_time"]);
              // Update the cron schedule if time changed
              const timeVal = form.cron_absent_check_time;
              if (timeVal && /^\d{2}:\d{2}$/.test(timeVal)) {
                try {
                  const { supabase } = await import("@/integrations/supabase/client");
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = sessionData?.session?.access_token;
                  if (token) {
                    await supabase.functions.invoke("update-cron-schedule", {
                      body: { time_uae: timeVal },
                    });
                  }
                } catch (err) {
                  console.error("Failed to update cron schedule:", err);
                }
              }
            }} saving={save.isPending}>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Morning Briefing">
                <div className="flex items-center gap-2 pt-1">
                  <Switch checked={isOn("notification_morning_briefing")} onCheckedChange={() => toggle("notification_morning_briefing")} />
                  <span className="text-xs text-muted-foreground">{isOn("notification_morning_briefing") ? "Enabled" : "Disabled"}</span>
                </div>
              </Field>
              <Field label="Absent Check Time (UAE)" hint="Daily time to run absence check and notify managers. 24h format HH:MM.">
                <Input type="time" value={form.cron_absent_check_time ?? "09:00"} onChange={(e) => set("cron_absent_check_time", e.target.value)} />
              </Field>
              <Field label="Absent Alert Delay (min)" hint="Minutes after shift start to send absence alerts.">
                <Input type="number" value={form.notification_absent_alert_delay ?? "30"} onChange={(e) => set("notification_absent_alert_delay", e.target.value)} />
              </Field>
              <Field label="OT Warning Threshold (hours)" hint="Alert when employee exceeds this OT in a month.">
                <Input type="number" value={form.notification_ot_warning_hours ?? "20"} onChange={(e) => set("notification_ot_warning_hours", e.target.value)} />
              </Field>
            </div>
          </SectionCard>
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
              <Dialog open={branchDialogOpen} onOpenChange={(open) => { setBranchDialogOpen(open); if (!open) setEditingBranch(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" onClick={() => { setEditingBranch(null); setBranchDialogOpen(true); }}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Branch
                  </Button>
                </DialogTrigger>
                <BranchDialog branch={editingBranch} onClose={() => setBranchDialogOpen(false)} />
              </Dialog>
            </CardHeader>
            <CardContent>
              {branchesLoading ? (
                <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
              ) : !branches?.length ? (
                <p className="text-sm text-muted-foreground text-center py-6">No branches created yet.</p>
              ) : (
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
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
                        <Dialog open={branchDialogOpen && editingBranch?.id === b.id} onOpenChange={(open) => { setBranchDialogOpen(open); if (!open) setEditingBranch(null); }}>
                          <DialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingBranch(b); setBranchDialogOpen(true); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <BranchDialog branch={editingBranch} onClose={() => setBranchDialogOpen(false)} />
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Permissions ─────────────────── */}
        {isAdmin && (
          <TabsContent value="permissions">
            <PermissionMatrix />
          </TabsContent>
        )}

        {/* ── System ──────────────────────── */}
        <TabsContent value="system">
          <SectionCard icon={Database} title="System Information" desc="Platform details and diagnostics.">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Platform</p>
                <p className="text-sm font-medium text-foreground mt-0.5">BeBright Planner v1.0</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Backend</p>
                <p className="text-sm font-medium text-foreground mt-0.5">Lovable Cloud</p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Permission Matrix ──────────────────────────────────────
const MODULES = ["dashboard", "projects", "employees", "schedule", "attendance", "timesheets", "reports", "settings"];
const ACTIONS = ["can_view", "can_create", "can_edit", "can_delete"] as const;
const ROLES = ["admin", "manager", "supervisor"];

function PermissionMatrix() {
  const { data: permissions, isLoading } = useRolePermissions();
  const updatePerm = useUpdatePermission();

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />;

  const getPermission = (role: string, module: string) =>
    permissions?.find((p) => p.role === role && p.module === module);

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand" /> Permission Matrix
        </CardTitle>
        <CardDescription className="text-xs">Configure what each role can do per module. Changes take effect immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {ROLES.map((role) => (
            <div key={role} className="mb-6 last:mb-0">
              <h3 className="text-sm font-semibold capitalize text-foreground mb-3 flex items-center gap-2">
                <Badge variant={role === "admin" ? "default" : "outline"} className="text-[10px]">{role}</Badge>
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
        </div>
      </CardContent>
    </Card>
  );
}
