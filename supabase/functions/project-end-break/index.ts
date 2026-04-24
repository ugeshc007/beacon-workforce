import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id } = await req.json();
    if (!employee_id || !session_id) return errorResponse("employee_id, session_id required");

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = nowTimestamp();

    const { data: session } = await supabase
      .from("project_work_sessions")
      .select("break_start_time, break_minutes")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);

    let addBreak = 0;
    if (session.break_start_time) {
      addBreak = Math.max(0, Math.round((new Date(now).getTime() - new Date(session.break_start_time).getTime()) / 60000));
    }

    const { error } = await supabase
      .from("project_work_sessions")
      .update({
        break_end_time: now,
        break_minutes: (session.break_minutes ?? 0) + addBreak,
      })
      .eq("id", session_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, timestamp: now, added_break_minutes: addBreak });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
