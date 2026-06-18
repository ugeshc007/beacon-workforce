import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useTodayProjects } from "@/hooks/useTodayProjects";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { actionLabels, stepLabels, stepColors, WorkflowAction } from "@/lib/workflow-engine";
import { projectStepLabels, projectStepColors } from "@/lib/project-workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { initAutoSync } from "@/lib/offline-sync";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { MapPicker } from "@/components/mobile/MapPicker";
import { DriverWorkflowCard } from "@/components/mobile/DriverWorkflowCard";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Clock, Wifi, WifiOff, CheckCircle2, AlertTriangle, Crosshair, ChevronRight, PlayCircle, RotateCcw, Coffee, Building2, ClipboardList } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
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
      if (!gps.reading) {
        toast({
          title: "Location unavailable",
          description: gps.error || "Please enable location permission and try again.",
          variant: "destructive",
        });
        return;
      }
      payload = {
        lat: gps.reading.lat,
        lng: gps.reading.lng,
        accuracy: gps.reading.accuracy,
        is_spoofed: gps.reading.isMock,
      };
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
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
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

      {/* Post-projects: pick another OR return-to-office flow */}
      {step !== "idle" && step !== "punched_out" && (allProjectsDone || (isDriverDay && step === "returning")) && step !== "at_office" && (
        <div className="flex flex-col gap-3">
          <Card className="p-4 border-green-500/30 bg-green-500/5">
            <p className="text-sm text-foreground font-medium">All assigned projects done!</p>
            <p className="text-xs text-muted-foreground mt-1">
              {allInHouseDay
                ? "In-house work complete. Punch out when you're ready to end the day."
                : step === "returning"
                  ? "Tap below when you reach the office — or pick up another project."
                  : "Pick up another project to keep working, or head back to the office."}
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
