import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate, nowTimestamp, authenticateEmployee } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { employee_id, leg_id, leg_type, lat, lng } = await req.json();
    if (!employee_id || !leg_id || !leg_type || lat == null || lng == null) {
      return errorResponse("employee_id, leg_id, leg_type, lat, lng required");
    }
    if (!["drop_off", "pick_up", "wait"].includes(leg_type)) {
      return errorResponse("leg_type must be drop_off, pick_up or wait");
    }

    const supabase = createSupabaseAdmin();
    const auth = await authenticateEmployee(req, supabase, employee_id);
    if (auth.error) return auth.error;

    const today = todayDate();
    const now = nowTimestamp();

    const { data: leg } = await supabase
      .from("driver_trip_legs")
      .select("id, driver_id, status, travel_start_time")
      .eq("id", leg_id)
      .eq("driver_id", employee_id)
      .eq("date", today)
      .maybeSingle();
    if (!leg) return errorResponse("Trip leg not found", 404);
    if (leg.status !== "traveling") return errorResponse("Leg is not in travel state", 400);

    const travelMin = leg.travel_start_time
      ? Math.max(0, Math.round((new Date(now).getTime() - new Date(leg.travel_start_time).getTime()) / 60000))
      : 0;

    const { error } = await supabase
      .from("driver_trip_legs")
      .update({
        site_arrival_time: now,
        site_arrival_lat: lat,
        site_arrival_lng: lng,
        leg_type,
        total_travel_minutes: travelMin,
        status: "on_site",
      })
      .eq("id", leg_id);

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ success: true, timestamp: now, travel_minutes: travelMin });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
