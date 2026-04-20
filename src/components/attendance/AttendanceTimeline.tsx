import type { AttendanceLog } from "@/hooks/useAttendance";

interface Props {
  log: AttendanceLog;
}

const fmt = (ts: string | null) => {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const steps = [
  { key: "office_punch_in", label: "Punch In", color: "bg-brand" },
  { key: "travel_start_time", label: "Travel", color: "bg-status-traveling" },
  { key: "site_arrival_time", label: "On Site", color: "bg-status-present" },
  { key: "work_start_time", label: "Working", color: "bg-status-present" },
  { key: "break_start_time", label: "Break Start", color: "bg-orange-400" },
  { key: "break_end_time", label: "Break End", color: "bg-status-present" },
  { key: "work_end_time", label: "Work End", color: "bg-status-overtime" },
  { key: "return_travel_start_time", label: "Returning", color: "bg-status-traveling" },
  { key: "office_arrival_time", label: "At Office", color: "bg-brand" },
  { key: "office_punch_out", label: "Punch Out", color: "bg-muted-foreground" },
] as const;

export function AttendanceTimeline({ log }: Props) {
  // Find the last completed step
  let lastCompleted = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if ((log as any)[steps[i].key]) {
      lastCompleted = i;
      break;
    }
  }

  return (
    <div className="flex items-center gap-0.5 w-full">
      {steps.map((step, i) => {
        const value = (log as any)[step.key] as string | null;
        const completed = !!value;
        const isActive = i === lastCompleted && !log.office_punch_out;

        return (
          <div key={step.key} className="flex items-center gap-0.5 flex-1 min-w-0">
            {/* Dot */}
            <div className="relative flex items-center justify-center shrink-0" title={`${step.label}: ${fmt(value) ?? "—"}`}>
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                  completed
                    ? `${step.color} border-transparent`
                    : "bg-transparent border-muted-foreground/30"
                } ${isActive ? "ring-2 ring-brand/30 ring-offset-1 ring-offset-background" : ""}`}
              />
              {completed && (
                <span className="absolute -bottom-4 text-[8px] text-muted-foreground font-mono whitespace-nowrap">
                  {fmt(value)}
                </span>
              )}
            </div>
            {/* Connector */}
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full transition-all ${
                  completed && (log as any)[steps[i + 1].key]
                    ? step.color
                    : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
