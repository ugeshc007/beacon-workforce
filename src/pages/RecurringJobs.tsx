import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Repeat, Plus, Play, Pause, StopCircle, RefreshCw, Trash2,
  MoreVertical, Calendar, Users as UsersIcon,
} from "lucide-react";
import { useEmployees } from "@/hooks/useEmployees";

type Frequency = "daily" | "weekly" | "monthly" | "custom";
type Status = "active" | "paused" | "ended";

interface RecurringJob {
  id: string;
  client_name: string;
  site_name: string | null;
  address: string | null;
  frequency: Frequency;
  days_of_week: number[] | null;
  day_of_month: number | null;
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  headcount: number;
  status: Status;
  notes: string | null;
  color: string | null;
  skip_holidays: boolean;
  project_id: string | null;
  recurring_job_employees?: { employee_id: string; employees?: { name: string } | null }[];
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function frequencyLabel(j: RecurringJob): string {
  const t = `${j.start_time.slice(0, 5)}–${j.end_time.slice(0, 5)}`;
  switch (j.frequency) {
    case "daily": return `Daily · ${t}`;
    case "weekly":
    case "custom": {
      const days = (j.days_of_week ?? []).slice().sort().map((d) => WEEKDAYS[d]).join("/");
      return `${days || "—"} · ${t}`;
    }
    case "monthly": return `Day ${j.day_of_month ?? "?"} of month · ${t}`;
  }
}

function statusBadge(s: Status) {
  const map = {
    active: "bg-status-present/15 text-status-present border-status-present/30",
    paused: "bg-status-traveling/15 text-status-traveling border-status-traveling/30",
    ended: "bg-muted text-muted-foreground border-border",
  };
  return <Badge variant="outline" className={map[s]}>{s}</Badge>;
}

function useRecurringJobs() {
  return useQuery({
    queryKey: ["recurring_jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_jobs" as any)
        .select("*, recurring_job_employees(employee_id, employees(name))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RecurringJob[];
    },
  });
}

export default function RecurringJobs() {
  const { data: jobs, isLoading } = useRecurringJobs();
  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<RecurringJob | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("recurring_jobs" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_jobs"] }),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("recurring_jobs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["recurring_jobs"] }),
  });

  const generateNow = useMutation({
    mutationFn: async (id?: string) => {
      const { data, error } = await supabase.functions.invoke("generate-recurring-occurrences", {
        body: id ? { recurring_job_id: id, days_ahead: 14 } : { days_ahead: 14 },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Schedule generated",
        description: `Created ${data?.generated ?? 0} assignment(s) over the next ${data?.days_ahead ?? 14} days.`,
      });
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (e: any) => toast({ title: "Failed to generate", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Repeat className="h-6 w-6 text-brand" /> Recurring Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up repeating cleaning shifts that auto-generate in the Schedule.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => generateNow.mutate(undefined)} disabled={generateNow.isPending} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${generateNow.isPending ? "animate-spin" : ""}`} /> Generate now
          </Button>
          <Button onClick={() => { setEditJob(null); setOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Recurring Job
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : !jobs?.length ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">
          No recurring jobs yet. Create one to auto-schedule your weekly cleaning shifts.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {jobs.map((j) => (
            <Card key={j.id} className="overflow-hidden">
              <CardContent className="p-4 flex flex-wrap items-start gap-4">
                <div className="h-10 w-1 rounded" style={{ backgroundColor: j.color ?? "#0EA5E9" }} />
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{j.client_name}</h3>
                    {j.site_name && <span className="text-sm text-muted-foreground">· {j.site_name}</span>}
                    {statusBadge(j.status)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{frequencyLabel(j)}</span>
                    <span className="flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" />
                      {j.recurring_job_employees?.length ?? 0} crew
                    </span>
                    {j.address && <span className="truncate max-w-[300px]">📍 {j.address}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditJob(j); setOpen(true); }}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => generateNow.mutate(j.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" /> Generate next 14 days
                    </DropdownMenuItem>
                    {j.status === "active" ? (
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: j.id, status: "paused" })}>
                        <Pause className="h-4 w-4 mr-2" /> Pause
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => updateStatus.mutate({ id: j.id, status: "active" })}>
                        <Play className="h-4 w-4 mr-2" /> Resume
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => updateStatus.mutate({ id: j.id, status: "ended" })}>
                      <StopCircle className="h-4 w-4 mr-2" /> End
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => {
                        if (confirm("Delete this recurring job? Existing scheduled assignments stay.")) deleteJob.mutate(j.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <RecurringJobDialog open={open} onOpenChange={setOpen} job={editJob} />
    </div>
  );
}

function RecurringJobDialog({
  open, onOpenChange, job,
}: { open: boolean; onOpenChange: (v: boolean) => void; job: RecurringJob | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: empData } = useEmployees({ status: "active", pageSize: 500 });
  const employees = (empData as any)?.data ?? (empData as any) ?? [];

  const [clientName, setClientName] = useState(job?.client_name ?? "");
  const [siteName, setSiteName] = useState(job?.site_name ?? "");
  const [address, setAddress] = useState(job?.address ?? "");
  const [frequency, setFrequency] = useState<Frequency>(job?.frequency ?? "weekly");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(job?.days_of_week ?? [1, 3, 5]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(job?.day_of_month ?? 1);
  const [startTime, setStartTime] = useState(job?.start_time?.slice(0, 5) ?? "08:00");
  const [endTime, setEndTime] = useState(job?.end_time?.slice(0, 5) ?? "12:00");
  const [startDate, setStartDate] = useState(job?.start_date ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(job?.end_date ?? "");
  const [headcount, setHeadcount] = useState(job?.headcount ?? 1);
  const [color, setColor] = useState(job?.color ?? "#0EA5E9");
  const [skipHolidays, setSkipHolidays] = useState(job?.skip_holidays ?? true);
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [crewIds, setCrewIds] = useState<string[]>(
    job?.recurring_job_employees?.map((e) => e.employee_id) ?? [],
  );

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort());
  const toggleCrew = (id: string) =>
    setCrewIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        client_name: clientName.trim(),
        site_name: siteName.trim() || null,
        address: address.trim() || null,
        frequency,
        days_of_week: frequency === "monthly" ? [] : daysOfWeek,
        day_of_month: frequency === "monthly" ? dayOfMonth : null,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate,
        end_date: endDate || null,
        headcount,
        color,
        skip_holidays: skipHolidays,
        notes: notes.trim() || null,
      };

      let jobId = job?.id;
      if (jobId) {
        const { error } = await supabase.from("recurring_jobs" as any).update(payload).eq("id", jobId);
        if (error) throw error;
        // Reset crew
        await supabase.from("recurring_job_employees" as any).delete().eq("recurring_job_id", jobId);
      } else {
        const { data, error } = await supabase
          .from("recurring_jobs" as any)
          .insert(payload).select("id").single();
        if (error) throw error;
        jobId = (data as any).id;
      }
      if (crewIds.length) {
        const rows = crewIds.map((eid) => ({ recurring_job_id: jobId, employee_id: eid }));
        const { error } = await supabase.from("recurring_job_employees" as any).insert(rows);
        if (error) throw error;
      }
      return jobId;
    },
    onSuccess: () => {
      toast({ title: job ? "Recurring job updated" : "Recurring job created" });
      qc.invalidateQueries({ queryKey: ["recurring_jobs"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const canSave = clientName.trim().length > 0 && crewIds.length > 0 &&
    (frequency !== "weekly" && frequency !== "custom" ? true : daysOfWeek.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{job ? "Edit Recurring Job" : "New Recurring Job"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Client *</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. ADCB Tower" /></div>
            <div><Label>Site / location</Label><Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="e.g. Lobby + 3 floors" /></div>
          </div>
          <div><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom (pick days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Crew size (target)</Label><Input type="number" min={1} value={headcount} onChange={(e) => setHeadcount(parseInt(e.target.value || "1"))} /></div>
          </div>

          {(frequency === "weekly" || frequency === "custom") && (
            <div>
              <Label>Days of week</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {WEEKDAYS.map((d, idx) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1.5 rounded-md border text-sm transition ${
                      daysOfWeek.includes(idx)
                        ? "bg-brand text-brand-foreground border-brand"
                        : "bg-card border-border hover:bg-muted"
                    }`}
                  >{d}</button>
                ))}
              </div>
            </div>
          )}

          {frequency === "monthly" && (
            <div><Label>Day of month (1-31)</Label><Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(parseInt(e.target.value || "1"))} /></div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
            <div><Label>End date (optional)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="skipHol" checked={skipHolidays} onCheckedChange={(v) => setSkipHolidays(!!v)} />
            <Label htmlFor="skipHol" className="cursor-pointer">Skip public holidays</Label>
            <div className="ml-auto flex items-center gap-2">
              <Label>Color</Label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border border-border bg-transparent" />
            </div>
          </div>

          <div>
            <Label>Crew * ({crewIds.length} selected)</Label>
            <div className="border border-border rounded-md max-h-48 overflow-y-auto mt-1 p-2 grid grid-cols-2 gap-1">
              {employees.map((e: any) => (
                <label key={e.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
                  <Checkbox checked={crewIds.includes(e.id)} onCheckedChange={() => toggleCrew(e.id)} />
                  <span className="truncate">{e.name}</span>
                </label>
              ))}
              {!employees.length && <div className="text-sm text-muted-foreground p-2">No employees found</div>}
            </div>
          </div>

          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? "Saving…" : (job ? "Save changes" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
