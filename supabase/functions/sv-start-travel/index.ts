import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, dateFromTimestamp, resolveTimestamp, checkIdempotency, recordIdempotencyResult, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, site_visit_id, lat, lng, client_timestamp, idempotency_key } = await req.json();
    if (!employee_id || !site_visit_id) {
      return errorResponse("employee_id, site_visit_id required");
    }
    const hasGps = lat != null && lng != null;

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "sv-start-travel");
    if (dup) return dup;

    const now = resolveTimestamp(client_timestamp);
    const today = dateFromTimestamp(now);

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

    // Sequential rule: no other open site-visit session
    const { data: activeSv } = await supabase
      .from("site_visit_work_sessions")
      .select("id, site_visit_id, travel_start_time")
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .maybeSingle();
    if (activeSv) {
      if (activeSv.site_visit_id === site_visit_id) {
        // Treat replay as success
        const out = { success: true, session_id: activeSv.id, timestamp: activeSv.travel_start_time, deduped: true };
        await recordIdempotencyResult(supabase, idempotency_key, out);
        return jsonResponse(out);
      }
      return errorResponse("Finish your current site visit before starting another", 409);
    }

    // Also block if a project session is open
    const { data: activeProj } = await supabase
      .from("project_work_sessions")
      .select("id")
      .eq("employee_id", employee_id)
      .is("work_end_time", null)
      .maybeSingle();
    if (activeProj) return errorResponse("Finish your active project before starting a site visit", 409);

    const { data: visit } = await supabase
      .from("site_visits")
      .select("id, assigned_employee_id, status")
      .eq("id", site_visit_id)
      .maybeSingle();
    if (!visit) return errorResponse("Site visit not found", 404);
    if (visit.assigned_employee_id !== employee_id) return errorResponse("Not assigned to this site visit", 403);
    if (visit.status === "completed" || visit.status === "cancelled" || visit.status === "converted") {
      return errorResponse("Visit is already closed", 400);
    }

    const { data: inserted, error } = await supabase
      .from("site_visit_work_sessions")
      .insert({
        employee_id,
        site_visit_id,
        date: today,
        attendance_log_id: log.id,
        travel_start_time: now,
        travel_start_lat: hasGps ? lat : null,
        travel_start_lng: hasGps ? lng : null,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error) return errorResponse(error.message, 500);

    await supabase.from("site_visits").update({ status: "in_progress" }).eq("id", site_visit_id);

    const out = { success: true, session_id: inserted.id, timestamp: now };
    await recordIdempotencyResult(supabase, idempotency_key, out);
    return jsonResponse(out);
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
