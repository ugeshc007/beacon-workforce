// Scheduled backfill: recomputes and stores the derived daily metrics
// (worked / travel / break / idle / overtime + total_work_minutes) on historical
// attendance_logs so reports read stored numbers instead of recomputing.
//
// Safety properties (this runs unattended from cron):
//   * bounded work per run  — MAX_DATES_PER_RUN dates / MAX_ROWS_PER_RUN rows
//   * single-flight lock    — lease row in backfill_jobs with an expiry
//   * idempotent progress   — derived_computed_at per row + cursor_date per job
//   * paused guard          — exits immediately while the job row is paused
//
// Manual use: POST {"reset": true} to restart from today, {"date": "YYYY-MM-DD"}
// to recompute a single day, {"resume": true} to clear a pause.
import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";
import { computeDerivedMetrics, type MetricSession } from "../_shared/derived-metrics.ts";

const JOB_NAME = "derived-attendance-metrics";
const MAX_DATES_PER_RUN = 10;
const MAX_ROWS_PER_RUN = 1500;
const LOCK_TTL_SECONDS = 240;

function dubaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  const supabase = createSupabaseAdmin();
  const runId = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const today = dubaiToday();

  let body: { reset?: boolean; resume?: boolean; date?: string } = {};
  try {
    body = req.method === "POST" ? ((await req.json()) ?? {}) : {};
  } catch {
    body = {};
  }

  try {
    const { data: job, error: jobErr } = await supabase
      .from("backfill_jobs")
      .select("*")
      .eq("job_name", JOB_NAME)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return errorResponse("backfill job row missing", 500);

    // Paused guard — cron keeps firing regardless of job state.
    if (job.is_paused && !body.resume) {
      return jsonResponse({ status: "paused", reason: job.pause_reason });
    }
    if (body.resume && job.is_paused) {
      await supabase.from("backfill_jobs")
        .update({ is_paused: false, pause_reason: null, last_error: null })
        .eq("id", job.id);
    }

    // Single-flight lock: only claim when free or the lease has expired.
    const { data: locked, error: lockErr } = await supabase
      .from("backfill_jobs")
      .update({
        lock_owner: runId,
        lock_expires_at: new Date(Date.now() + LOCK_TTL_SECONDS * 1000).toISOString(),
        last_run_at: nowIso,
      })
      .eq("id", job.id)
      .or(`lock_expires_at.is.null,lock_expires_at.lt.${nowIso}`)
      .select("id")
      .maybeSingle();
    if (lockErr) throw lockErr;
    if (!locked) return jsonResponse({ status: "already_running" });

    const release = (patch: Record<string, unknown>) =>
      supabase.from("backfill_jobs")
        .update({ lock_owner: null, lock_expires_at: null, ...patch })
        .eq("id", job.id);

    try {
      // ── Which dates to process this run ────────────────────────────────
      let dates: string[];
      let cursor = job.cursor_date as string | null;
      let complete = false;

      if (body.date) {
        dates = [body.date];
      } else {
        if (body.reset || !cursor) cursor = today;

        const { data: pending, error: pendErr } = await supabase
          .from("attendance_logs")
          .select("date")
          .lte("date", cursor)
          .is("derived_computed_at", null)
          .order("date", { ascending: false })
          .limit(MAX_ROWS_PER_RUN);
        if (pendErr) throw pendErr;

        dates = [...new Set((pending ?? []).map((r) => r.date as string))].slice(0, MAX_DATES_PER_RUN);
        if (dates.length === 0) complete = true;
      }

      let rowsProcessed = 0;
      const perDate: Record<string, number> = {};

      for (const date of dates) {
        const { data: logs, error: logsErr } = await supabase
          .from("attendance_logs")
          .select(
            "id, employee_id, date, office_punch_in, office_punch_out, travel_start_time, site_arrival_time, work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, return_travel_start_time, office_arrival_time, total_work_minutes",
          )
          .eq("date", date);
        if (logsErr) throw logsErr;
        if (!logs?.length) {
          perDate[date] = 0;
          continue;
        }

        const logIds = logs.map((l) => l.id as string);
        const employeeIds = [...new Set(logs.map((l) => l.employee_id as string))];

        const { data: sessions, error: sessErr } = await supabase
          .from("project_work_sessions")
          .select(
            "attendance_log_id, travel_start_time, site_arrival_time, work_start_time, work_end_time, break_start_time, break_end_time, break_minutes, return_travel_start_time, office_arrival_time, total_work_minutes",
          )
          .in("attendance_log_id", logIds);
        if (sessErr) throw sessErr;

        const { data: employees, error: empErr } = await supabase
          .from("employees")
          .select("id, standard_hours_per_day")
          .in("id", employeeIds);
        if (empErr) throw empErr;

        const stdHours = new Map(
          (employees ?? []).map((e) => [e.id as string, Number(e.standard_hours_per_day) || 8]),
        );
        const byLog = new Map<string, MetricSession[]>();
        for (const s of sessions ?? []) {
          const key = s.attendance_log_id as string;
          const list = byLog.get(key) ?? [];
          list.push(s as MetricSession);
          byLog.set(key, list);
        }

        const computedAt = new Date().toISOString();
        for (const log of logs) {
          const m = computeDerivedMetrics(
            log,
            byLog.get(log.id as string) ?? [],
            stdHours.get(log.employee_id as string) ?? 8,
          );
          // Never overwrite a manually overridden total_work_minutes with 0.
          const totalWorked = m.worked > 0 ? m.worked : (log.total_work_minutes ?? 0);
          const { error: updErr } = await supabase
            .from("attendance_logs")
            .update({
              derived_worked_minutes: m.worked,
              derived_travel_minutes: m.travel,
              derived_break_minutes: m.breakMinutes,
              derived_idle_minutes: m.idle,
              derived_overtime_minutes: m.overtime,
              derived_computed_at: computedAt,
              total_work_minutes: totalWorked,
            })
            .eq("id", log.id);
          if (updErr) throw updErr;
          rowsProcessed++;
        }
        perDate[date] = logs.length;
      }

      // Cursor walks backwards from the oldest date handled this run.
      const oldest = dates.length ? dates[dates.length - 1] : cursor;
      const nextCursor = body.date
        ? job.cursor_date
        : complete
        ? job.cursor_date
        : addDays(oldest as string, 0);

      await release({
        cursor_date: nextCursor,
        is_complete: complete,
        dates_processed: (job.dates_processed ?? 0) + dates.length,
        rows_processed: (job.rows_processed ?? 0) + rowsProcessed,
        last_error: null,
      });

      return jsonResponse({
        status: complete ? "up_to_date" : "processed",
        dates,
        rows_processed: rowsProcessed,
        per_date: perDate,
        cursor_date: nextCursor,
      });
    } catch (inner) {
      const message = inner instanceof Error ? inner.message : String(inner);
      // Persist the failure so operators see it; leave the job runnable so the
      // next scheduled run retries the same (idempotent) batch.
      await release({ last_error: message });
      return errorResponse(message, 500);
    }
  } catch (e) {
    return errorResponse(e, 500);
  }
});
