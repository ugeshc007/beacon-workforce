// Self-serve close-out for stale shifts (employee forgot to punch out).
// Two modes:
//   - "complete": ensure return travel + arrive office + punch out are set; closes any open project sessions.
//   - "forfeit":  user admits they cannot reconstruct travel-back; we close the shift using the best available timestamp.
// Always idempotent: if office_punch_out is already set, returns success.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Body = {
  attendance_log_id: string;
  mode: "complete" | "forfeit" | "incomplete" | "absent";
  client_timestamp?: string; // ISO, optional override for forfeit/incomplete close time
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const admin = createClient(url, serviceKey);

    const { data: authData, error: authErr } = await userClient.auth.getUser();
    if (authErr || !authData?.user) return json({ error: "Unauthorized" }, 401);
    const authId = authData.user.id;

    const body = (await req.json()) as Body;
    if (!body?.attendance_log_id || !["complete", "forfeit", "incomplete"].includes(body.mode)) {
      return json({ error: "attendance_log_id and mode required" }, 400);
    }

    // Resolve the requesting employee
    const { data: emp } = await admin
      .from("employees")
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    if (!emp) return json({ error: "Employee not found" }, 404);

    const { data: log } = await admin
      .from("attendance_logs")
      .select("id, employee_id, date, office_punch_in, work_end_time, office_arrival_time, return_travel_start_time, office_punch_out")
      .eq("id", body.attendance_log_id)
      .maybeSingle();
    if (!log) return json({ error: "Log not found" }, 404);
    if (log.employee_id !== emp.id) return json({ error: "Not your shift" }, 403);

    // Already closed — no-op success
    if (log.office_punch_out) {
      return json({ success: true, deduped: true, office_punch_out: log.office_punch_out });
    }

    // Guard: allow closure when either the shift is dated before today (UAE) OR
    // more than 24 hours have passed since punch-in. That covers same-UAE-day
    // shifts where the employee punched in yesterday evening and is still open.
    const todayUAE = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Dubai" }))
      .toISOString().slice(0, 10);
    const punchedInAgeMs = log.office_punch_in
      ? Date.now() - new Date(log.office_punch_in).getTime()
      : 0;
    const isStale = log.date < todayUAE || punchedInAgeMs > 24 * 60 * 60 * 1000;
    if (!isStale) {
      return json({ error: "This action is only for shifts from previous days or older than 24 hours. Use the normal punch-out for today." }, 400);
    }

    if (body.mode === "complete") {
      if (!log.return_travel_start_time || !log.office_arrival_time) {
        return json({
          error: "Complete the return-travel and arrive-office steps first, then punch out.",
        }, 400);
      }
      // Fall through to set office_punch_out below
    }

    // Pick the close timestamp
    const fallback = log.office_arrival_time
      ?? log.return_travel_start_time
      ?? log.work_end_time
      ?? log.office_punch_in
      ?? new Date().toISOString();
    const closeAt = body.client_timestamp ?? fallback;

    // Close the attendance log
    const update: Record<string, unknown> = {
      office_punch_out: closeAt,
      auto_closed_by_user: true,
    };
    if (body.mode === "forfeit") {
      update.notes = "Self-closed stale shift (forfeit)";
      update.is_incomplete_process = true;
    }
    if (body.mode === "incomplete") {
      update.notes = "Auto-completed after 24h with missing workflow steps";
      update.is_incomplete_process = true;
      // Backfill any missing intermediate timestamps with the close time so
      // downstream reports do not divide by null.
      if (!log.work_end_time) update.work_end_time = closeAt;
      if (!log.return_travel_start_time) update.return_travel_start_time = closeAt;
      if (!log.office_arrival_time) update.office_arrival_time = closeAt;
    }
    const { error: updErr } = await admin
      .from("attendance_logs")
      .update(update)
      .eq("id", log.id);
    if (updErr) return json({ error: updErr.message }, 500);

    // Close any still-open project sessions tied to this shift
    const { data: openSessions } = await admin
      .from("project_work_sessions")
      .select("id, work_start_time, work_end_time")
      .eq("attendance_log_id", log.id)
      .is("work_end_time", null);

    if (openSessions && openSessions.length > 0) {
      for (const s of openSessions) {
        await admin
          .from("project_work_sessions")
          .update({ work_end_time: closeAt })
          .eq("id", s.id);
      }
    }

    return json({ success: true, office_punch_out: closeAt, mode: body.mode });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
