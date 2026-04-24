import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useProjectWorkflow } from "@/hooks/useProjectWorkflow";
import { useTodayProjects } from "@/hooks/useTodayProjects";
import {
  ProjectAction,
  projectActionLabels,
  projectStepLabels,
  projectStepColors,
} from "@/lib/project-workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { MapPicker } from "@/components/mobile/MapPicker";
import { ProjectStepTimeline } from "@/components/mobile/ProjectStepTimeline";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Clock, ArrowLeft, CheckCircle2, Crosshair, ArrowRight, RotateCcw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GPS_ACTIONS: ProjectAction[] = ["start_travel", "arrive_site"];

export default function MobileProjectWorkflow() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { employee } = useMobileAuth();
  const { data: todayProjects } = useTodayProjects();
  const { session, step, availableActions, loading, actionLoading, executeAction } = useProjectWorkflow(projectId ?? null);
  const { toast } = useToast();

  const [gpsQuality, setGpsQuality] = useState<"high" | "medium" | "low" | "none">("none");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<ProjectAction | null>(null);
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const [pulse, setPulse] = useState(false);
  const primaryRef = useRef<HTMLDivElement | null>(null);
  const prevStepRef = useRef(step);

  // When the step changes, scroll the primary button into view and pulse it briefly.
  useEffect(() => {
    if (loading) return;
    if (prevStepRef.current === step) return;
    prevStepRef.current = step;
    if (!primaryRef.current) return;
    primaryRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 1800);
    return () => clearTimeout(t);
  }, [step, loading]);

  const project = todayProjects?.find((p) => p.projectId === projectId);

  // Detect if we restored an in-progress session (anything past idle and not finished)
  const isResumed = !loading && !!session && step !== "idle" && step !== "completed";

  useEffect(() => {
    if (step === "completed") {
      // Auto-return to home after a moment so they can pick the next project
      const t = setTimeout(() => navigate("/m"), 1500);
      return () => clearTimeout(t);
    }
  }, [step, navigate]);

  if (loading || !employee) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  const handleAction = async (action: ProjectAction) => {
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
        payload = { lat: gps.reading.lat, lng: gps.reading.lng };
      }
    }
    await submitAction(action, payload);
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    setShowMapPicker(false);
    if (!pendingAction) return;
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
      />

      {/* Next action hint */}
      {primary && step !== "completed" && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5 text-brand" />
          <span>Next step: <span className="text-foreground font-medium">{projectActionLabels[primary]}</span></span>
        </div>
      )}

      {primary && (
        <div ref={primaryRef} className={pulse ? "animate-pulse-highlight rounded-2xl" : ""}>
          <HoldToConfirm
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
        <Card className="p-6 border-green-500/30 bg-green-500/5 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
          <p className="font-semibold text-green-400">Project Complete!</p>
          <p className="text-xs text-muted-foreground mt-1">Returning to project list…</p>
        </Card>
      )}

      <MapPicker
        open={showMapPicker}
        onClose={() => { setShowMapPicker(false); setPendingAction(null); }}
        onConfirm={handleMapConfirm}
        initialLat={project?.siteLat || 25.2048}
        initialLng={project?.siteLng || 55.2708}
      />
    </div>
  );
}
