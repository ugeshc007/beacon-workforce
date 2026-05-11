import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, leg_id, lat, lng } = await req.json();
    if (!employee_id || !leg_id || lat == null || lng == null) {
      return errorResponse("employee_id, leg_id, lat, lng required");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    const { data: leg } = await supabase
      .from("driver_trip_legs")
      .select("id, driver_id, status, site_arrival_time")
      .eq("id", leg_id)
      .eq("driver_id", employee_id)
      .eq("date", today)
      .maybeSingle();
    if (!leg) return errorResponse("Trip leg not found", 404);
    if (leg.status !== "on_site") return errorResponse("Leg is not on-site", 400);

    const onsiteMin = leg.site_arrival_time
      ? Math.max(0, Math.round((new Date(now).getTime() - new Date(leg.site_arrival_time).getTime()) / 60000))
      : 0;

    const { error } = await supabase
      .from("driver_trip_legs")
      .update({
        leg_end_time: now,
        leg_end_lat: lat,
        leg_end_lng: lng,
        total_onsite_minutes: onsiteMin,
        status: "completed",
      })
      .eq("id", leg_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, timestamp: now, onsite_minutes: onsiteMin });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
