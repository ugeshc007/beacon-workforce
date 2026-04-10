import { useMobileWorkflow } from "@/hooks/useMobileWorkflow";
import { useMobileAuth } from "@/hooks/useMobileAuth";
import { useBackgroundTracking } from "@/hooks/useBackgroundTracking";
import { actionLabels, stepLabels, stepColors, WorkflowAction } from "@/lib/workflow-engine";
import { getGpsPosition, qualityColor, qualityLabel } from "@/lib/gps";
import { enqueueAction } from "@/lib/offline-queue";
import { syncPendingActions, initAutoSync } from "@/lib/offline-sync";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { MapPicker } from "@/components/mobile/MapPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, MapPin, Clock, Wifi, WifiOff, CheckCircle2, AlertTriangle, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";

/** Actions that require GPS */
const GPS_ACTIONS: WorkflowAction[] = ["punch_in", "start_travel", "arrive_site"];

/** Actions that require hold-to-confirm */
const CRITICAL_ACTIONS: WorkflowAction[] = ["punch_in", "end_work", "punch_out"];

export default function MobileHome() {
  const { employee } = useMobileAuth();
  const { step, assignment, attendanceLog, availableActions, loading, actionLoading, executeAction } = useMobileWorkflow();
  const { startTracking, stopTracking } = useBackgroundTracking();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [gpsQuality, setGpsQuality] = useState<"high" | "medium" | "low" | "none">("none");
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [pendingAction, setPendingAction] = useState<WorkflowAction | null>(null);
  const autoSyncCleanup = useRef<(() => void) | null>(null);

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Online/offline
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

  // Auto-sync on reconnect
  useEffect(() => {
    autoSyncCleanup.current = initAutoSync();
    return () => autoSyncCleanup.current?.();
  }, []);

  // Background tracking: start when traveling, stop otherwise
  useEffect(() => {
    if (step === "traveling" && employee && attendanceLog) {
      startTracking(employee.id, attendanceLog.id);
    } else {
      stopTracking();
    }
    return () => { stopTracking(); };
  }, [step, employee, attendanceLog, startTracking, stopTracking]);

  const handleAction = async (action: WorkflowAction) => {
    let payload: Record<string, unknown> = {};

    // GPS actions
    if (GPS_ACTIONS.includes(action)) {
      const gps = await getGpsPosition();
      setGpsQuality(gps.quality);

      if (gps.needsMapFallback && !gps.reading) {
        // No GPS at all — show map picker
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

        if (gps.needsMapFallback) {
          toast({
            title: "Low GPS Accuracy",
            description: `Accuracy: ${Math.round(gps.reading.accuracy)}m. You can proceed or pick manually.`,
          });
        }
      }
    }

    await submitAction(action, payload);
  };

  const handleMapConfirm = async (lat: number, lng: number) => {
    setShowMapPicker(false);
    if (!pendingAction) return;

    const payload = { lat, lng, accuracy: 999, is_spoofed: false, manual_location: true };
    await submitAction(pendingAction, payload);
    setPendingAction(null);
  };

  const submitAction = async (action: WorkflowAction, payload: Record<string, unknown>) => {
    if (!employee) return;

    // If offline, queue it
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
    if (result?.success) {
      toast({ title: "Success", description: `${actionLabels[action]} completed.` });
    } else {
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

  const primaryAction = availableActions[0];
  const secondaryActions = availableActions.slice(1);

  const timeStr = currentTime.toLocaleTimeString("en-AE", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai",
  });

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

      {/* Status + GPS quality */}
      <Card className="p-4 border-border/50 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${step === "working" ? "bg-green-400 animate-pulse" : step === "traveling" ? "bg-amber-400 animate-pulse" : "bg-muted-foreground"}`} />
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

      {/* Today's Assignment */}
      {assignment ? (
        <Card className="p-4 border-border/50 bg-card">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{assignment.projectName}</p>
              {assignment.siteAddress && <p className="text-sm text-muted-foreground truncate">{assignment.siteAddress}</p>}
              {assignment.shiftStart && assignment.shiftEnd && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{assignment.shiftStart?.slice(0, 5)} – {assignment.shiftEnd?.slice(0, 5)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 border-border/50 bg-card">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <p className="text-sm text-muted-foreground">No assignment for today</p>
          </div>
        </Card>
      )}

      {/* Workflow Progress */}
      <Card className="p-4 border-border/50 bg-card">
        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Today's Progress</p>
        <div className="flex items-center gap-1">
          {(["idle", "punched_in", "traveling", "at_site", "working", "work_done", "punched_out"] as const).map((s, i) => {
            const steps = ["idle", "punched_in", "traveling", "at_site", "working", "work_done", "punched_out"];
            const currentIdx = steps.indexOf(step);
            const isComplete = i <= currentIdx;
            const isCurrent = s === step;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-2 w-full rounded-full ${isComplete ? "bg-brand" : "bg-muted"} ${isCurrent ? "ring-2 ring-brand/30" : ""}`} />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-muted-foreground">Start</span>
          <span className="text-[10px] text-muted-foreground">Done</span>
        </div>
      </Card>

      {/* Main Action Button — hold-to-confirm for critical actions */}
      {primaryAction && (
        CRITICAL_ACTIONS.includes(primaryAction) ? (
          <HoldToConfirm
            onConfirm={() => handleAction(primaryAction)}
            disabled={actionLoading}
            loading={actionLoading}
          >
            {actionLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <CheckCircle2 className="h-6 w-6" />
            )}
            {actionLabels[primaryAction]}
          </HoldToConfirm>
        ) : (
          <Button
            className="h-16 text-lg font-bold rounded-2xl shadow-lg"
            onClick={() => handleAction(primaryAction)}
            disabled={actionLoading}
          >
            {actionLoading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <CheckCircle2 className="mr-2 h-6 w-6" />}
            {actionLabels[primaryAction]}
          </Button>
        )
      )}

      {/* Secondary Actions */}
      {secondaryActions.length > 0 && (
        <div className="flex gap-2">
          {secondaryActions.map((action) => (
            <Button
              key={action}
              variant="outline"
              className="flex-1 h-12"
              onClick={() => handleAction(action)}
              disabled={actionLoading}
            >
              {actionLabels[action]}
            </Button>
          ))}
        </div>
      )}

      {step === "punched_out" && (
        <Card className="p-6 border-green-500/30 bg-green-500/5 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-2" />
          <p className="font-semibold text-green-400">Day Complete!</p>
          <p className="text-xs text-muted-foreground mt-1">Great work today.</p>
        </Card>
      )}

      {/* Map fallback picker */}
      <MapPicker
        open={showMapPicker}
        onClose={() => { setShowMapPicker(false); setPendingAction(null); }}
        onConfirm={handleMapConfirm}
        initialLat={assignment?.siteLat || 25.2048}
        initialLng={assignment?.siteLng || 55.2708}
      />
    </div>
  );
}
