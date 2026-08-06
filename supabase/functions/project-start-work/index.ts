import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, resolveTimestamp, dateFromTimestamp, authenticateEmployee, checkIdempotency, recordIdempotencyResult } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, project_id, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id) return errorResponse("employee_id required");
    if (!session_id && !project_id) return errorResponse("session_id or project_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "project-start-work");
    if (dup) return dup;

    const now = resolveTimestamp(client_timestamp);
    const today = dateFromTimestamp(now);

    // -------- IN-HOUSE PATH: no session yet, create one immediately at "working" state --------
    if (!session_id && project_id) {
      const { data: mandatorySetting } = await supabase
        .from("settings").select("value").eq("key", "office_punch_in_mandatory").maybeSingle();
      const officeMandatory = (mandatorySetting?.value ?? "") === "true";

      const { data: logs } = await supabase
        .from("attendance_logs")
        .select("id, office_punch_in, office_punch_out")
        .eq("employee_id", employee_id)
        .eq("date", today)
        .order("office_punch_out", { ascending: true, nullsFirst: true })
        .limit(1);
      let log = logs?.[0] ?? null;
      if (!log) {
        if (officeMandatory) return errorResponse("Must punch in at office first", 400);
        const { data: created, error: createErr } = await supabase
          .from("attendance_logs").insert({ employee_id, date: today })
          .select("id, office_punch_in").single();
        if (createErr) return errorResponse(createErr.message, 500);
        log = created;
      } else if (officeMandatory && !log.office_punch_in) {
        return errorResponse("Must punch in at office first", 400);
      }

      // Verify assignment for this project today (and read its per-assignment work_location)
      const { data: assignment } = await supabase
        .from("project_assignments")
        .select("id, work_location")
        .eq("employee_id", employee_id)
        .eq("project_id", project_id)
        .eq("date", today)
        .maybeSingle();
      if (!assignment) return errorResponse("No assignment for this project today", 403);

      // Match mobile/admin priority exactly:
      // assignment.work_location → project-day override → project GPS inference.
      // If the schedule explicitly says "site", do not allow the direct
      // in-house Start Work path just because project GPS coords are missing.
      const { data: dayLoc } = await supabase
        .from("project_day_work_locations")
        .select("location")
        .eq("project_id", project_id)
        .eq("date", today)
        .maybeSingle();

      const { data: proj } = await supabase
        .from("projects")
        .select("site_latitude, site_longitude")
        .eq("id", project_id)
        .maybeSingle();

      const inferredLocation = proj && (proj.site_latitude == null || proj.site_longitude == null)
        ? "in_house"
        : "site";
      const effectiveLocation = assignment.work_location ?? dayLoc?.location ?? inferredLocation;
      const isInHouse = effectiveLocation === "in_house";
      if (!isInHouse) {
        return errorResponse(
          "This project is scheduled at site today. Start travel first, then arrive at site before starting work.",
          400,
        );
      }

      // Auto-close any stale open sessions from previous days (>12h old).
      const staleSessionCutoff = new Date(new Date(now).getTime() - 12 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("project_work_sessions")
        .update({ work_end_time: now, status: "completed" })
        .eq("employee_id", employee_id)
        .is("work_end_time", null)
        .lt("date", today)
        .lt("travel_start_time", staleSessionCutoff);

      // Block if another active session today
      const { data: activeToday } = await supabase
        .from("project_work_sessions")
        .select("id, project_id")
        .eq("employee_id", employee_id)
        .eq("date", today)
        .is("work_end_time", null)
        .maybeSingle();
      if (activeToday) {
        if (activeToday.project_id === project_id) {
          // Idempotent: return the existing session
          return jsonResponse({ success: true, session_id: activeToday.id, timestamp: now, resumed: true });
        }
        return errorResponse("Finish your current project before starting another", 409);
      }

      // Create the session pre-filled for in-house (no travel, no site arrival)
      const { data: inserted, error: insertErr } = await supabase
        .from("project_work_sessions")
        .insert({
          employee_id,
          project_id,
          date: today,
          attendance_log_id: log.id,
          work_start_time: now,
          status: "in_progress",
        })
        .select("id")
        .single();
      if (insertErr) return errorResponse(insertErr.message, 500);
      const outIH = { success: true, session_id: inserted.id, timestamp: now };
      await recordIdempotencyResult(supabase, idempotency_key, outIH);
      return jsonResponse(outIH);
    }

    // -------- NORMAL SITE PATH: requires existing session with site_arrival_time --------
    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("id, site_arrival_time, work_start_time, work_end_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (session.work_end_time) return errorResponse("Session already ended", 400);
    if (!session.site_arrival_time) return errorResponse("Must arrive at site before starting work", 400);
    if (session.work_start_time) {
      return jsonResponse({ success: true, timestamp: session.work_start_time, deduped: true });
    }

    const { error } = await supabase
      .from("project_work_sessions")
      .update({ work_start_time: now })
      .eq("id", session_id)
      .eq("employee_id", employee_id);

    if (error) return errorResponse(error.message, 500);
    const outSite = { success: true, timestamp: now };
    await recordIdempotencyResult(supabase, idempotency_key, outSite);
    return jsonResponse(outSite);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
