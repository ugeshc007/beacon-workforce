import type { AttendanceLog } from "@/hooks/useAttendance";

interface Props {
  log: AttendanceLog;
}

const fmt = (ts: string | null) => {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
};

type Dot = {
  key: string;
  label: string;
  color: string;
  time: string | null;
};

// Distinct colors for project session dots (cycled)
const sessionColors = [
  "bg-sky-400",
  "bg-violet-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-pink-400",
];

export function AttendanceTimeline({ log }: Props) {
  const sessions = (log.sessions ?? []).filter((s) => s.work_start_time || s.break_start_time || s.break_end_time || s.work_end_time);
  // Prefer an active (open) session break so an ongoing break shows immediately,
  // even if the attendance_log still reflects a previously-finished break.
  const openBreakSession = sessions.find((s) => s.break_start_time && !s.break_end_time);
  const anyBreakStartSession = sessions.find((s) => s.break_start_time);
  const anyBreakEndSession = sessions.find((s) => s.break_end_time);
  const breakStartTime = openBreakSession?.break_start_time
    ?? log.break_start_time
    ?? anyBreakStartSession?.break_start_time
    ?? null;
  const breakEndTime = openBreakSession
    ? null
    : (log.break_end_time ?? anyBreakEndSession?.break_end_time ?? null);

  // For single-session days (typical inhouse / one-project day), fall back to
  // the session's work_start_time / work_end_time when the attendance_log row
  // does not mirror them — otherwise the pipeline shows blank dots even
  // though the employee already started/ended work.
  const singleSession = sessions.length === 1 ? sessions[0] : null;
  const workStartTime = log.work_start_time ?? singleSession?.work_start_time ?? null;
  const workEndTime = log.work_end_time ?? singleSession?.work_end_time ?? null;

  // Build a single ordered list of dots. When the employee has multiple project
  // sessions in the same day, replace the single Work Start / Work End dots
  // with per-session start+end pairs (color-coded) so the whole day fits on
  // ONE line.
  const dots: Dot[] = [
    { key: "office_punch_in", label: "Punch In", color: "bg-brand", time: log.office_punch_in },
    { key: "travel_start_time", label: "Travel", color: "bg-status-traveling", time: log.travel_start_time },
    { key: "site_arrival_time", label: "On Site", color: "bg-status-present", time: log.site_arrival_time },
  ];

  if (sessions.length > 1) {
    sessions.forEach((s, idx) => {
      const color = sessionColors[idx % sessionColors.length];
      const name = s.project_name ?? `Project ${idx + 1}`;
      dots.push({
        key: `s-${s.id}-start`,
        label: `${name} — Start`,
        color,
        time: s.work_start_time,
      });
      dots.push({
        key: `s-${s.id}-end`,
        label: `${name} — End`,
        color,
        time: s.work_end_time,
      });
    });
  } else {
    dots.push({ key: "work_start_time", label: "Working", color: "bg-status-present", time: workStartTime });
    dots.push({ key: "work_end_time", label: "Work End", color: "bg-status-overtime", time: workEndTime });
  }

  // Break + tail
  dots.splice(
    sessions.length > 1 ? 3 + sessions.length * 2 : 5,
    0,
  );
  // Insert break dots right after the first work_start dot for the single-session case;
  // for multi-session, keep break dots at the end of session block.
  const breakDots: Dot[] = [
    { key: "break_start_time", label: "Break Start", color: "bg-orange-400", time: breakStartTime },
    { key: "break_end_time", label: "Break End", color: "bg-status-present", time: breakEndTime },
  ];
  if (sessions.length > 1) {
    // place break dots after sessions block (index = 3 + sessions*2)
    dots.splice(3 + sessions.length * 2, 0, ...breakDots);
  } else {
    // place after Working dot (index 4), before Work End (currently at index 4)
    dots.splice(4, 0, ...breakDots);
  }

  dots.push(
    { key: "return_travel_start_time", label: "Returning", color: "bg-status-traveling", time: (log as any).return_travel_start_time ?? null },
    { key: "office_arrival_time", label: "At Office", color: "bg-brand", time: (log as any).office_arrival_time ?? null },
    { key: "office_punch_out", label: "Punch Out", color: "bg-muted-foreground", time: log.office_punch_out },
  );

  // Find the last completed dot for "active" ring
  let lastCompleted = -1;
  for (let i = dots.length - 1; i >= 0; i--) {
    if (dots[i].time) {
      lastCompleted = i;
      break;
    }
  }

  return (
    <div className="flex items-center gap-0.5 w-full">
      {dots.map((d, i) => {
        const completed = !!d.time;
        const isActive = i === lastCompleted && !log.office_punch_out;
        const nextCompleted = i < dots.length - 1 && !!dots[i + 1].time;

        return (
          <div key={d.key} className="flex items-center gap-0.5 flex-1 min-w-0">
            <div
              className="relative flex items-center justify-center shrink-0"
              title={`${d.label}: ${fmt(d.time) ?? "—"}`}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full border-2 transition-all ${
                  completed ? `${d.color} border-transparent` : "bg-transparent border-muted-foreground/30"
                } ${isActive ? "ring-2 ring-brand/30 ring-offset-1 ring-offset-background" : ""}`}
              />
              {completed && (
                <span className="absolute -bottom-4 text-[8px] text-muted-foreground font-mono whitespace-nowrap">
                  {fmt(d.time)}
                </span>
              )}
            </div>
            {i < dots.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full transition-all ${
                  completed && nextCompleted ? d.color : "bg-muted-foreground/20"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
