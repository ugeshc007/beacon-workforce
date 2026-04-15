import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id } = await req.json();
    if (!employee_id) return errorResponse("employee_id is required");

    const supabase = createSupabaseAdmin();

    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    const { data: log } = await supabase
      .from("attendance_logs")
      .select("id")
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!log) return errorResponse("Must punch in first", 400);

    const { error } = await supabase
      .from("attendance_logs")
      .update({ break_start_time: now })
      .eq("id", log.id);

    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, attendance_id: log.id, timestamp: now });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
