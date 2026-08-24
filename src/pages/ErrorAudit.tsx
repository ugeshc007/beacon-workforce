import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Filter, RefreshCw } from "lucide-react";

type ErrorRow = {
  id: string;
  created_at: string;
  source: string;
  severity: string;
  category: string | null;
  action: string | null;
  error_code: string | null;
  message: string;
  context: Record<string, unknown> | null;
  route: string | null;
  app_version: string | null;
  build_number: string | null;
  platform: string | null;
  user_agent: string | null;
  network_state: string | null;
  employee_id: string | null;
  reviewed: boolean;
  reviewed_at: string | null;
  employees?: { name: string; employee_code: string } | null;
};

const CATEGORIES = ["all", "auth", "punch", "workflow", "site_visit", "daily_log", "sync", "gps", "network", "unknown"];

/** A row is an activity entry (successful action) when the logger tagged it so. */
const isSuccessRow = (r: ErrorRow) => (r.context as any)?.outcome === "success";

export default function ErrorAudit() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [outcome, setOutcome] = useState<"all" | "failure" | "success">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ErrorRow | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["error-logs", category, status, outcome],
    queryFn: async () => {
      let q = (supabase.from("error_logs") as any)
        .select("*, employees:employee_id(name, employee_code)")
        .eq("source", "mobile")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (category !== "all") q = q.eq("category", category);
      if (status === "unreviewed") q = q.eq("reviewed", false);
      if (status === "reviewed") q = q.eq("reviewed", true);
      if (outcome === "success") q = q.eq("severity", "info");
      if (outcome === "failure") q = q.neq("severity", "info");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ErrorRow[];
    },
  });


  // Look up all referenced projects so we can label In-House vs Site.
  const projectIds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      const pid = (r.context as any)?.project_id;
      if (typeof pid === "string") s.add(pid);
    }
    return Array.from(s);
  }, [rows]);

  const { data: projectMap = {} } = useQuery({
    queryKey: ["error-log-projects", projectIds.sort().join(",")],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, site_address, site_latitude, site_longitude")
        .in("id", projectIds);
      if (error) throw error;
      const map: Record<string, { name: string; workType: "In-House" | "Site" }> = {};
      for (const p of data ?? []) {
        const isSite = !!(p.site_address || (p.site_latitude && p.site_longitude));
        map[p.id] = { name: p.name, workType: isSite ? "Site" : "In-House" };
      }
      return map;
    },
  });

  const projectFor = (r: ErrorRow) => {
    const pid = (r.context as any)?.project_id;
    if (typeof pid !== "string") return null;
    return projectMap[pid] ?? null;
  };


  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.message?.toLowerCase().includes(s) ||
        r.action?.toLowerCase().includes(s) ||
        r.employees?.name?.toLowerCase().includes(s) ||
        r.employees?.employee_code?.toLowerCase().includes(s) ||
        r.error_code?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const markReviewed = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await (supabase.from("error_logs") as any)
        .update({ reviewed: true, reviewed_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Marked as reviewed" });
      qc.invalidateQueries({ queryKey: ["error-logs"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const failures = rows.filter((r) => !isSuccessRow(r)).length;
    const successes = total - failures;
    const last24h = rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < 86400000).length;
    return { total, failures, successes, last24h, unreviewed: rows.filter((r) => !r.reviewed).length };
  }, [rows]);

  const severityColor = (s: string) =>
    s === "critical" ? "destructive" : s === "warning" ? "secondary" : s === "info" ? "outline" : "destructive";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" /> Audit — Mobile App Activity
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every action from the field worker app — successful and failed. Kept for 7 days, then removed automatically.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Actions (last 7 days)</div>
          <div className="text-2xl font-semibold mt-1">{stats.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Successful</div>
          <div className="text-2xl font-semibold mt-1 text-green-500">{stats.successes}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Failed</div>
          <div className="text-2xl font-semibold mt-1 text-amber-500">{stats.failures}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Last 24 h</div>
          <div className="text-2xl font-semibold mt-1">{stats.last24h}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Filters:
          </div>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="success">Successful only</SelectItem>
              <SelectItem value="failure">Failed only</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c === "all" ? "All categories" : c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unreviewed">Unreviewed only</SelectItem>
              <SelectItem value="reviewed">Reviewed only</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Search message, action, employee…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {stats.unreviewed > 0 && (
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto"
              onClick={() => markReviewed.mutate(rows.filter((r) => !r.reviewed).map((r) => r.id))}
              disabled={markReviewed.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Mark all reviewed
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Work</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>App</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No activity recorded</TableCell></TableRow>
            ) : (
              filtered.map((r) => {
                const proj = projectFor(r);
                return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(r.created_at), "dd MMM HH:mm")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.employees ? (
                      <div>
                        <div className="font-medium">{r.employees.name}</div>
                        <div className="text-xs text-muted-foreground">{r.employees.employee_code}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {proj ? (
                      <div>
                        <Badge variant={proj.workType === "Site" ? "default" : "secondary"} className="text-[10px]">
                          {proj.workType}
                        </Badge>
                        <div className="text-[11px] text-muted-foreground mt-1 max-w-[140px] truncate">{proj.name}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={severityColor(r.severity) as any}>{r.category ?? "unknown"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">{r.action ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-md truncate">{r.message}</TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    v{r.app_version} · b{r.build_number}
                    <div className="text-[10px]">{r.platform} · {r.network_state}</div>
                  </TableCell>
                  <TableCell>
                    {isSuccessRow(r) ? (
                      <Badge className="text-xs bg-green-500/15 text-green-500 border-green-500/30" variant="outline">
                        Success
                      </Badge>
                    ) : r.reviewed ? (
                      <Badge variant="outline" className="text-xs">Reviewed</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Failed</Badge>
                    )}
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {!r.reviewed && (
                      <Button size="sm" variant="ghost" onClick={() => markReviewed.mutate([r.id])}>
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Error detail</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="When" value={format(new Date(selected.created_at), "dd MMM yyyy HH:mm:ss")} />
                <Field label="Category" value={selected.category ?? "—"} />
                <Field label="Action" value={selected.action ?? "—"} />
                <Field label="Error code" value={selected.error_code ?? "—"} />
                <Field label="Route" value={selected.route ?? "—"} />
                <Field label="Network" value={selected.network_state ?? "—"} />
                <Field label="Platform" value={selected.platform ?? "—"} />
                <Field label="App" value={`v${selected.app_version} · b${selected.build_number}`} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Message</div>
                <div className="p-3 rounded bg-muted text-sm">{selected.message}</div>
              </div>
              {selected.context && Object.keys(selected.context).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Context</div>
                  <pre className="p-3 rounded bg-muted text-xs overflow-x-auto max-h-64">
                    {JSON.stringify(selected.context, null, 2)}
                  </pre>
                </div>
              )}
              {selected.user_agent && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">User agent</div>
                  <div className="text-[11px] text-muted-foreground break-all">{selected.user_agent}</div>
                </div>
              )}
              {!selected.reviewed && (
                <Button
                  className="w-full"
                  onClick={() => {
                    markReviewed.mutate([selected.id]);
                    setSelected(null);
                  }}
                >
                  Mark as reviewed
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
