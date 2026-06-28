import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useTodayProjects } from "@/hooks/useTodayProjects";
import { useUpcomingProjects } from "@/hooks/useUpcomingProjects";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { actionLabels, stepLabels, stepColors, WorkflowAction } from "@/lib/workflow-engine";
import { projectStepLabels, projectStepColors } from "@/lib/project-workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { initAutoSync } from "@/lib/offline-sync";
import { getCachedData } from "@/lib/offline-queue";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";

import { DriverWorkflowCard } from "@/components/mobile/DriverWorkflowCard";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Clock, Wifi, WifiOff, CheckCircle2, AlertTriangle, Crosshair, ChevronRight, PlayCircle, RotateCcw, Coffee, Building2, ClipboardList, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const GPS_ACTIONS: WorkflowAction[] = ["punch_in", "punch_out", "start_return_travel", "arrive_office"];

export default function MobileHome() {
  const { employee } = useMobileAuth();
  const navigate = useNavigate();
  const { step, attendanceLog, availableActions, loading, actionLoading, executeAction } = useMobileWorkflow();
  const { data: todayProjects, isLoading: projectsLoading } = useTodayProjects();
  const { data: upcomingProjects } = useUpcomingProjects(7);
  const { startTracking, stopTracking } = useBackgroundTracking();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gpsQuality, setGpsQuality] = useState<"high" | "medium" | "low" | "none">("none");
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const autoSyncCleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    autoSyncCleanup.current = initAutoSync();
    return () => autoSyncCleanup.current?.();
  }, []);

  // Read the cached snapshot timestamp so we can show "last sync at ..." offline
  useEffect(() => {
    if (!employee) return;
    const today = new Date().toISOString().slice(0, 10);
    getCachedData<unknown>(`today_projects_${employee.id}_${today}`).then((c) => {
      if (c?.cachedAt) setLastSyncAt(new Date(c.cachedAt));
    });
  }, [employee, todayProjects]);

  // Keep GPS background tracking running while any project session is in travel
  const hasActiveTravel = (todayProjects ?? []).some((p) => p.step === "traveling");
  useEffect(() => {
    if (hasActiveTravel && employee && attendanceLog) {
      startTracking(employee.id, attendanceLog.id);
    } else {
      stopTracking();
    }
    return () => { stopTracking(); };
  }, [hasActiveTravel, employee, attendanceLog, startTracking, stopTracking]);

  // Auto-jump into the workflow if there's already an active project session
  useEffect(() => {
    if (!todayProjects) return;
    const active = todayProjects.find((p) => p.sessionId && p.step !== "completed");
    if (active) {
      // Don't auto-redirect if user just landed; only redirect on initial mount when active exists
      // (user can navigate back manually)
    }
  }, [todayProjects]);

  // Read company-wide GPS-required toggle. Default = true (require GPS).
  const { data: gpsRequired = true } = useQuery({
    queryKey: ["setting", "gps_required_on_punch"],
    queryFn: async () => {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "gps_required_on_punch")
        .maybeSingle();
      return (data?.value ?? "true") !== "false";
    },
    staleTime: 60_000,
  });

  const handleOfficeAction = async (action: WorkflowAction) => {
    let payload: Record<string, unknown> = {};
    if (GPS_ACTIONS.includes(action)) {
      const gps = await getGpsPosition();
      setGpsQuality(gps.quality);
      if (gps.reading) {
        payload = {
          lat: gps.reading.lat,
          lng: gps.reading.lng,
          accuracy: gps.reading.accuracy,
          is_spoofed: gps.reading.isMock,
        };
      }
      // GPS is best-effort: when it fails (timeout, denied, etc.) the action still
      // proceeds without coordinates. Server-side validation can enforce if needed.
    }
    await submitAction(action, payload);
  };

  const submitAction = async (action: WorkflowAction, payload: Record<string, unknown>) => {
    if (!employee) return;
    const result = await executeAction(action, payload);
    if (!result?.success) {
      toast({ title: "Failed", description: result?.error || "Something went wrong.", variant: "destructive" });
    }
  };

  // Detect a stale shift: the open attendance log's date is before today.
  // Keep this query before any early return so React hook order stays stable.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const isStaleShift = !!attendanceLog?.date && attendanceLog.date < todayStr && !attendanceLog.office_punch_out;
  const staleShiftLabel = attendanceLog?.date
    ? new Date(attendanceLog.date + "T00:00:00").toLocaleDateString("en-AE", { weekday: "short", day: "2-digit", month: "short" })
    : "";

  // Find an open project session tied to the stale shift so the user can finish it.
  const { data: staleProjectSession } = useQuery({
    queryKey: ["stale-project-session", employee?.id, attendanceLog?.id],
    enabled: !!employee && !!attendanceLog && isStaleShift,
    queryFn: async () => {
      // Try by attendance_log_id first
      let { data } = await supabase
        .from("project_work_sessions")
        .select("id, project_id, work_end_time, projects(name)")
        .eq("attendance_log_id", attendanceLog!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // Fallback: find any open session for this employee on the stale date
      if (!data && employee && attendanceLog?.date) {
        const res = await supabase
          .from("project_work_sessions")
          .select("id, project_id, work_end_time, projects(name)")
          .eq("employee_id", employee.id)
          .eq("date", attendanceLog.date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        data = res.data;
      }
      return data as { id: string; project_id: string; work_end_time: string | null; projects: { name: string } | null } | null;
    },
  });

  const openStaleShift = () => {
    if (staleProjectSession?.project_id && attendanceLog?.date) {
      navigate(`/m/project/${staleProjectSession.project_id}?date=${attendanceLog.date}`);
      return;
    }
    navigate("/m/timesheet");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Office only allows punch_in (when idle) and punch_out (when at_office or after all projects done).
  // We hide intermediate site-flow buttons since per-project flow now handles travel/work.
  const officeAction = availableActions.find((a) => a === "punch_in" || a === "punch_out");

  // Determine if we should suggest punch out: all assigned projects completed
  const allProjectsDone = (todayProjects?.length ?? 0) > 0
    && todayProjects!.every((p) => p.step === "completed");

  const timeStr = currentTime.toLocaleTimeString("en-AE", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai",
  });

  // Single-project shortcut: if punched in and only one assignment, jump in
  const singleProject = (todayProjects?.length === 1) ? todayProjects[0] : null;

  // Resume shortcut — find any in-progress session restored from DB
  const activeProject = (todayProjects ?? []).find(
    (p) => p.sessionId && p.step !== "completed" && p.step !== "idle"
  );

  // Driver mode — when ALL today assignments are driver role, swap in the driver workflow
  const isDriverDay = !!todayProjects?.length && todayProjects.every((p) => p.assignedRole === "driver");

  // If every project assigned today is in-house, the employee never left the office,
  // so we skip the "Start Return Travel" → "Arrive Office" steps and offer Punch Out directly.
  const allInHouseDay = !!todayProjects?.length && todayProjects.every((p) => p.workLocation === "in_house");

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 safe-area-inset" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
      {/* Offline banner — shown when device has no network */}
      {!isOnline && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
          <WifiOff className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">You're offline</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {lastSyncAt
                ? `Showing last sync from ${lastSyncAt.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" })}. `
                : "Showing cached data. "}
              Actions will sync when you reconnect.
            </p>
          </div>
        </div>
      )}

      {/* Stale shift banner — open attendance log from a previous day (night shift crossed midnight) */}
      {isStaleShift && (
        <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-3 py-3 space-y-2">
          <button
            type="button"
            onClick={openStaleShift}
            className="w-full text-left flex items-start gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500/60"
          >
            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                Unfinished shift from {staleShiftLabel}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                You're still punched in from a previous day. Finish the workflow below to close it.
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-orange-500 mt-1 shrink-0" />
          </button>

          <button
            type="button"
            onClick={openStaleShift}
            className="w-full rounded-lg border border-orange-500/40 bg-card/60 px-3 py-2 text-left flex items-center gap-2 hover:bg-card transition-colors"
          >
            <PlayCircle className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="text-[12px] font-medium text-foreground flex-1 truncate">
              {staleProjectSession
                ? `${staleProjectSession.work_end_time ? "Review" : "Finish"} project: ${staleProjectSession.projects?.name ?? "Open project"}`
                : "Open unfinished shift"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          <div className="grid grid-cols-1 gap-2">
            {availableActions
              .filter((a) => a !== "punch_in")
              .map((a) => (
                <HoldToConfirm
                  key={a}
                  onConfirm={() => handleOfficeAction(a)}
                  disabled={actionLoading}
                  loading={actionLoading}
                  variant={a === "punch_out" ? "primary" : "secondary"}
                >
                  {a === "start_return_travel" && <RotateCcw className="h-4 w-4" />}
                  {a === "arrive_office" && <Building2 className="h-4 w-4" />}
                  {a === "punch_out" && <CheckCircle2 className="h-4 w-4" />}
                  {actionLabels[a]}
                </HoldToConfirm>
              ))}
          </div>
        </div>
      )}

      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">
            Hello, {employee?.name?.split(" ")[0] || "Worker"}
          </h1>
          <p className="text-xs text-muted-foreground">{employee?.employeeCode}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-mono font-bold text-foreground leading-none">{timeStr}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date().toLocaleDateString("en-AE", { weekday: "short", day: "2-digit", month: "short", timeZone: "Asia/Dubai" })}
          </p>
        </div>
      </div>

      {/* Office status */}
      <Card className="p-4 border-border/50 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              step === "punched_in" || step === "at_office" ? "bg-blue-400"
                : step === "punched_out" ? "bg-muted-foreground"
                : "bg-muted-foreground"
            }`} />
            <div>
              <p className={`font-semibold ${stepColors[step]}`}>{stepLabels[step]}</p>
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleDateString("en-AE", { weekday: "long", day: "2-digit", month: "short", timeZone: "Asia/Dubai" })}
              </p>
            </div>
          </div>
          {gpsQuality !== "none" && (
            <div className="flex items-center gap-1">
              <Crosshair className={`h-3.5 w-3.5 ${qualityColor(gpsQuality)}`} />
              <span className={`text-[10px] ${qualityColor(gpsQuality)}`}>{qualityLabel(gpsQuality).replace("GPS: ", "")}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Today's assignment preview — visible on idle so the screen isn't empty */}
      {step === "idle" && !projectsLoading && !!todayProjects?.length && (
        <Card className="p-4 border-brand/30 bg-brand/5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand mb-2">Today's assignment</p>
          {todayProjects.slice(0, 2).map((p) => (
            <div key={p.assignmentId} className="flex items-start gap-2 mb-2 last:mb-0">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{p.projectName}</p>
                {p.siteAddress && <p className="text-[11px] text-muted-foreground truncate">{p.siteAddress}</p>}
                {p.shiftStart && p.shiftEnd && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    {p.shiftStart.slice(0, 5)}–{p.shiftEnd.slice(0, 5)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {todayProjects.length > 2 && (
            <p className="text-[10px] text-muted-foreground mt-1">+ {todayProjects.length - 2} more after punch-in</p>
          )}
        </Card>
      )}

      {step === "idle" && !projectsLoading && !todayProjects?.length && (
        <Card className="p-4 border-border/50 bg-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Today</p>
          <p className="text-sm text-foreground">No site project assigned. You'll work in-house today.</p>
        </Card>
      )}

      {/* Upcoming assignments — tomorrow and beyond (always visible) */}
      {!!upcomingProjects?.length && (
        <Card className="p-4 border-border/50 bg-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Upcoming</p>
          <div className="space-y-2">
            {upcomingProjects.slice(0, 5).map((p) => {
              const d = new Date(p.date + "T00:00:00");
              const today0 = new Date(); today0.setHours(0, 0, 0, 0);
              const diffDays = Math.round((d.getTime() - today0.getTime()) / 86400000);
              const label =
                diffDays === 1 ? "Tomorrow" :
                d.toLocaleDateString("en-AE", { weekday: "short", day: "2-digit", month: "short" });
              return (
                <div key={p.assignmentId} className="flex items-start gap-2">
                  <div className="min-w-[68px] shrink-0">
                    <p className="text-[11px] font-semibold text-brand">{label}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{p.projectName}</p>
                    {p.siteAddress && <p className="text-[11px] text-muted-foreground truncate">{p.siteAddress}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.shiftStart && p.shiftEnd && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.shiftStart.slice(0, 5)}–{p.shiftEnd.slice(0, 5)}
                        </p>
                      )}
                      {p.task && (
                        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                          <ClipboardList className="h-3 w-3" />
                          {p.task}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {upcomingProjects.length > 5 && (
            <p className="text-[10px] text-muted-foreground mt-2">+ {upcomingProjects.length - 5} more this week</p>
          )}
        </Card>
      )}



      {/* Punch In (idle) */}
      {step === "idle" && officeAction === "punch_in" && (
        <HoldToConfirm
          onConfirm={() => handleOfficeAction("punch_in")}
          disabled={actionLoading}
          loading={actionLoading}
          variant="primary"
        >
          <CheckCircle2 className="h-6 w-6" />
          {actionLabels.punch_in}
        </HoldToConfirm>
      )}

      {/* Quick links — visible on idle */}
      {step === "idle" && (
        <div className="grid grid-cols-3 gap-2 mt-1">
          <button onClick={() => navigate("/m/site-visits")} className="rounded-xl border border-border/50 bg-card p-3 text-center hover:border-brand/40 transition-colors">
            <MapPin className="h-4 w-4 text-brand mx-auto mb-1" />
            <span className="text-[11px] font-medium text-foreground">Visits</span>
          </button>
          <button onClick={() => navigate("/m/daily-log")} className="rounded-xl border border-border/50 bg-card p-3 text-center hover:border-brand/40 transition-colors">
            <ClipboardList className="h-4 w-4 text-brand mx-auto mb-1" />
            <span className="text-[11px] font-medium text-foreground">Daily Log</span>
          </button>
          <button onClick={() => navigate("/m/timesheet")} className="rounded-xl border border-border/50 bg-card p-3 text-center hover:border-brand/40 transition-colors">
            <Clock className="h-4 w-4 text-brand mx-auto mb-1" />
            <span className="text-[11px] font-medium text-foreground">Timesheet</span>
          </button>
        </div>
      )}

      {/* Resume in-progress project */}
      {step !== "idle" && step !== "punched_out" && !isDriverDay && activeProject && (
        <button
          onClick={() => navigate(`/m/project/${activeProject.projectId}`)}
          className="rounded-xl border border-brand/50 bg-brand/10 p-4 text-left transition-colors hover:bg-brand/15"
        >
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-brand shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-brand uppercase tracking-wider">Resume Last Step</p>
              <p className="text-sm font-semibold text-foreground truncate mt-0.5">{activeProject.projectName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Currently: <span className={projectStepColors[activeProject.step]}>{projectStepLabels[activeProject.step]}</span>
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-brand shrink-0" />
          </div>
        </button>
      )}

      {/* IN-HOUSE MODE: Punched in, no projects today → simple office workflow */}
      {step !== "idle" && step !== "punched_out" && !projectsLoading && !todayProjects?.length && (
        <div className="flex flex-col gap-3">
          <Card className="p-4 border-brand/40 bg-brand/5">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-brand mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">In-House Work</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No site project today. Working from office.
                </p>
              </div>
            </div>
          </Card>

          {/* Punch out — always available in-house */}
          <HoldToConfirm
            onConfirm={() => handleOfficeAction("punch_out")}
            disabled={actionLoading}
            loading={actionLoading}
            variant="secondary"
          >
            <CheckCircle2 className="h-5 w-5" />
            {actionLabels.punch_out}
          </HoldToConfirm>
        </div>
      )}

      {/* DRIVER MODE — multi-leg trip workflow */}
      {step !== "idle" && step !== "punched_out" && isDriverDay && (
        <DriverWorkflowCard
          todayProjects={todayProjects ?? []}
          step={step}
          onReturnToOffice={() => handleOfficeAction("start_return_travel")}
        />
      )}

      {/* Project list — visible after punch in, before punch out, when projects exist (technician flow) */}
      {step !== "idle" && step !== "punched_out" && !isDriverDay && !!todayProjects?.length && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Projects</p>
            <p className="text-xs text-muted-foreground">
              {todayProjects.filter((p) => p.step === "completed").length}/{todayProjects.length} done
            </p>
          </div>

          {todayProjects.map((p) => {
            const isActive = p.sessionId && p.step !== "completed";
            const isDone = p.step === "completed";
            return (
              <button
                key={p.assignmentId}
                onClick={() => navigate(`/m/project/${p.projectId}`)}
                disabled={isDone}
                className={`text-left rounded-xl border p-4 transition-all ${
                  isDone
                    ? "border-border/30 bg-card/50 opacity-60"
                    : isActive
                      ? "border-brand/50 bg-brand/5"
                      : "border-border/50 bg-card hover:border-brand/40 hover:bg-card/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  ) : isActive ? (
                    <PlayCircle className="h-5 w-5 text-brand mt-0.5 shrink-0 animate-pulse" />
                  ) : p.workLocation === "in_house" ? (
                    <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  ) : (
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{p.projectName}</p>
                    {p.task && (
                      <p className="text-xs text-brand truncate mt-0.5">Task: {p.task}</p>
                    )}
                    {p.siteAddress && <p className="text-xs text-muted-foreground truncate">{p.siteAddress}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-xs font-medium ${projectStepColors[p.step]}`}>
                        {projectStepLabels[p.step]}
                      </span>
                      {p.shiftStart && p.shiftEnd && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.shiftStart.slice(0, 5)}–{p.shiftEnd.slice(0, 5)}
                        </span>
                      )}
                      {isDone && p.totalWorkMinutes != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {Math.floor(p.totalWorkMinutes / 60)}h {p.totalWorkMinutes % 60}m
                        </span>
                      )}
                    </div>
                    {!isDone && (
                      <p className="text-[11px] font-semibold text-brand mt-2 flex items-center gap-1">
                        <ArrowRight className="h-3 w-3" />
                        Tap to {p.step === "idle"
                          ? (p.workLocation === "in_house" ? "Start Work" : "Start Travel")
                          : p.step === "traveling" ? "mark Arrived at Site"
                          : p.step === "at_site" ? "Start Work"
                          : p.step === "working" ? "End Work or take Break"
                          : p.step === "on_break" ? "End Break"
                          : "continue"}
                      </p>
                    )}
                  </div>
                  {!isDone && <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />}
                </div>
              </button>
            );
          })}



          {singleProject && !singleProject.sessionId && (
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              Tap your project above to {singleProject.workLocation === "in_house" ? "start work" : "start travel"}.
            </p>
          )}
        </div>
      )}

      {/* Loading state for project list */}
      {step !== "idle" && step !== "punched_out" && projectsLoading && (
        <Card className="p-6 border-border/50 bg-card flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </Card>
      )}

      {/* Post-projects: pick another OR return-to-office flow.
          Also rendered whenever the global workflow itself needs a return-travel
          / arrive-office step (e.g. user visited a site earlier today) — even if
          a per-project session is still open — so users are never stuck without
          these actions before punch-out. */}
      {step !== "idle" && step !== "punched_out" && step !== "at_office" && (
        allProjectsDone
        || (isDriverDay && step === "returning")
        || step === "work_done"
        || step === "returning"
      ) && (
        <div className="flex flex-col gap-3">
          <Card className="p-4 border-green-500/30 bg-green-500/5">
            <p className="text-sm text-foreground font-medium">
              {allProjectsDone ? "All assigned projects done!" : "Heading back to office"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {allInHouseDay
                ? "In-house work complete. Punch out when you're ready to end the day."
                : step === "returning"
                  ? "Tap below when you reach the office — or pick up another project."
                  : "You visited a site today — start return travel and arrive at office before punching out."}
            </p>
          </Card>

          {allInHouseDay ? (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("punch_out")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
            >
              <CheckCircle2 className="h-5 w-5" />
              {actionLabels.punch_out}
            </HoldToConfirm>
          ) : step !== "returning" ? (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("start_return_travel")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
            >
              <MapPin className="h-5 w-5" />
              {actionLabels.start_return_travel}
            </HoldToConfirm>
          ) : (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("arrive_office")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
            >
              <Building2 className="h-5 w-5" />
              {actionLabels.arrive_office}
            </HoldToConfirm>
          )}
        </div>
      )}


      {/* Punch Out — when projects exist and we're at office (after return-travel flow) */}
      {step === "at_office" && (
        <HoldToConfirm
          onConfirm={() => handleOfficeAction("punch_out")}
          disabled={actionLoading}
          loading={actionLoading}
          variant="primary"
        >
          <CheckCircle2 className="h-6 w-6" />
          {actionLabels.punch_out}
        </HoldToConfirm>
      )}

      {/* Fallback: punch out available outside the project flow (e.g., no projects path) */}
      {step !== "idle" && step !== "punched_out" && step !== "at_office" && officeAction === "punch_out" && !!todayProjects?.length && !allProjectsDone && (
        <HoldToConfirm
          onConfirm={() => handleOfficeAction("punch_out")}
          disabled={actionLoading}
          loading={actionLoading}
          variant="secondary"
        >
          <CheckCircle2 className="h-6 w-6" />
          {actionLabels.punch_out}
        </HoldToConfirm>
      )}

      {step === "punched_out" && (() => {
        const pending = (todayProjects ?? []).filter((p) => p.step !== "completed" && !p.sessionId);
        if (pending.length > 0) {
          return (
            <div className="flex flex-col gap-3">
              <Card className="p-4 border-brand/40 bg-brand/5">
                <p className="font-semibold text-foreground">Next shift coming up</p>
                <p className="text-xs text-muted-foreground mt-1">
                  You've punched out from your previous shift. Punch in again to start the next one.
                </p>
              </Card>

              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Assignments</p>
                {pending.map((p) => (
                  <Card key={p.assignmentId} className="p-3 border-border/50 bg-card">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground text-sm truncate">{p.projectName}</p>
                        {p.shiftStart && p.shiftEnd && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {p.shiftStart.slice(0, 5)}–{p.shiftEnd.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <HoldToConfirm
                onConfirm={() => handleOfficeAction("punch_in")}
                disabled={actionLoading}
                loading={actionLoading}
                variant="primary"
              >
                <CheckCircle2 className="h-6 w-6" />
                Punch In — Next Shift
              </HoldToConfirm>
            </div>
          );
        }
        return (
          <Card className="p-6 border-green-500/30 bg-green-500/5 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
            <p className="font-semibold text-green-400">Day Complete!</p>
            <p className="text-xs text-muted-foreground mt-1">Great work today.</p>
          </Card>
        );
      })()}

    </div>
  );
}
