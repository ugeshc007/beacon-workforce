// End-of-day closer: any scheduled task/shift left unfinished for a past day is
// closed as "incomplete process" so nothing carries forward to the next day.
// Intended to run from cron shortly after midnight (Dubai) but safe to call
// manually — it is idempotent and only touches days before today (Dubai).
import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

function dubaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

/**
 * A shift/session is only auto-closed when nothing has happened on it for this
 * long. Without this guard a night shift that is still being worked on right
 * now (e.g. punched in at 22:00, still on site at 00:30) gets force-closed at
 * the date boundary, which splits the shift and leaves a record the employee
 * can never punch out of.
 */
const IDLE_HOURS_BEFORE_CLOSE = 9;

function isIdle(timestamps: (string | null | undefined)[], nowMs: number): boolean {
  const last = timestamps
    .filter(Boolean)
    .map((t) => new Date(t as string).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  if (last == null) return true; // nothing recorded at all — safe to close
  return nowMs - last > IDLE_HOURS_BEFORE_CLOSE * 60 * 60 * 1000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = dubaiToday();
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const result = {
      date_boundary: today,
      logs_closed: 0,
      logs_absent: 0,
      logs_skipped_active: 0,
      project_sessions_closed: 0,
      project_sessions_skipped_active: 0,
      site_visit_sessions_closed: 0,
      common_task_sessions_closed: 0,
    };

    // ── 1. Open attendance logs from previous days ──
    const { data: logs, error: logsErr } = await supabase
      .from("attendance_logs")
      .select(
        "id, date, office_punch_in, travel_start_time, site_arrival_time, work_start_time, work_end_time, break_start_time, break_end_time, return_travel_start_time, office_arrival_time, notes"
      )
      .lt("date", today)
      .is("office_punch_out", null);
    if (logsErr) throw logsErr;

    for (const log of logs ?? []) {
      // Skip shifts that are still being worked on right now (log itself or any
      // of its sessions had activity within the idle window).
      const { data: logSessions } = await supabase
        .from("project_work_sessions")
        .select("travel_start_time, site_arrival_time, work_start_time, break_start_time, break_end_time, work_end_time, return_travel_start_time, office_arrival_time")
        .eq("attendance_log_id", log.id);

      const activity: (string | null | undefined)[] = [
        log.office_punch_in, log.travel_start_time, log.site_arrival_time,
        log.work_start_time, log.break_start_time, log.break_end_time,
        log.work_end_time, log.return_travel_start_time, log.office_arrival_time,
      ];
      for (const s of logSessions ?? []) {
        activity.push(
          s.travel_start_time, s.site_arrival_time, s.work_start_time,
          s.break_start_time, s.break_end_time, s.work_end_time,
          s.return_travel_start_time, s.office_arrival_time
        );
      }

      if (log.office_punch_in && !isIdle(activity, nowMs)) {
        result.logs_skipped_active++;
        continue;
      }

      const closeAt =
        log.office_arrival_time ??
        log.return_travel_start_time ??
        log.work_end_time ??
        log.office_punch_in ??
        nowIso;



      if (!log.office_punch_in) {
        // Never punched in — the scheduled task simply did not happen.
        await supabase
          .from("attendance_logs")
          .update({
            office_punch_in: closeAt,
            office_punch_out: closeAt,
            is_absent: true,
            is_incomplete_process: false,
            notes: log.notes ?? "Auto-closed at end of day — no punch-in recorded",
          })
          .eq("id", log.id);
        result.logs_absent++;
        continue;
      }

      await supabase
        .from("attendance_logs")
        .update({
          office_punch_out: closeAt,
          work_end_time: log.work_end_time ?? closeAt,
          return_travel_start_time: log.return_travel_start_time ?? closeAt,
          office_arrival_time: log.office_arrival_time ?? closeAt,
          is_incomplete_process: true,
          notes: log.notes ?? "Auto-closed at end of day — workflow left incomplete",
        })
        .eq("id", log.id);
      result.logs_closed++;
    }

    // ── 2. Open project work sessions from previous days ──
    const { data: pws } = await supabase
      .from("project_work_sessions")
      .select("id, work_start_time, break_start_time, break_minutes, site_arrival_time, travel_start_time")
      .lt("date", today)
      .is("work_end_time", null);

    for (const s of pws ?? []) {
      // Still in progress right now? leave it alone.
      if (!isIdle([s.travel_start_time, s.site_arrival_time, s.work_start_time, s.break_start_time], nowMs)) {
        result.project_sessions_skipped_active++;
        continue;
      }
      const closeAt = s.work_start_time ?? s.site_arrival_time ?? s.travel_start_time ?? nowIso;

      const update: Record<string, unknown> = {
        work_end_time: closeAt,
        status: "incomplete",
        notes: "Auto-closed at end of day — task left incomplete",
      };
      if (s.break_start_time) update.break_end_time = closeAt;
      await supabase.from("project_work_sessions").update(update).eq("id", s.id);
      result.project_sessions_closed++;
    }

    // ── 3. Open site-visit work sessions from previous days ──
    const { data: svws } = await supabase
      .from("site_visit_work_sessions")
      .select("id, work_start_time, site_arrival_time, travel_start_time, break_start_time")
      .lt("date", today)
      .is("work_end_time", null);

    for (const s of svws ?? []) {
      const closeAt = s.work_start_time ?? s.site_arrival_time ?? s.travel_start_time ?? nowIso;
      const update: Record<string, unknown> = {
        work_end_time: closeAt,
        status: "incomplete",
        notes: "Auto-closed at end of day — visit left incomplete",
      };
      if (s.break_start_time) update.break_end_time = closeAt;
      await supabase.from("site_visit_work_sessions").update(update).eq("id", s.id);
      result.site_visit_sessions_closed++;
    }

    // ── 4. Open common-task sessions from previous days ──
    const { data: cts } = await supabase
      .from("common_task_sessions")
      .select("id, work_start_time, break_start_time")
      .lt("date", today)
      .is("work_end_time", null);

    for (const s of cts ?? []) {
      const closeAt = s.work_start_time ?? nowIso;
      const update: Record<string, unknown> = {
        work_end_time: closeAt,
        status: "incomplete",
        notes: "Auto-closed at end of day — task left incomplete",
      };
      if (s.break_start_time) update.break_end_time = closeAt;
      await supabase.from("common_task_sessions").update(update).eq("id", s.id);
      result.common_task_sessions_closed++;
    }

    return jsonResponse({ success: true, ...result });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
