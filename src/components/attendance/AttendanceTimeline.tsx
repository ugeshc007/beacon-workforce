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

// Distinct colors for project session dots (cycled)
const sessionColors = [
  "bg-sky-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-pink-400",
];

export function AttendanceTimeline({ log }: Props) {
  // Find the last completed step
  let lastCompleted = -1;
  for (let i = steps.length - 1; i >= 0; i--) {
    if ((log as any)[steps[i].key]) {
      lastCompleted = i;
      break;
    }
  }

  const sessions = (log.sessions ?? []).filter((s) => s.work_start_time || s.work_end_time);

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-0.5 w-full">
        {steps.map((step, i) => {
          const value = (log as any)[step.key] as string | null;
          const completed = !!value;
          const isActive = i === lastCompleted && !log.office_punch_out;

          return (
            <div key={step.key} className="flex items-center gap-0.5 flex-1 min-w-0">
              <div className="relative flex items-center justify-center shrink-0" title={`${step.label}: ${fmt(value) ?? "—"}`}>
                <div
                  className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                    completed ? `${step.color} border-transparent` : "bg-transparent border-muted-foreground/30"
                  } ${isActive ? "ring-2 ring-brand/30 ring-offset-1 ring-offset-background" : ""}`}
                />
                {completed && (
                  <span className="absolute -bottom-4 text-[8px] text-muted-foreground font-mono whitespace-nowrap">
                    {fmt(value)}
                  </span>
                )}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-all ${
                    completed && (log as any)[steps[i + 1].key] ? step.color : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Per-project session dots (start → end) */}
      {sessions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap pt-4">
          {sessions.map((s, idx) => {
            const color = sessionColors[idx % sessionColors.length];
            return (
              <div
                key={s.id}
                className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2 py-0.5"
                title={`${s.project_name ?? "Project"}: ${fmt(s.work_start_time) ?? "—"} → ${fmt(s.work_end_time) ?? "…"}`}
              >
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <span className="text-[9px] font-medium text-foreground truncate max-w-[80px]">
                  {s.project_name ?? "Project"}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground">
                  {fmt(s.work_start_time) ?? "—"}
                </span>
                <span className={`h-2 w-2 rounded-full ${s.work_end_time ? color : "border border-muted-foreground/40 bg-transparent"}`} />
                <span className="text-[9px] font-mono text-muted-foreground">
                  {fmt(s.work_end_time) ?? "…"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
