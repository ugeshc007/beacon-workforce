// Shared helpers for rendering durations safely. Stale/overnight shifts can
// produce absurd raw deltas (e.g. work_start yesterday vs end today) so we
// cap displayed durations and label them clearly instead of showing "862h 19m".

const SANE_MAX_MIN = 18 * 60; // 18h is the longest plausible single step

export function formatSaneDuration(minutes: number | null | undefined): {
  label: string;
  insane: boolean;
} {
  if (minutes == null || Number.isNaN(minutes)) return { label: "—", insane: false };
  const m = Math.max(0, Math.round(minutes));
  if (m > SANE_MAX_MIN) {
    return { label: ">18h • overnight", insane: true };
  }
  const label =
    m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  return { label, insane: false };
}

export function diffMinutes(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
}
