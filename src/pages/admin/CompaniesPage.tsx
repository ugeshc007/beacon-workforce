import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Building2, Globe, Power } from "lucide-react";
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

export default function CompaniesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: Partial<Company> & { admin_email?: string }) => {
      const { admin_email, ...payload } = input;
      const { data, error } = await supabase
        .from("companies")
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      // Seed all module features = enabled
      const modules = ["dashboard","projects","maintenance","site_visits","employees","schedule","attendance","travel","timesheets","reports","settings"];
      await supabase.from("company_features").insert(
        modules.map((m) => ({ company_id: data.id, module: m, enabled: true }))
      );
      return data;
    },
    onSuccess: () => {
      toast.success("Company created");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-sky-500 hover:bg-sky-400 text-slate-950"><Plus className="h-4 w-4 mr-2" /> New Company</Button>
          </DialogTrigger>
          <CreateCompanyDialog onSubmit={(v) => createMut.mutate(v)} pending={createMut.isPending} />
        </Dialog>
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
                    <div className="h-8 w-8 rounded-md grid place-items-center" style={{ background: c.primary_color ?? "#0EA5E9" }}>
                      <Building2 className="h-4 w-4 text-slate-950" />
                    </div>
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
                <td className="px-4 py-3"><Badge variant="outline" className="border-slate-700 text-slate-300">{c.plan}</Badge></td>
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
    </div>
  );
}

function CreateCompanyDialog({ onSubmit, pending }: { onSubmit: (v: any) => void; pending: boolean }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [domain, setDomain] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0EA5E9");
  const [accentColor, setAccentColor] = useState("#0F172A");
  const [currency, setCurrency] = useState("AED");
  const [timezone, setTimezone] = useState("Asia/Dubai");
  const [isActive, setIsActive] = useState(true);

  const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  return (
    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg">
      <DialogHeader><DialogTitle>Create new company</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-400">Company name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} className="bg-slate-950 border-slate-800" />
          </div>
          <div>
            <Label className="text-slate-400">Slug (URL)</Label>
            <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} className="bg-slate-950 border-slate-800 font-mono text-xs" />
          </div>
        </div>
        <div>
          <Label className="text-slate-400">Custom domain (optional)</Label>
          <Input value={domain} onChange={(e) => setDomain(e.target.value.toLowerCase())} placeholder="planner.acme.com" className="bg-slate-950 border-slate-800" />
        </div>
        <div>
          <Label className="text-slate-400">Contact email</Label>
          <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="bg-slate-950 border-slate-800" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-400">Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className="bg-slate-950 border-slate-800" />
          </div>
          <div>
            <Label className="text-slate-400">Timezone</Label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="bg-slate-950 border-slate-800" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-slate-400">Primary color</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="bg-slate-950 border-slate-800 w-14 h-9 p-1" />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="bg-slate-950 border-slate-800 font-mono text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-slate-400">Accent color</Label>
            <div className="flex gap-2 items-center">
              <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="bg-slate-950 border-slate-800 w-14 h-9 p-1" />
              <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="bg-slate-950 border-slate-800 font-mono text-xs" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Label className="text-slate-300">Active</Label>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name || !slug}
          onClick={() => onSubmit({
            name, slug,
            domain: domain || null,
            contact_email: contactEmail || null,
            primary_color: primaryColor,
            accent_color: accentColor,
            currency, timezone,
            is_active: isActive,
          })}
          className="bg-sky-500 hover:bg-sky-400 text-slate-950"
        >
          {pending ? "Creating…" : "Create company"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
