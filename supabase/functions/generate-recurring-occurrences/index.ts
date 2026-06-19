import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

// Generates project_assignments + recurring_job_occurrences for active recurring jobs
// for the next N days. Idempotent: skips dates that already have an occurrence.
//
// POST body (optional):
//   { recurring_job_id?: string, days_ahead?: number }
//
// Cron: runs daily at 01:00 UAE.

interface RecurringJob {
  id: string;
  company_id: string;
  branch_id: string | null;
  project_id: string | null;
  client_name: string;
  site_name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  frequency: "daily" | "weekly" | "monthly" | "custom";
  days_of_week: number[] | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string;
  end_time: string;
  headcount: number;
  color: string | null;
  skip_holidays: boolean;
  status: "active" | "paused" | "ended";
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function matchesFrequency(job: RecurringJob, d: Date): boolean {
  const dow = d.getUTCDay(); // 0=Sun..6=Sat
  const dom = d.getUTCDate();
  switch (job.frequency) {
    case "daily":
      return true;
    case "weekly":
    case "custom":
      return (job.days_of_week ?? []).includes(dow);
    case "monthly":
      return job.day_of_month != null && job.day_of_month === dom;
    default:
      return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    let body: { recurring_job_id?: string; days_ahead?: number } = {};
    try { body = await req.json(); } catch { /* no body */ }

    const daysAhead = Math.min(Math.max(body.days_ahead ?? 14, 1), 60);

    // Load active recurring jobs (optionally a single one)
    let query = supabase.from("recurring_jobs").select("*").eq("status", "active");
    if (body.recurring_job_id) query = query.eq("id", body.recurring_job_id);
    const { data: jobs, error: jobsErr } = await query;
    if (jobsErr) throw jobsErr;
    if (!jobs?.length) return jsonResponse({ generated: 0, jobs: 0 });

    // Holiday list (date strings)
    const todayStr = ymd(new Date());
    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + daysAhead);
    const horizonStr = ymd(horizon);

    const { data: holidays } = await supabase
      .from("public_holidays")
      .select("date")
      .gte("date", todayStr)
      .lte("date", horizonStr);
    const holidaySet = new Set((holidays ?? []).map((h: { date: string }) => h.date));

    let totalGenerated = 0;

    for (const job of jobs as RecurringJob[]) {
      // Ensure shadow project exists
      let projectId = job.project_id;
      if (!projectId) {
        // Resolve branch_id (fallback to first branch of company)
        let branchId = job.branch_id;
        if (!branchId) {
          const { data: br } = await supabase
            .from("branches")
            .select("id")
            .eq("company_id", job.company_id)
            .limit(1)
            .maybeSingle();
          branchId = br?.id ?? null;
        }
        if (!branchId) {
          console.error("no branch available for job", job.id);
          continue;
        }
        const projName = `[Recurring] ${job.client_name}${job.site_name ? ` – ${job.site_name}` : ""}`;
        const { data: newProj, error: pErr } = await supabase
          .from("projects")
          .insert({
            name: projName,
            client_name: job.client_name,
            company_id: job.company_id,
            branch_id: branchId,
            status: "in_progress",
            site_address: job.address,
            site_latitude: job.lat,
            site_longitude: job.lng,
          })
          .select("id")
          .single();
        if (pErr) {
          console.error("project create failed for job", job.id, pErr);
          continue;
        }
        projectId = newProj!.id;
        await supabase.from("recurring_jobs").update({ project_id: projectId, branch_id: branchId }).eq("id", job.id);
      }


      // Default crew
      const { data: crew } = await supabase
        .from("recurring_job_employees")
        .select("employee_id")
        .eq("recurring_job_id", job.id);
      const employeeIds = (crew ?? []).map((c: { employee_id: string }) => c.employee_id);
      if (!employeeIds.length) continue;

      // Existing occurrences in horizon
      const { data: existingOcc } = await supabase
        .from("recurring_job_occurrences")
        .select("occurrence_date")
        .eq("recurring_job_id", job.id)
        .gte("occurrence_date", todayStr)
        .lte("occurrence_date", horizonStr);
      const existingDates = new Set((existingOcc ?? []).map((o: { occurrence_date: string }) => o.occurrence_date));

      // Employee leaves in horizon
      const { data: leaves } = await supabase
        .from("employee_leave")
        .select("employee_id, start_date, end_date")
        .in("employee_id", employeeIds)
        .lte("start_date", horizonStr)
        .gte("end_date", todayStr);

      const onLeave = (empId: string, dateStr: string) =>
        (leaves ?? []).some(
          (l: { employee_id: string; start_date: string; end_date: string }) =>
            l.employee_id === empId && l.start_date <= dateStr && l.end_date >= dateStr,
        );

      const startDate = new Date(`${job.start_date}T00:00:00Z`);
      const endDate = job.end_date ? new Date(`${job.end_date}T00:00:00Z`) : null;

      for (let i = 0; i < daysAhead; i++) {
        const d = new Date();
        d.setUTCHours(0, 0, 0, 0);
        d.setUTCDate(d.getUTCDate() + i);
        const dateStr = ymd(d);

        if (d < startDate) continue;
        if (endDate && d > endDate) continue;
        if (!matchesFrequency(job, d)) continue;
        if (existingDates.has(dateStr)) continue;
        if (job.skip_holidays && holidaySet.has(dateStr)) {
          await supabase.from("recurring_job_occurrences").insert({
            recurring_job_id: job.id,
            occurrence_date: dateStr,
            status: "skipped",
            notes: "Public holiday",
          });
          continue;
        }

        // Insert assignment for each crew member not on leave
        let inserted = 0;
        for (const empId of employeeIds) {
          if (onLeave(empId, dateStr)) continue;

          // Skip if employee already has an assignment that day on this project
          const { data: dup } = await supabase
            .from("project_assignments")
            .select("id")
            .eq("project_id", projectId)
            .eq("employee_id", empId)
            .eq("date", dateStr)
            .maybeSingle();
          if (dup) continue;

          const { error: aErr } = await supabase.from("project_assignments").insert({
            project_id: projectId,
            employee_id: empId,
            date: dateStr,
            shift_start: job.start_time,
            shift_end: job.end_time,
            assignment_mode: "manual",
            assigned_role: "team_member",
          });
          if (!aErr) inserted++;
        }

        await supabase.from("recurring_job_occurrences").insert({
          recurring_job_id: job.id,
          occurrence_date: dateStr,
          status: inserted > 0 ? "scheduled" : "skipped",
          notes: inserted > 0 ? null : "No available crew",
        });
        totalGenerated += inserted;
      }
    }

    return jsonResponse({ jobs: jobs.length, generated: totalGenerated, days_ahead: daysAhead });
  } catch (e) {
    console.error("generate-recurring-occurrences error", e);
    return errorResponse(e, 500);
  }
});
