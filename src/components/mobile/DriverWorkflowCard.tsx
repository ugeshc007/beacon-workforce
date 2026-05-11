import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { useDriverWorkflow, type DriverLegType } from "@/hooks/useDriverWorkflow";
import { useToast } from "@/hooks/use-toast";
import { getGpsPosition } from "@/lib/gps";
import { MapPin, Truck, PackageCheck, PackageOpen, Hourglass, ChevronRight, CheckCircle2 } from "lucide-react";
import type { TodayProject } from "@/hooks/useTodayProjects";
import { useState } from "react";

interface Props {
  todayProjects: TodayProject[];
  step: string;
  onReturnToOffice?: () => void;
  /** Disable interactive controls (e.g. when driver hasn't punched in) */
  disabled?: boolean;
}

const legTypeLabel: Record<DriverLegType, string> = {
  drop_off: "Drop Off",
  pick_up: "Pick Up",
  wait: "Waiting",
};

const legTypeIcon: Record<DriverLegType, React.ReactNode> = {
  drop_off: <PackageCheck className="h-3.5 w-3.5" />,
  pick_up: <PackageOpen className="h-3.5 w-3.5" />,
  wait: <Hourglass className="h-3.5 w-3.5" />,
};

export function DriverWorkflowCard({ todayProjects, step, onReturnToOffice, disabled = false }: Props) {
  const { legs, activeLeg, startTrip, arriveSite, endLeg } = useDriverWorkflow();
  const { toast } = useToast();
  const [pickedProject, setPickedProject] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const driverProjects = todayProjects.filter((p) => p.assignedRole === "driver");

  const handleStart = async () => {
    if (!pickedProject) {
      toast({ title: "Pick a project first", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const gps = await getGpsPosition();
      const lat = gps.reading?.lat ?? 0;
      const lng = gps.reading?.lng ?? 0;
      await startTrip.mutateAsync({ project_id: pickedProject, lat, lng });
      toast({ title: "Trip started" });
      setPickedProject(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleArrive = async (leg_type: DriverLegType) => {
    if (!activeLeg) return;
    setBusy(true);
    try {
      const gps = await getGpsPosition();
      await arriveSite.mutateAsync({
        leg_id: activeLeg.id,
        leg_type,
        lat: gps.reading?.lat ?? 0,
        lng: gps.reading?.lng ?? 0,
      });
      toast({ title: `Arrived — ${legTypeLabel[leg_type]}` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleEndLeg = async () => {
    if (!activeLeg) return;
    setBusy(true);
    try {
      const gps = await getGpsPosition();
      await endLeg.mutateAsync({
        leg_id: activeLeg.id,
        lat: gps.reading?.lat ?? 0,
        lng: gps.reading?.lng ?? 0,
      });
      toast({ title: "Trip leg complete" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (disabled) {
    return (
      <Card className="p-4 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <Truck className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Driver mode</p>
            <p className="text-xs text-muted-foreground mt-0.5">Punch in at office to start your first trip.</p>
          </div>
        </div>
      </Card>
    );
  }

  // Render based on active leg state
  return (
    <div className="flex flex-col gap-3">
      <Card className="p-4 border-brand/40 bg-brand/5">
        <div className="flex items-start gap-3">
          <Truck className="h-5 w-5 text-brand mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Driver Trips</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {legs.length === 0 ? "No trips yet today." : `${legs.filter(l => l.status === "completed").length} completed · ${activeLeg ? "1 in progress" : "ready for next"}`}
            </p>
          </div>
        </div>
      </Card>

      {/* Completed legs timeline */}
      {legs.length > 0 && (
        <div className="flex flex-col gap-2">
          {legs.map((l) => (
            <div key={l.id} className="rounded-lg border border-border/50 bg-card p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">#{l.leg_number}</Badge>
                  <p className="font-medium text-foreground truncate">{l.project_name}</p>
                </div>
                {l.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                ) : (
                  <Badge variant="outline" className="text-[10px] border-brand/40 text-brand shrink-0">
                    {l.status === "traveling" ? "Traveling" : "On site"}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                {l.leg_type && (
                  <span className="flex items-center gap-1">
                    {legTypeIcon[l.leg_type]} {legTypeLabel[l.leg_type]}
                  </span>
                )}
                {l.total_travel_minutes > 0 && <span>· Travel {l.total_travel_minutes}m</span>}
                {l.total_onsite_minutes > 0 && <span>· On-site {l.total_onsite_minutes}m</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ACTIVE LEG — TRAVELING → arrive options */}
      {activeLeg?.status === "traveling" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Arrived at site?</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" disabled={busy} onClick={() => handleArrive("drop_off")} className="h-auto py-3 flex-col gap-1">
              <PackageCheck className="h-4 w-4" />
              <span className="text-[11px]">Drop Off</span>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => handleArrive("pick_up")} className="h-auto py-3 flex-col gap-1">
              <PackageOpen className="h-4 w-4" />
              <span className="text-[11px]">Pick Up</span>
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => handleArrive("wait")} className="h-auto py-3 flex-col gap-1">
              <Hourglass className="h-4 w-4" />
              <span className="text-[11px]">Wait</span>
            </Button>
          </div>
        </div>
      )}

      {/* ACTIVE LEG — ON_SITE → end leg */}
      {activeLeg?.status === "on_site" && (
        <HoldToConfirm onConfirm={handleEndLeg} disabled={busy} loading={busy} variant="primary">
          <ChevronRight className="h-5 w-5" />
          {activeLeg.leg_type === "wait" ? "Done Waiting" : "Leaving Site"}
        </HoldToConfirm>
      )}

      {/* NO ACTIVE LEG → pick next project */}
      {!activeLeg && step !== "punched_out" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {legs.length === 0 ? "Pick first project" : "Start next trip"}
          </p>
          {driverProjects.length === 0 ? (
            <Card className="p-4 text-center text-sm text-muted-foreground">No driver assignments today</Card>
          ) : (
            <div className="flex flex-col gap-2">
              {driverProjects.map((p) => (
                <button
                  key={p.assignmentId}
                  onClick={() => setPickedProject(p.projectId)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    pickedProject === p.projectId
                      ? "border-brand bg-brand/10"
                      : "border-border/50 bg-card hover:border-brand/40"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{p.projectName}</p>
                      {p.siteAddress && <p className="text-[11px] text-muted-foreground truncate">{p.siteAddress}</p>}
                    </div>
                    {pickedProject === p.projectId && <CheckCircle2 className="h-4 w-4 text-brand shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {pickedProject && (
            <HoldToConfirm onConfirm={handleStart} disabled={busy} loading={busy} variant="primary">
              <Truck className="h-5 w-5" />
              Start Travel
            </HoldToConfirm>
          )}

          {legs.length > 0 && onReturnToOffice && (
            <Button variant="outline" onClick={onReturnToOffice} disabled={busy} className="mt-2 gap-2">
              <MapPin className="h-4 w-4" /> Return to Office
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
