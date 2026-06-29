import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useProjectWorkflow } from "@/hooks/useProjectWorkflow";
import { useTodayProjects } from "@/hooks/useTodayProjects";
import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import {
  ProjectAction,
  projectActionLabels,
  projectStepLabels,
  projectStepColors,
} from "@/lib/project-workflow-engine";
import { actionLabels as officeActionLabels } from "@/lib/workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { MapPicker } from "@/components/mobile/MapPicker";
import { ProjectStepTimeline } from "@/components/mobile/ProjectStepTimeline";
import { RetroTimeDialog } from "@/components/mobile/RetroTimeDialog";
import { projectActionTimeHints, officeActionTimeHints } from "@/lib/retro-time";
import { WorkflowAction } from "@/lib/workflow-engine";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Clock, ArrowLeft, CheckCircle2, Crosshair, ArrowRight, RotateCcw, X, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GPS_ACTIONS: ProjectAction[] = ["start_travel", "arrive_site"];

export default function MobileProjectWorkflow() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const dateOverride = searchParams.get("date");
  const navigate = useNavigate();
  const { employee } = useMobileAuth();
  const { data: todayProjects } = useTodayProjects();
  const { session, step, workLocation, availableActions, loading, actionLoading, executeAction } = useProjectWorkflow(projectId ?? null, dateOverride);
  const office = useMobileWorkflow();
  const { toast } = useToast();


  const [gpsQuality, setGpsQuality] = useState<"high" | "medium" | "low" | "none">("none");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<ProjectAction | null>(null);
  const [pendingOfficeAction, setPendingOfficeAction] = useState<WorkflowAction | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [pulse, setPulse] = useState(false);
  // Declared BEFORE early return so hooks order stays stable (prevents black screen).
  const [retroProjectAction, setRetroProjectAction] = useState<ProjectAction | null>(null);
  const [retroOfficeAction, setRetroOfficeAction] = useState<WorkflowAction | null>(null);
  const [retroPayload, setRetroPayload] = useState<Record<string, unknown>>({});
  const [retroOfficePayload, setRetroOfficePayload] = useState<Record<string, unknown>>({});
  const primaryRef = useRef<HTMLDivElement | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const prevStepRef = useRef(step);

  // When the step changes, scroll the primary button into view, pulse it briefly, and focus it.
  useEffect(() => {
    if (loading) return;
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    if (!primaryRef.current) return;
    primaryRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulse(true);
    // Focus the hold-to-confirm button after the scroll settles for quicker interaction
    const focusT = setTimeout(() => {
      primaryButtonRef.current?.focus({ preventScroll: true });
    }, 450);
    const t = setTimeout(() => setPulse(false), 1800);
    return () => {
      clearTimeout(t);
      clearTimeout(focusT);
    };
  }, [step, loading]);

  const project = todayProjects?.find((p) => p.projectId === projectId);

  // Detect if we restored an in-progress session (anything past idle and not finished)
  const isResumed = !loading && !!session && step !== "idle" && step !== "completed";

  useEffect(() => {
    // Auto-return to home ONLY when the office shift is already wrapped up
    // (punched out). Otherwise we keep the user here so they can use the
    // post-project office actions (Return Travel / Arrive Office / Punch Out).
    if (step === "completed" && office.step === "punched_out") {
      const t = setTimeout(() => navigate("/m"), 1500);
      return () => clearTimeout(t);
    }
  }, [step, office.step, navigate]);

  if (loading || !employee) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  // Stale shift detection — dateOverride is set when opened from the unfinished-shift banner.
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });
  const shiftDate = dateOverride || todayStr;
  const isStale = shiftDate < todayStr;

  // Retro-time dialog state is hoisted above the early-return (see top of function).

  const handleAction = async (action: ProjectAction) => {
    let payload: Record<string, unknown> = {};
    if (GPS_ACTIONS.includes(action)) {
      const gps = await getGpsPosition();
      setGpsQuality(gps.quality);
      // Server REQUIRES lat/lng for travel/arrival. If GPS didn't return a
      // reading (denied, timeout, low accuracy), fall back to the map picker
      // instead of submitting an empty payload (which causes "Employee id,
      // Lat & lng required" 400 errors).
      if (!gps.reading) {
        setPendingAction(action);
        setShowMapPicker(true);
        return;
      }
      payload = { lat: gps.reading.lat, lng: gps.reading.lng };
    }
    if (isStale) {
      setRetroPayload(payload);
      setRetroProjectAction(action);
      return;
    }
    await submitAction(action, payload);
  };

  // Office actions that the server requires lat/lng for.
  const OFFICE_GPS_ACTIONS: WorkflowAction[] = ["start_return_travel", "arrive_office", "punch_out"];

  const handleOfficeActionTap = async (action: WorkflowAction) => {
    let payload: Record<string, unknown> = {};
    if (OFFICE_GPS_ACTIONS.includes(action)) {
      const gps = await getGpsPosition();
      setGpsQuality(gps.quality);
      if (!gps.reading) {
        // Fall back to map picker so we never submit an empty lat/lng to the server.
        setPendingOfficeAction(action);
        setShowMapPicker(true);
        return;
      }
      payload = { lat: gps.reading.lat, lng: gps.reading.lng, accuracy: gps.reading.accuracy };
    }
    if (isStale) {
      setRetroOfficePayload(payload);
      setRetroOfficeAction(action);
      return;
    }
    const r = await office.executeAction(action, payload);
    if (!r?.success) {
      toast({ title: "Failed", description: r?.error || "Try again.", variant: "destructive" });
    }
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    setShowMapPicker(false);
    if (pendingOfficeAction) {
      const action = pendingOfficeAction;
      setPendingOfficeAction(null);
      const payload = { lat, lng };
      if (isStale) {
        setRetroOfficePayload(payload);
        setRetroOfficeAction(action);
        return;
      }
      const r = await office.executeAction(action, payload);
      if (!r?.success) {
        toast({ title: "Failed", description: r?.error || "Try again.", variant: "destructive" });
      }
      return;
    }
    if (!pendingAction) return;
    if (isStale) {
      setRetroPayload({ lat, lng });
      setRetroProjectAction(pendingAction);
      setPendingAction(null);
      return;
    }
    await submitAction(pendingAction, { lat, lng });
    setPendingAction(null);
  };

  const submitAction = async (action: ProjectAction, payload: Record<string, unknown>) => {
    const result = (await executeAction(action, payload)) as { success: boolean; error?: string; queued?: boolean };
    if (!result?.success) {
      toast({ title: "Failed", description: result?.error || "Something went wrong.", variant: "destructive" });
    } else if (result.queued) {
      toast({
        title: "Saved offline",
        description: "Timer is running. We'll sync this step when you're back online.",
      });
    }
  };


  const primary = availableActions[0];
  const secondary = availableActions.slice(1);

  return (
    <div className="flex flex-col gap-4 p-4 pb-24 safe-area-inset">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/m")} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Projects
        </Button>
      </div>

      <Card className="p-4 border-border/50 bg-card">
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 text-brand mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground truncate">{project?.projectName ?? "Project"}</p>
            {project?.siteAddress && (
              <p className="text-sm text-muted-foreground truncate">{project.siteAddress}</p>
            )}
            {project?.shiftStart && project?.shiftEnd && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {project.shiftStart.slice(0, 5)} – {project.shiftEnd.slice(0, 5)}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Resume banner — shown when an in-progress session was restored from DB */}
      {isResumed && !resumeDismissed && availableActions[0] && (
        <Card className="p-3 border-brand/50 bg-brand/10 flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-brand shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Resumed in-progress session</p>
            <p className="text-[11px] text-muted-foreground">
              You're at <span className="text-foreground font-medium">{projectStepLabels[step]}</span>.
              Next: {projectActionLabels[availableActions[0]]}.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => setResumeDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </Card>
      )}

      <Card className="p-4 border-border/50 bg-card flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            step === "working" ? "bg-green-400 animate-pulse"
              : step === "traveling" ? "bg-amber-400 animate-pulse"
              : step === "on_break" ? "bg-orange-400"
              : "bg-muted-foreground"
          }`} />
          <p className={`font-semibold ${projectStepColors[step]}`}>{projectStepLabels[step]}</p>
        </div>
        {gpsQuality !== "none" && (
          <div className="flex items-center gap-1">
            <Crosshair className={`h-3.5 w-3.5 ${qualityColor(gpsQuality)}`} />
            <span className={`text-[10px] ${qualityColor(gpsQuality)}`}>{qualityLabel(gpsQuality).replace("GPS: ", "")}</span>
          </div>
        )}
      </Card>

      {/* Step-by-step timeline with live elapsed timer */}
      <ProjectStepTimeline
        step={step}
        travelStart={session?.travel_start_time}
        siteArrival={session?.site_arrival_time}
        workStart={session?.work_start_time}
        breakStart={session?.break_start_time}
        breakEnd={session?.break_end_time}
        workEnd={session?.work_end_time}
        workLocation={workLocation}
      />

      {/* Next action hint */}
      {primary && step !== "completed" && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5 text-brand" />
          <span>Next step: <span className="text-foreground font-medium">{projectActionLabels[primary]}</span></span>
        </div>
      )}

      {primary && (
        <div ref={primaryRef} className={`rounded-2xl transition-shadow ${pulse ? "animate-pulse-glow ring-2 ring-brand/60" : ""}`}>
          <HoldToConfirm
            ref={primaryButtonRef}
            onConfirm={() => handleAction(primary)}
            disabled={actionLoading}
            loading={actionLoading}
            variant="primary"
          >
            <CheckCircle2 className="h-6 w-6" />
            {projectActionLabels[primary]}
          </HoldToConfirm>
        </div>
      )}

      {secondary.length > 0 && (
        <div className="flex flex-col gap-2">
          {secondary.map((a) => (
            <HoldToConfirm
              key={a}
              onConfirm={() => handleAction(a)}
              disabled={actionLoading}
              loading={actionLoading}
              variant="secondary"
            >
              {projectActionLabels[a]}
            </HoldToConfirm>
          ))}
        </div>
      )}

      {step === "completed" && (
        <Card className="p-6 border-green-500/30 bg-green-500/5">
          <div className="text-center">
            <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
            <p className="font-semibold text-green-400">Project Complete!</p>
            {office.step === "punched_out" ? (
              <p className="text-xs text-muted-foreground mt-1">Returning to project list…</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Finish your shift below or go back for other projects.
              </p>
            )}
          </div>

          {office.step !== "punched_out" && (
            <div className="mt-4 space-y-2">
              {office.availableActions
                .filter((a) => a !== "punch_in")
                .map((a) => (
                  <HoldToConfirm
                    key={a}
                    onConfirm={() => handleOfficeActionTap(a)}

                    disabled={office.actionLoading}
                    loading={office.actionLoading}
                    variant={a === "punch_out" ? "primary" : "secondary"}
                  >
                    {a === "start_return_travel" && <RotateCcw className="h-4 w-4" />}
                    {a === "arrive_office" && <Building2 className="h-4 w-4" />}
                    {a === "punch_out" && <CheckCircle2 className="h-4 w-4" />}
                    {officeActionLabels[a]}
                  </HoldToConfirm>
                ))}
              <Button variant="outline" className="w-full" onClick={() => navigate("/m")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
              </Button>
            </div>
          )}
        </Card>
      )}

      <MapPicker
        open={showMapPicker}
        onClose={() => { setShowMapPicker(false); setPendingAction(null); }}
        onConfirm={handleMapConfirm}
        initialLat={project?.siteLat || 25.2048}
        initialLng={project?.siteLng || 55.2708}
      />

      {retroProjectAction && (() => {
        const { minTime, defaultTime } = projectActionTimeHints(session, retroProjectAction);
        return (
          <RetroTimeDialog
            open={!!retroProjectAction}
            shiftDate={shiftDate}
            actionLabel={projectActionLabels[retroProjectAction]}
            minTime={minTime}
            defaultTime={defaultTime}
            onCancel={() => setRetroProjectAction(null)}
            onConfirm={async (iso) => {
              const action = retroProjectAction;
              const payload = { ...retroPayload, client_timestamp: iso, client_event_time: iso };
              setRetroProjectAction(null);
              setRetroPayload({});
              await submitAction(action, payload);
            }}
          />
        );
      })()}

      {retroOfficeAction && office.attendanceLog?.date && (() => {
        const { minTime, defaultTime } = officeActionTimeHints(office.attendanceLog, retroOfficeAction);
        return (
          <RetroTimeDialog
            open={!!retroOfficeAction}
            shiftDate={office.attendanceLog.date}
            actionLabel={officeActionLabels[retroOfficeAction]}
            minTime={minTime}
            defaultTime={defaultTime}
            onCancel={() => setRetroOfficeAction(null)}
            onConfirm={async (iso) => {
              const action = retroOfficeAction;
              setRetroOfficeAction(null);
              const r = await office.executeAction(action, { client_timestamp: iso });
              if (!r?.success) {
                toast({ title: "Failed", description: r?.error || "Try again.", variant: "destructive" });
              }
            }}
          />
        );
      })()}
    </div>
  );
}

