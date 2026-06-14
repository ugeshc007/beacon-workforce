import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Building2, Globe, Power, Upload, Check, ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  currency: string;
  timezone: string;
  plan: string;
  is_active: boolean;
  contact_email: string | null;
  created_at: string;
}

const ALL_MODULES = [
  { id: "dashboard", label: "Dashboard", required: true },
  { id: "projects", label: "Projects" },
  { id: "maintenance", label: "Maintenance" },
  { id: "site_visits", label: "Site Visits" },
  { id: "employees", label: "Employees", required: true },
  { id: "schedule", label: "Schedule" },
  { id: "attendance", label: "Attendance" },
  { id: "travel", label: "Travel & GPS" },
  { id: "timesheets", label: "Timesheets" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings", required: true },
];

const PLANS = [
  { id: "starter", name: "Starter", desc: "Up to 25 employees" },
  { id: "standard", name: "Standard", desc: "Up to 100 employees" },
  { id: "enterprise", name: "Enterprise", desc: "Unlimited + SLA" },
];

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("companies").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Companies</h1>
          <p className="text-slate-400 text-sm mt-1">Tenants on the platform. Each is fully isolated.</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="bg-sky-500 hover:bg-sky-400 text-slate-950">
          <Plus className="h-4 w-4 mr-2" /> New Company
        </Button>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-slate-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Company</th>
              <th className="text-left px-4 py-3">Slug</th>
              <th className="text-left px-4 py-3">Domain</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {companies?.map((c) => (
              <tr key={c.id} className="hover:bg-slate-900/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.logo_url ? (
                      <img src={c.logo_url} alt={c.name} className="h-8 w-8 rounded-md object-cover bg-slate-800" />
                    ) : (
                      <div className="h-8 w-8 rounded-md grid place-items-center" style={{ background: c.primary_color ?? "#0EA5E9" }}>
                        <Building2 className="h-4 w-4 text-slate-950" />
                      </div>
                    )}
                    <div>
                      <div className="text-white">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.contact_email ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {c.domain ? (<span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> {c.domain}</span>) : "—"}
                </td>
                <td className="px-4 py-3"><Badge variant="outline" className="border-slate-700 text-slate-300 capitalize">{c.plan}</Badge></td>
                <td className="px-4 py-3">
                  {c.is_active
                    ? <Badge className="bg-emerald-500/15 text-emerald-300 border-0">Active</Badge>
                    : <Badge className="bg-slate-700/40 text-slate-400 border-0">Suspended</Badge>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate({ id: c.id, is_active: !c.is_active })}>
                    <Power className="h-4 w-4 mr-1" /> {c.is_active ? "Suspend" : "Activate"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <OnboardingWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={() => { qc.invalidateQueries({ queryKey: ["admin-companies"] }); setWizardOpen(false); }}
      />
    </div>
  );
}

// ---------------- Wizard ----------------

interface WizardState {
  name: string;
  slug: string;
  domain: string;
  contact_email: string;
  contact_phone: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  logo_file: File | null;
  currency: string;
  timezone: string;
  locale: string;
  plan: string;
  modules: string[];
  admin_email: string;
  admin_name: string;
  branch_name: string;
}

const initialState: WizardState = {
  name: "", slug: "", domain: "",
  contact_email: "", contact_phone: "",
  primary_color: "#0EA5E9", accent_color: "#0F172A",
  logo_url: null, logo_file: null,
  currency: "AED", timezone: "Asia/Dubai", locale: "en",
  plan: "standard",
  modules: ALL_MODULES.map((m) => m.id),
  admin_email: "", admin_name: "", branch_name: "",
};

const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

function OnboardingWizard({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reset = () => { setStep(0); setState(initialState); };

  const update = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const handleLogo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${state.slug || "pending"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      update("logo_url", data.publicUrl);
      update("logo_file", file);
      toast.success("Logo uploaded");
    } catch (e: any) {
      toast.error(e.message ?? "Logo upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("provision-company", {
        body: {
          name: state.name,
          slug: state.slug,
          domain: state.domain || null,
          contact_email: state.contact_email || state.admin_email,
          contact_phone: state.contact_phone || null,
          primary_color: state.primary_color,
          accent_color: state.accent_color,
          logo_url: state.logo_url,
          currency: state.currency,
          timezone: state.timezone,
          locale: state.locale,
          plan: state.plan,
          modules: state.modules,
          admin_email: state.admin_email,
          admin_name: state.admin_name,
          branch_name: state.branch_name || `${state.name} HQ`,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Company provisioned" + ((data as any)?.email_sent ? " — invite emailed" : ""));
      reset();
      onCreated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to provision");
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ["Basics", "Branding", "Locale & Plan", "Modules", "Admin"];
  const canNext = () => {
    if (step === 0) return state.name.length > 1 && /^[a-z0-9][a-z0-9-]{1,40}$/.test(state.slug);
    if (step === 4) return /.+@.+\..+/.test(state.admin_email);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-sky-400" /> New company — {steps[step]}
          </DialogTitle>
        </DialogHeader>

        {/* stepper */}
        <div className="flex items-center gap-2 mb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-semibold ${i < step ? "bg-emerald-500/20 text-emerald-300" : i === step ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-500"}`}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-emerald-500/40" : "bg-slate-800"}`} />}
            </div>
          ))}
        </div>

        <div className="min-h-[280px]">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Company name</Label>
                  <Input value={state.name}
                    onChange={(e) => { update("name", e.target.value); if (!state.slug) update("slug", slugify(e.target.value)); }}
                    className="bg-slate-950 border-slate-800" placeholder="Acme Lighting" />
                </div>
                <div>
                  <Label className="text-slate-400">Slug</Label>
                  <Input value={state.slug} onChange={(e) => update("slug", slugify(e.target.value))}
                    className="bg-slate-950 border-slate-800 font-mono text-xs" placeholder="acme" />
                  <p className="text-[11px] text-slate-500 mt-1">{state.slug || "acme"}.planner.bebright.global</p>
                </div>
              </div>
              <div>
                <Label className="text-slate-400">Custom domain (optional)</Label>
                <Input value={state.domain} onChange={(e) => update("domain", e.target.value.toLowerCase())}
                  placeholder="planner.acme.com" className="bg-slate-950 border-slate-800" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Contact email</Label>
                  <Input type="email" value={state.contact_email} onChange={(e) => update("contact_email", e.target.value)}
                    className="bg-slate-950 border-slate-800" placeholder="ops@acme.com" />
                </div>
                <div>
                  <Label className="text-slate-400">Contact phone</Label>
                  <Input value={state.contact_phone} onChange={(e) => update("contact_phone", e.target.value)}
                    className="bg-slate-950 border-slate-800" placeholder="+971..." />
                </div>
              </div>
              <div>
                <Label className="text-slate-400">Primary branch name</Label>
                <Input value={state.branch_name} onChange={(e) => update("branch_name", e.target.value)}
                  className="bg-slate-950 border-slate-800" placeholder={`${state.name || "Acme"} HQ`} />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label className="text-slate-400">Logo</Label>
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-20 w-20 rounded-lg border border-dashed border-slate-700 grid place-items-center overflow-hidden bg-slate-950">
                    {state.logo_url ? (
                      <img src={state.logo_url} alt="logo" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-7 w-7 text-slate-600" />
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-700 hover:bg-slate-800 cursor-pointer text-sm">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Uploading…" : "Upload logo"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogo(f); }} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-400">Primary color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input type="color" value={state.primary_color} onChange={(e) => update("primary_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 w-14 h-9 p-1" />
                    <Input value={state.primary_color} onChange={(e) => update("primary_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-400">Accent color</Label>
                  <div className="flex gap-2 items-center mt-1">
                    <Input type="color" value={state.accent_color} onChange={(e) => update("accent_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 w-14 h-9 p-1" />
                    <Input value={state.accent_color} onChange={(e) => update("accent_color", e.target.value)}
                      className="bg-slate-950 border-slate-800 font-mono text-xs" />
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-4 border border-slate-800" style={{ background: state.accent_color }}>
                <div className="flex items-center gap-3">
                  {state.logo_url
                    ? <img src={state.logo_url} alt="" className="h-9 w-9 rounded object-contain bg-white/10" />
                    : <div className="h-9 w-9 rounded" style={{ background: state.primary_color }} />}
                  <div>
                    <div className="text-white font-semibold">{state.name || "Company name"}</div>
                    <div className="text-xs" style={{ color: state.primary_color }}>Login preview</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-slate-400">Currency</Label>
                  <Select value={state.currency} onValueChange={(v) => update("currency", v)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["AED","SAR","USD","EUR","GBP","INR","PKR"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Timezone</Label>
                  <Select value={state.timezone} onValueChange={(v) => update("timezone", v)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Asia/Dubai","Asia/Riyadh","Asia/Karachi","Asia/Kolkata","Europe/London","UTC"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-slate-400">Locale</Label>
                  <Select value={state.locale} onValueChange={(v) => update("locale", v)}>
                    <SelectTrigger className="bg-slate-950 border-slate-800"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["en","ar","ur","hi"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-slate-400 mb-2 block">Plan</Label>
                <div className="grid grid-cols-3 gap-3">
                  {PLANS.map((p) => (
                    <button key={p.id} type="button" onClick={() => update("plan", p.id)}
                      className={`rounded-lg border p-3 text-left transition ${state.plan === p.id ? "border-sky-500 bg-sky-500/10" : "border-slate-800 hover:border-slate-700"}`}>
                      <div className="text-white font-medium">{p.name}</div>
                      <div className="text-xs text-slate-400 mt-1">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <p className="text-sm text-slate-400 mb-3">Choose which modules this tenant can access.</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_MODULES.map((m) => {
                  const checked = state.modules.includes(m.id);
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
                      <div>
                        <div className="text-sm text-white">{m.label}</div>
                        {m.required && <div className="text-[10px] text-slate-500">required</div>}
                      </div>
                      <Switch
                        checked={checked}
                        disabled={m.required}
                        onCheckedChange={(v) => {
                          if (v) update("modules", Array.from(new Set([...state.modules, m.id])));
                          else update("modules", state.modules.filter((x) => x !== m.id));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">We'll create an admin account and email them an invite to set their password.</p>
              <div>
                <Label className="text-slate-400">Admin full name</Label>
                <Input value={state.admin_name} onChange={(e) => update("admin_name", e.target.value)}
                  className="bg-slate-950 border-slate-800" placeholder="Jane Doe" />
              </div>
              <div>
                <Label className="text-slate-400">Admin email</Label>
                <Input type="email" value={state.admin_email} onChange={(e) => update("admin_email", e.target.value)}
                  className="bg-slate-950 border-slate-800" placeholder="admin@acme.com" />
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
                <div className="flex items-center gap-2 text-slate-300 mb-1"><Mail className="h-3.5 w-3.5" /> What happens on submit</div>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Tenant <b className="text-slate-200">{state.name || "—"}</b> is created at <span className="font-mono">{state.slug}.planner.bebright.global</span></li>
                  <li>{state.modules.length} modules enabled · {state.plan} plan</li>
                  <li>Admin account created for <b className="text-slate-200">{state.admin_email || "—"}</b> with invite email</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-4">
          <Button variant="ghost" onClick={() => step === 0 ? onOpenChange(false) : setStep(step - 1)} disabled={submitting}>
            <ArrowLeft className="h-4 w-4 mr-1" /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < steps.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()} className="bg-sky-500 hover:bg-sky-400 text-slate-950">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={!canNext() || submitting} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950">
              {submitting ? "Provisioning…" : "Create company & send invite"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
