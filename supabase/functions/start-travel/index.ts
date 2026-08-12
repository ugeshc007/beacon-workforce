import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, dateFromTimestamp, nowTimestamp, resolveTimestamp, checkIdempotency, authenticateEmployee, findOpenAttendanceLog } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, client_timestamp, idempotency_key, lat, lng } = await req.json();

    if (!employee_id) {
      return errorResponse("employee_id is required");
    }

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = resolveTimestamp(client_timestamp);
    // Derive the shift date from the punch/action time so a late-night action
    // synced after midnight stays on its own day.
    const today = dateFromTimestamp(now);
    const dup = await checkIdempotency(supabase, idempotency_key, employee_id, "start-travel");
    if (dup) return dup;

    const { data: mandatorySetting } = await supabase
      .from("settings").select("value").eq("key", "office_punch_in_mandatory").maybeSingle();
    const officeMandatory = (mandatorySetting?.value ?? "") === "true";

    let log = await findOpenAttendanceLog(
      supabase,
      employee_id,
      "id, date, office_punch_in, travel_start_time, work_end_time, office_punch_out",
      now
    );

    if (!log) {
      if (officeMandatory) return errorResponse("Must punch in at office first", 400);
      const { data: created, error: createErr } = await supabase
        .from("attendance_logs").insert({ employee_id, date: today })
        .select("id, date, office_punch_in, travel_start_time, work_end_time, office_punch_out").single();
      if (createErr) return errorResponse(createErr.message, 500);
      log = created as typeof log;
    } else if (officeMandatory && !log.office_punch_in) {
      return errorResponse("Must punch in at office first", 400);
    }
    if (log.office_punch_out) return errorResponse("Already punched out for the day", 400);
    if (log.travel_start_time) return errorResponse("Travel already started", 400);

    const { error } = await supabase
      .from("attendance_logs")
      .update({
        travel_start_time: now,
        ...(lat != null && lng != null ? { travel_start_lat: lat, travel_start_lng: lng } : {}),
      })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
