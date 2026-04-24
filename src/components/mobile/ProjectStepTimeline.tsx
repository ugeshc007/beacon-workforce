import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { ProjectStep } from "@/lib/project-workflow-engine";

interface Props {
  step: ProjectStep;
  travelStart?: string | null;
  siteArrival?: string | null;
  workStart?: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
  workEnd?: string | null;
}

const STEPS: { key: ProjectStep; label: string; doneLabel: string }[] = [
  { key: "traveling", label: "Travel to Site", doneLabel: "Traveled" },
  { key: "at_site", label: "Arrive at Site", doneLabel: "Arrived" },
  { key: "working", label: "Work in Progress", doneLabel: "Worked" },
  { key: "on_break", label: "Break", doneLabel: "Break taken" },
  { key: "completed", label: "Finish Work", doneLabel: "Completed" },
];

function fmtElapsed(from: string): string {
  const ms = Date.now() - new Date(from).getTime();
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
    : `${m}m ${String(s).padStart(2, "0")}s`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-AE", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai",
  });
}

export function ProjectStepTimeline({
  step, travelStart, siteArrival, workStart, breakStart, breakEnd, workEnd,
}: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  let currentKey: ProjectStep = step;
  let currentStartedAt: string | null = null;
  if (step === "idle") {
    currentKey = "traveling";
    currentStartedAt = null;
  } else if (step === "traveling") {
    currentStartedAt = travelStart ?? null;
  } else if (step === "at_site") {
    currentStartedAt = siteArrival ?? null;
  } else if (step === "working") {
    currentStartedAt = breakEnd ?? workStart ?? null;
  } else if (step === "on_break") {
    currentStartedAt = breakStart ?? null;
  } else if (step === "completed") {
    currentStartedAt = workEnd ?? null;
  }

  const order: ProjectStep[] = ["traveling", "at_site", "working", "on_break", "completed"];
  const breakTaken = !!breakStart;

  const currentIdx = order.indexOf(currentKey);
  void tick;

  return (
    <div className="flex flex-col gap-2">
      {STEPS.filter((s) => s.key !== "on_break" || breakTaken || step === "on_break").map((s) => {
        const sIdx = order.indexOf(s.key);
        const isDone = sIdx < currentIdx || (step === "completed" && s.key !== "completed");
        const isCurrent = (s.key === currentKey && step !== "completed") || (s.key === "completed" && step === "completed");

        const stamp =
          s.key === "traveling" ? travelStart :
          s.key === "at_site" ? siteArrival :
          s.key === "working" ? workStart :
          s.key === "on_break" ? breakStart :
          workEnd;

        return (
          <div
            key={s.key}
            className={`flex items-center gap-3 rounded-lg p-3 border transition-colors ${
              isCurrent ? "border-brand/50 bg-brand/5"
                : isDone ? "border-border/30 bg-card/50"
                : "border-border/30 bg-card/30 opacity-60"
            }`}
          >
            <div className="shrink-0">
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              ) : isCurrent ? (
                <Loader2 className="h-5 w-5 text-brand animate-spin" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${
                isCurrent ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/70"
              }`}>
                {isDone ? s.doneLabel : s.label}
              </p>
              {stamp && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Started {fmtTime(stamp)}
                </p>
              )}
            </div>
            {isCurrent && currentStartedAt && step !== "completed" && (
              <div className="shrink-0 text-right">
                <p className="text-xs font-mono font-bold text-brand">
                  {fmtElapsed(currentStartedAt)}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">elapsed</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
