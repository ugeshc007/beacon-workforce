import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();
  try {
    const { employee_id, session_id, lat, lng, accuracy } = await req.json();
    if (!employee_id || !session_id || lat == null || lng == null) {
      return errorResponse("employee_id, session_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const now = nowTimestamp();

    const { data: session } = await supabase
      .from("site_visit_work_sessions")
      .select("id, work_end_time, return_travel_start_time")
      .eq("id", session_id)
      .eq("employee_id", employee_id)
      .maybeSingle();
    if (!session) return errorResponse("Session not found", 404);
    if (!session.work_end_time) return errorResponse("Finish the site visit first", 400);
    if (session.return_travel_start_time) return errorResponse("Return travel already logged", 409);

    const { error } = await supabase
      .from("site_visit_work_sessions")
      .update({
        return_travel_start_time: now,
        return_travel_start_lat: lat,
        return_travel_start_lng: lng,
        return_travel_start_accuracy: accuracy ?? null,
      })
      .eq("id", session_id);
    if (error) return errorResponse(error.message, 500);

    return jsonResponse({ success: true, timestamp: now });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
