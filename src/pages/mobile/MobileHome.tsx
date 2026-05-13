import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useTodayProjects } from "@/hooks/useTodayProjects";
import { useAvailableProjects } from "@/hooks/useAvailableProjects";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { actionLabels, stepLabels, stepColors, WorkflowAction } from "@/lib/workflow-engine";
import { projectStepLabels, projectStepColors } from "@/lib/project-workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { enqueueAction } from "@/lib/offline-queue";
import { initAutoSync } from "@/lib/offline-sync";
import { invokeEdge } from "@/lib/invoke-edge";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { MapPicker } from "@/components/mobile/MapPicker";
import { DriverWorkflowCard } from "@/components/mobile/DriverWorkflowCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Loader2, MapPin, Clock, Wifi, WifiOff, CheckCircle2, AlertTriangle, Crosshair, ChevronRight, PlayCircle, RotateCcw, Coffee, Building2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const GPS_ACTIONS: WorkflowAction[] = ["punch_in", "punch_out", "start_return_travel", "arrive_office"];

export default function MobileHome() {
  const { employee } = useMobileAuth();
  const navigate = useNavigate();
  const { step, attendanceLog, availableActions, loading, actionLoading, executeAction } = useMobileWorkflow();
  const { data: todayProjects, isLoading: projectsLoading } = useTodayProjects();
  const { startTracking, stopTracking } = useBackgroundTracking();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gpsQuality, setGpsQuality] = useState<"high" | "medium" | "low" | "none">("none");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
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

  const handleOfficeAction = async (action: WorkflowAction) => {
    let payload: Record<string, unknown> = {};
    if (GPS_ACTIONS.includes(action)) {
      const gps = await getGpsPosition();
      setGpsQuality(gps.quality);
      if (gps.needsMapFallback && !gps.reading) {
        setPendingAction(action);
        setShowMapPicker(true);
        return;
      }
      if (gps.reading) {
        payload = {
          lat: gps.reading.lat,
          lng: gps.reading.lng,
          accuracy: gps.reading.accuracy,
          is_spoofed: gps.reading.isMock,
        };
      }
    }
    await submitAction(action, payload);
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    setShowMapPicker(false);
    if (!pendingAction) return;
    await submitAction(pendingAction, { lat, lng, accuracy: 999, is_spoofed: false, manual_location: true });
    setPendingAction(null);
  };

  const submitAction = async (action: WorkflowAction, payload: Record<string, unknown>) => {
    if (!employee) return;
    if (!navigator.onLine) {
      await enqueueAction({
        action_type: action,
        payload: { employee_id: employee.id, ...payload },
        timestamp: new Date().toISOString(),
      });
      toast({ title: "Queued Offline", description: `${actionLabels[action]} will sync when back online.` });
      return;
    }
    const result = await executeAction(action, payload);
    if (!result?.success) {
      toast({ title: "Failed", description: result?.error || "Something went wrong.", variant: "destructive" });
    }
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

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Hello, {employee?.name?.split(" ")[0] || "Worker"}
          </h1>
          <p className="text-sm text-muted-foreground">{employee?.employeeCode}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-foreground">{timeStr}</p>
          <div className="flex items-center gap-1 justify-end">
            {isOnline ? <Wifi className="h-3.5 w-3.5 text-green-400" /> : <WifiOff className="h-3.5 w-3.5 text-red-400" />}
            <span className="text-xs text-muted-foreground">{isOnline ? "Online" : "Offline"}</span>
          </div>
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
                {step === "on_break" && (
                  <p className="text-xs text-orange-400 mt-2 font-medium flex items-center gap-1">
                    <Coffee className="h-3 w-3" /> On break
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Break controls */}
          {step !== "on_break" && (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("start_break")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="secondary"
            >
              <Coffee className="h-5 w-5" />
              {actionLabels.start_break}
            </HoldToConfirm>
          )}
          {step === "on_break" && (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("end_break")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
            >
              <PlayCircle className="h-5 w-5" />
              {actionLabels.end_break}
            </HoldToConfirm>
          )}

          {/* Punch out — always available in-house */}
          <HoldToConfirm
            onConfirm={() => handleOfficeAction("punch_out")}
            disabled={actionLoading || step === "on_break"}
            loading={actionLoading}
            variant="secondary"
          >
            <CheckCircle2 className="h-5 w-5" />
            {actionLabels.punch_out}
          </HoldToConfirm>
          {step === "on_break" && (
            <p className="text-[11px] text-muted-foreground text-center">
              End your break before punching out.
            </p>
          )}
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
                  ) : (
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground truncate">{p.projectName}</p>
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
                  </div>
                  {!isDone && <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />}
                </div>
              </button>
            );
          })}

          {singleProject && !singleProject.sessionId && (
            <p className="text-[11px] text-muted-foreground text-center mt-1">
              Tap your project above to start travel.
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

      {/* Post-projects: return-to-office flow */}
      {step !== "idle" && step !== "punched_out" && (allProjectsDone || (isDriverDay && step === "returning")) && step !== "at_office" && (
        <div className="flex flex-col gap-3">
          <Card className="p-4 border-green-500/30 bg-green-500/5">
            <p className="text-sm text-foreground font-medium">All projects done!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {step === "returning"
                ? "Tap below when you reach the office."
                : "Start your return travel to the office."}
            </p>
          </Card>

          {step !== "returning" && (
            <HoldToConfirm
              onConfirm={() => handleOfficeAction("start_return_travel")}
              disabled={actionLoading}
              loading={actionLoading}
              variant="primary"
            >
              <MapPin className="h-5 w-5" />
              {actionLabels.start_return_travel}
            </HoldToConfirm>
          )}

          {step === "returning" && (
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

      {step === "punched_out" && (
        <Card className="p-6 border-green-500/30 bg-green-500/5 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
          <p className="font-semibold text-green-400">Day Complete!</p>
          <p className="text-xs text-muted-foreground mt-1">Great work today.</p>
        </Card>
      )}

      <MapPicker
        open={showMapPicker}
        onClose={() => { setShowMapPicker(false); setPendingAction(null); }}
        onConfirm={handleMapConfirm}
        initialLat={25.2048}
        initialLng={55.2708}
      />
    </div>
  );
}
