import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Coffee, CheckCircle2, Truck, Building, ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HoldToConfirm } from "@/components/mobile/HoldToConfirm";
import { useToast } from "@/hooks/use-toast";
import { useSiteVisitWorkflow } from "@/hooks/useSiteVisitWorkflow";
import {
  SiteVisitAction,
  siteVisitActionLabels,
  siteVisitStepColors,
  siteVisitStepLabels,
} from "@/lib/site-visit-workflow-engine";
import { getGpsPosition } from "@/lib/gps";

interface Props {
  siteVisitId: string;
}

const stepIcons: Record<SiteVisitAction, React.ElementType> = {
  start_travel: Truck,
  arrive_site: MapPin,
  start_survey: ClipboardList,
  start_break: Coffee,
  end_break: ClipboardList,
  end_visit: CheckCircle2,
  start_return_travel: Truck,
};

function fmtElapsed(start?: string | null, end?: string | null) {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.max(0, Math.round((e - s) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function SiteVisitWorkflowCard({ siteVisitId }: Props) {
  const { toast } = useToast();
  const { session, step, availableActions, loading, actionLoading, executeAction } =
    useSiteVisitWorkflow(siteVisitId);
  const [, setTick] = useState(0);

  // Live timer
  useEffect(() => {
    if (step === "completed" || step === "idle") return;
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, [step]);

  const elapsed = useMemo(() => {
    if (!session) return null;
    if (step === "traveling") return { label: "Traveling", value: fmtElapsed(session.travel_start_time) };
    if (step === "at_site") return { label: "At site", value: fmtElapsed(session.site_arrival_time) };
    if (step === "surveying") return { label: "Surveying", value: fmtElapsed(session.work_start_time) };
    if (step === "on_break") return { label: "On break", value: fmtElapsed(session.break_start_time) };
    if (step === "returning") return { label: "Total", value: session.total_work_minutes ? `${Math.floor(session.total_work_minutes / 60)}h ${session.total_work_minutes % 60}m` : "—" };
    if (step === "completed") return { label: "Total", value: session.total_work_minutes ? `${Math.floor(session.total_work_minutes / 60)}h ${session.total_work_minutes % 60}m` : "—" };
    return null;
  }, [session, step]);

  const handleAction = async (action: SiteVisitAction) => {
    let payload: Record<string, unknown> | undefined;
    if (action === "start_travel" || action === "arrive_site" || action === "start_return_travel") {
      const gps = await getGpsPosition(15000);
      if (!gps.reading) {
        toast({ title: "GPS unavailable", description: "Enable location and try again.", variant: "destructive" });
        return;
      }
      payload = { lat: gps.reading.lat, lng: gps.reading.lng, accuracy: gps.reading.accuracy };
    }
    const res = await executeAction(action, payload);
    if (!res.success) {
      toast({ title: "Action failed", description: res.error, variant: "destructive" });
    } else if (res.queued) {
      toast({ title: "Saved offline — will sync when online" });
    }
  };

  if (loading) {
    return <Card className="p-4 flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading workflow…</Card>;
  }

  if (step === "completed") {
    return (
      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Building className={`h-4 w-4 ${siteVisitStepColors[step]}`} />
          <span className={`text-sm font-semibold ${siteVisitStepColors[step]}`}>{siteVisitStepLabels[step]}</span>
        </div>
        {elapsed && <p className="text-xs text-muted-foreground">{elapsed.label}: <span className="text-foreground font-mono">{elapsed.value}</span></p>}
        <p className="text-xs text-muted-foreground">Time has been logged. You can still fill in the survey form below.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building className={`h-4 w-4 ${siteVisitStepColors[step]}`} />
          <span className={`text-sm font-semibold ${siteVisitStepColors[step]}`}>{siteVisitStepLabels[step]}</span>
        </div>
        {elapsed && <span className="text-xs text-muted-foreground">{elapsed.label} <span className="text-foreground font-mono ml-1">{elapsed.value}</span></span>}
      </div>

      {availableActions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No actions available.</p>
      ) : (
        <div className="grid gap-2">
          {availableActions.map((action, idx) => {
            const Icon = stepIcons[action];
            const isPrimary = idx === 0;
            return (
              <HoldToConfirm
                key={action}
                onConfirm={() => handleAction(action)}
                loading={actionLoading}
                variant={isPrimary ? "primary" : "secondary"}
              >
                <Icon className="h-5 w-5" />
                {siteVisitActionLabels[action]}
              </HoldToConfirm>
            );
          })}
        </div>
      )}
    </Card>
  );
}
