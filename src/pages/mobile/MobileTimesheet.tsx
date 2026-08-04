import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { Card } from "@/components/ui/card";
import { Loader2, Clock, Calendar, WifiOff } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { formatWorkedMinutes } from "@/lib/timesheet-display";
import { cacheData, getCachedData } from "@/lib/offline-queue";

interface DayLog {
  date: string;
  total_work_minutes: number | null;
  overtime_minutes: number | null;
  regular_cost: number | null;
  overtime_cost: number | null;
  office_punch_in: string | null;
  office_punch_out: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  break_minutes: number | null;
  break_start_time: string | null;
  break_end_time: string | null;
}

const HHMM = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Dubai",
  });

/** Recorded break only — no implicit deduction. */
function recordedBreakMinutes(log: DayLog): number {
  if (log.break_minutes && log.break_minutes > 0) return log.break_minutes;
  if (log.break_start_time && log.break_end_time) {
    const bs = new Date(log.break_start_time).getTime();
    const be = new Date(log.break_end_time).getTime();
    if (be > bs) return Math.round((be - bs) / 60000);
  }
  return 0;
}

/**
 * Duty = Punch Out − Punch In − recorded break.
 * Falls back to work start/end when punch stamps are missing, and to "now"
 * for an open shift today.
 */
function dutyMinutes(log: DayLog, now: Date): number {
  const startIso = log.office_punch_in ?? log.work_start_time;
  if (!startIso) return 0;
  const start = new Date(startIso).getTime();
  const endIso = log.office_punch_out ?? log.work_end_time;
  let end = endIso ? new Date(endIso).getTime() : NaN;
  if (!endIso || Number.isNaN(end) || end <= start) end = now.getTime();
  if (end <= start) return 0;
  const gross = Math.round((end - start) / 60000);
  return Math.max(0, gross - recordedBreakMinutes(log));
}


export default function MobileTimesheet() {
  const { employee } = useMobileAuth();
  const [logs, setLogs] = useState<DayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [fromCache, setFromCache] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!employee) return;
    const cacheKey = `timesheet_${employee.id}_${format(weekStart, "yyyy-MM-dd")}`;

    const fetch = async () => {
      if (!navigator.onLine) {
        const cached = await getCachedData<DayLog[]>(cacheKey);
        if (cached) {
          setLogs(cached.data);
          setFromCache(true);
        }
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("attendance_logs")
          .select("date, total_work_minutes, overtime_minutes, regular_cost, overtime_cost, office_punch_in, office_punch_out, work_start_time, work_end_time")
          .eq("employee_id", employee.id)
          .gte("date", format(weekStart, "yyyy-MM-dd"))
          .lte("date", format(weekEnd, "yyyy-MM-dd"))
          .order("date", { ascending: true });
        if (error) throw error;
        const result = (data as DayLog[]) || [];
        setLogs(result);
        setFromCache(false);
        cacheData(cacheKey, result).catch(() => {});
      } catch {
        const cached = await getCachedData<DayLog[]>(cacheKey);
        if (cached) {
          setLogs(cached.data);
          setFromCache(true);
        }
      } finally {
        setLoading(false);
      }
    };

    fetch();
  }, [employee]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Aggregate multiple logs per day (e.g. site + in-house shifts on same date)
  const dayAgg = new Map<string, { logs: DayLog[]; worked: number; ot: number }>();
  for (const l of logs) {
    const key = l.date;
    if (!dayAgg.has(key)) dayAgg.set(key, { logs: [], worked: 0, ot: 0 });
    const entry = dayAgg.get(key)!;
    entry.logs.push(l);
    entry.worked += getDisplayWorkedMinutes(l, now);
    entry.ot += l.overtime_minutes || 0;
  }

  const totalWorked = Array.from(dayAgg.values()).reduce((s, d) => s + d.worked, 0);
  const totalOT = Array.from(dayAgg.values()).reduce((s, d) => s + d.ot, 0);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-foreground">Timesheet</h1>
        {fromCache && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            Offline (cached)
          </div>
        )}
      </div>

      {/* Weekly summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 border-border/50 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-brand" />
            <span className="text-xs text-muted-foreground">This Week</span>
          </div>
          <p className="text-lg font-bold text-foreground">{formatWorkedMinutes(totalWorked)}</p>
        </Card>
        <Card className="p-4 border-border/50 bg-card">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-muted-foreground">Overtime</span>
          </div>
          <p className="text-lg font-bold text-amber-400">{formatWorkedMinutes(totalOT)}</p>
        </Card>
      </div>

      {/* Daily breakdown */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Daily Breakdown</span>
        </div>

        {weekDays.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const agg = dayAgg.get(dateStr);
          const dayLogs = agg?.logs ?? [];
          const firstLog = dayLogs[0];
          const isToday = dateStr === format(today, "yyyy-MM-dd");
          const isFuture = day > today;
          const displayMinutes = agg?.worked ?? 0;
          const otMinutes = agg?.ot ?? 0;
          const firstPunchIn = dayLogs
            .map((l) => l.office_punch_in)
            .filter(Boolean)
            .sort()[0];
          const lastPunchOut = dayLogs
            .map((l) => l.office_punch_out)
            .filter(Boolean)
            .sort()
            .slice(-1)[0];

          return (
            <Card
              key={dateStr}
              className={`p-3 border-border/50 ${isToday ? "ring-1 ring-brand/50 bg-brand/5" : "bg-card"} ${isFuture ? "opacity-40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {format(day, "EEE, dd MMM")}
                    {isToday && <span className="text-brand text-xs ml-2">Today</span>}
                  </p>
                  {firstPunchIn && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(firstPunchIn).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })}
                      {lastPunchOut && (
                        <> – {new Date(lastPunchOut).toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })}</>
                      )}
                      {dayLogs.length > 1 && (
                        <span className="ml-1 opacity-70">· {dayLogs.length} shifts</span>
                      )}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  {firstLog ? (
                    <>
                      <p className="text-sm font-semibold text-foreground">
                        {formatWorkedMinutes(displayMinutes)}
                      </p>
                      {otMinutes > 0 && (
                        <p className="text-xs text-amber-400">
                          +{formatWorkedMinutes(otMinutes)} OT
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{isFuture ? "—" : "No record"}</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
