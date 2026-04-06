import { useState } from "react";
import { useTravelLogs, type TravelLog } from "@/hooks/useTravel";
import { useProjects } from "@/hooks/useProjects";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import {
  Car, Clock, AlertTriangle, Search, ChevronLeft, ChevronRight,
  MapPin, MapPinOff, Users, Timer,
} from "lucide-react";

const fmt = (ts: string | null) => {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

function todayUAE(): string {
  const now = new Date();
  const uae = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return uae.toISOString().split("T")[0];
}

export default function Travel() {
  const today = todayUAE();
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [delayOnly, setDelayOnly] = useState(false);

  const { data: logs, isLoading } = useTravelLogs({ date, search, projectId, delayOnly });
  const { data: projects } = useProjects({});

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const totalTraveling = logs?.filter((l) => !l.site_arrival_time).length ?? 0;
  const totalArrived = logs?.filter((l) => l.site_arrival_time).length ?? 0;
  const totalDelayed = logs?.filter((l) => l.is_delayed).length ?? 0;
  const avgDuration = (() => {
    const completed = (logs ?? []).filter((l) => l.duration_minutes != null);
    if (!completed.length) return 0;
    return Math.round(completed.reduce((s, l) => s + (l.duration_minutes ?? 0), 0) / completed.length);
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Travel Tracking</h1>
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setDate(today)}>Today</Button>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[140px] h-8 text-xs" />
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Currently Traveling" value={totalTraveling} icon={Car} variant="warning" />
        <StatCard title="Arrived on Site" value={totalArrived} icon={MapPin} variant="success" />
        <StatCard title="Delayed" value={totalDelayed} icon={AlertTriangle} variant="destructive" />
        <StatCard title="Avg Duration" value={`${avgDuration}m`} icon={Timer} variant="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search employee…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            {projects?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Switch id="delay-filter" checked={delayOnly} onCheckedChange={setDelayOnly} />
          <Label htmlFor="delay-filter" className="text-sm">Delays only</Label>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
      ) : !logs?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No travel records for this date</p>
        </div>
      ) : (
        <Card className="glass-card">
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 font-medium">Employee</th>
                    <th className="text-left py-2 font-medium">Project</th>
                    <th className="text-left py-2 font-medium">Travel Start</th>
                    <th className="text-left py-2 font-medium">Site Arrival</th>
                    <th className="text-right py-2 font-medium">Duration</th>
                    <th className="text-left py-2 font-medium">Expected</th>
                    <th className="text-left py-2 font-medium">GPS</th>
                    <th className="text-left py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className={`border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors ${log.is_delayed ? "bg-status-absent/5" : ""}`}>
                      <td className="py-2.5">
                        <span className="font-medium text-foreground">{log.employee_name}</span>
                        <div className="text-[10px] text-muted-foreground">{log.employee_code}</div>
                      </td>
                      <td className="py-2.5 text-muted-foreground text-xs">{log.project_name}</td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {fmt(log.travel_start_time)}
                        {log.travel_start_lat != null && (
                          <div className="text-[9px] text-muted-foreground/60">{log.travel_start_lat.toFixed(4)}, {log.travel_start_lng?.toFixed(4)}</div>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">
                        {log.site_arrival_time ? (
                          <>
                            {fmt(log.site_arrival_time)}
                            {log.site_arrival_lat != null && (
                              <div className="text-[9px] text-muted-foreground/60">{log.site_arrival_lat.toFixed(4)}, {log.site_arrival_lng?.toFixed(4)}</div>
                            )}
                          </>
                        ) : (
                          <Badge className="bg-status-traveling/20 text-status-traveling border-status-traveling/30 text-[9px]">
                            <Car className="h-2.5 w-2.5 mr-1" />In Transit
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right font-mono text-xs">
                        {log.duration_minutes != null ? (
                          <span className={log.is_delayed ? "text-status-absent font-semibold" : "text-foreground"}>{log.duration_minutes}m</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground">{fmt(log.expected_arrival)}</td>
                      <td className="py-2.5">
                        {log.site_arrival_valid === true ? (
                          <MapPin className="h-3.5 w-3.5 text-status-present" />
                        ) : log.site_arrival_valid === false ? (
                          <div className="flex items-center gap-1">
                            <MapPinOff className="h-3.5 w-3.5 text-status-absent" />
                            {log.site_arrival_distance_m != null && (
                              <span className="text-[10px] font-mono text-muted-foreground">{Math.round(log.site_arrival_distance_m)}m</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        {log.is_delayed ? (
                          <Badge className="bg-status-absent/20 text-status-absent border-status-absent/30 text-[9px] gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />Delayed
                          </Badge>
                        ) : log.site_arrival_time ? (
                          <Badge className="bg-status-present/20 text-status-present border-status-present/30 text-[9px]">Arrived</Badge>
                        ) : (
                          <Badge className="bg-status-traveling/20 text-status-traveling border-status-traveling/30 text-[9px]">Traveling</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
