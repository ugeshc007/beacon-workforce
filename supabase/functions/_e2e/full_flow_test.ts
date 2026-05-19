// End-to-end test:
// 1. Creates a fresh employee + auth user
// 2. Creates an in-house project assignment AND a site project assignment for today
// 3. Walks the in-house flow:  punch-in -> project-start-work -> project-end-work -> punch-out
// 4. Walks the site flow:      project-start-travel -> project-arrive-site -> project-start-work
//                              -> project-end-work -> start-return-travel -> arrive-office -> punch-out
//
// Run with: deno test --allow-env --allow-net supabase/functions/_e2e/full_flow_test.ts
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// UAE date (matches helpers.todayDate)
function todayUae(): string {
  const d = new Date(Date.now() + 4 * 3600 * 1000);
  return d.toISOString().split("T")[0];
}

async function callFn(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: res.status, body: json ?? text };
}

Deno.test({ name: "E2E: in-house + site project full flow", sanitizeOps: false, sanitizeResources: false }, async () => {
  const today = todayUae();
  const tag = Math.random().toString(36).slice(2, 8);
  const email = `e2e-${tag}@bebright.test`;
  const password = "Passw0rd!E2E";

  // Dubai branch + Business Bay office
  const branch_id = "b1000000-0000-0000-0000-000000000002";
  const office_lat = 25.18601;
  const office_lng = 55.27385;
  const site_lat   = 25.20000;   // far from office (~2km)
  const site_lng   = 55.28000;

  // -------- 1. Create auth user + employee --------
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr) throw cErr;
  const auth_id = created.user!.id;

  const { data: emp, error: eErr } = await admin.from("employees").insert({
    auth_id,
    branch_id,
    employee_code: `E2E-${tag.toUpperCase()}`,
    name: `E2E ${tag}`,
    email,
    skill_type: "technician",
    is_active: true,
    basic_salary: 3000,
    hourly_rate: 20,
    overtime_rate: 30,
    standard_hours_per_day: 8,
  }).select("id").single();
  if (eErr) throw eErr;
  const employee_id = emp!.id as string;

  // -------- 2. Create two projects + assignments for today --------
  const { data: pIn, error: pInErr } = await admin.from("projects").insert({
    name: `E2E-INHOUSE-${tag}`,
    branch_id,
    status: "in_progress",
    site_latitude: site_lat,
    site_longitude: site_lng,
    site_gps_radius: 100,
    start_date: today,
    end_date: today,
  }).select("id").single();
  if (pInErr) throw pInErr;
  const inhouseProjectId = pIn!.id as string;

  const { data: pSite, error: pSiteErr } = await admin.from("projects").insert({
    name: `E2E-SITE-${tag}`,
    branch_id,
    status: "in_progress",
    site_latitude: site_lat,
    site_longitude: site_lng,
    site_gps_radius: 100,
    start_date: today,
    end_date: today,
  }).select("id").single();
  if (pSiteErr) throw pSiteErr;
  const siteProjectId = pSite!.id as string;

  await admin.from("project_assignments").insert([
    { project_id: inhouseProjectId, employee_id, date: today, assigned_role: "team_member",
      shift_start: "08:00:00", shift_end: "17:00:00", assignment_mode: "manual" },
    { project_id: siteProjectId,    employee_id, date: today, assigned_role: "team_member",
      shift_start: "08:00:00", shift_end: "17:00:00", assignment_mode: "manual" },
  ]);

  // Mark the first project as in_house for today
  await admin.from("project_day_work_locations").insert({
    project_id: inhouseProjectId, date: today, location: "in_house",
  });
  // Site project explicitly set to "site"
  await admin.from("project_day_work_locations").insert({
    project_id: siteProjectId, date: today, location: "site",
  });

  // -------- 3. Sign in to get JWT --------
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: signIn, error: sErr } = await userClient.auth.signInWithPassword({ email, password });
  if (sErr) throw sErr;
  const token = signIn.session!.access_token;

  try {
    // ============================================================
    // PHASE A — punch in at office
    // ============================================================
    const punchIn = await callFn("punch-in", token, {
      employee_id, lat: office_lat, lng: office_lng, accuracy: 10,
    });
    console.log("punch-in:", punchIn.status, punchIn.body);
    assertEquals(punchIn.status, 200, `punch-in failed: ${JSON.stringify(punchIn.body)}`);

    // ============================================================
    // PHASE B — IN-HOUSE flow: start work directly (no travel)
    // ============================================================
    const inhStart = await callFn("project-start-work", token, {
      employee_id, project_id: inhouseProjectId,
    });
    console.log("inhouse start-work:", inhStart.status, inhStart.body);
    assertEquals(inhStart.status, 200, `inhouse start-work failed: ${JSON.stringify(inhStart.body)}`);
    const inhouseSessionId = inhStart.body.session_id as string;

    // sanity: travel_start_time / site_arrival_time should be NULL
    const { data: inhSess } = await admin.from("project_work_sessions")
      .select("travel_start_time, site_arrival_time, work_start_time")
      .eq("id", inhouseSessionId).single();
    console.log("inhouse session row:", inhSess);
    assertEquals(inhSess?.travel_start_time, null, "in-house must NOT have travel_start_time");
    assertEquals(inhSess?.site_arrival_time, null, "in-house must NOT have site_arrival_time");
    if (!inhSess?.work_start_time) throw new Error("in-house must have work_start_time");

    // end work for in-house project
    const inhEnd = await callFn("project-end-work", token, {
      employee_id, session_id: inhouseSessionId,
    });
    console.log("inhouse end-work:", inhEnd.status, inhEnd.body);
    assertEquals(inhEnd.status, 200, `inhouse end-work failed: ${JSON.stringify(inhEnd.body)}`);

    // ============================================================
    // PHASE C — Negative test: site project should REJECT start-work without session
    // ============================================================
    const badStart = await callFn("project-start-work", token, {
      employee_id, project_id: siteProjectId,   // site day, no session
    });
    console.log("site start-work (no session) — should fail:", badStart.status, badStart.body);
    assertEquals(badStart.status, 400, "site project must require travel+arrive flow");

    // ============================================================
    // PHASE D — SITE flow: travel -> arrive -> work -> end
    // ============================================================
    const trv = await callFn("project-start-travel", token, {
      employee_id, project_id: siteProjectId, lat: office_lat, lng: office_lng,
    });
    console.log("site start-travel:", trv.status, trv.body);
    assertEquals(trv.status, 200);
    const siteSessionId = trv.body.session_id as string;

    const arr = await callFn("project-arrive-site", token, {
      employee_id, session_id: siteSessionId, lat: site_lat, lng: site_lng,
    });
    console.log("site arrive-site:", arr.status, arr.body);
    assertEquals(arr.status, 200);

    const sw = await callFn("project-start-work", token, {
      employee_id, session_id: siteSessionId,
    });
    console.log("site start-work:", sw.status, sw.body);
    assertEquals(sw.status, 200);

    const ew = await callFn("project-end-work", token, {
      employee_id, session_id: siteSessionId,
    });
    console.log("site end-work:", ew.status, ew.body);
    assertEquals(ew.status, 200);

    // ============================================================
    // PHASE E — return to office + punch out
    // ============================================================
    const ret = await callFn("start-return-travel", token, {
      employee_id, lat: site_lat, lng: site_lng,
    });
    console.log("start-return-travel:", ret.status, ret.body);
    assertEquals(ret.status, 200);

    const ao = await callFn("arrive-office", token, {
      employee_id, lat: office_lat, lng: office_lng, accuracy: 10,
    });
    console.log("arrive-office:", ao.status, ao.body);
    assertEquals(ao.status, 200);

    const po = await callFn("punch-out", token, {
      employee_id, lat: office_lat, lng: office_lng, accuracy: 10,
    });
    console.log("punch-out:", po.status, po.body);
    assertEquals(po.status, 200, `punch-out failed: ${JSON.stringify(po.body)}`);

    console.log("\n✅ ALL PHASES PASSED — in-house and site flows work end-to-end");
  } finally {
    // -------- Cleanup --------
    await admin.from("project_work_sessions").delete().eq("employee_id", employee_id);
    await admin.from("attendance_logs").delete().eq("employee_id", employee_id);
    await admin.from("project_assignments").delete().eq("employee_id", employee_id);
    await admin.from("project_day_work_locations").delete().in("project_id", [inhouseProjectId, siteProjectId]);
    await admin.from("projects").delete().in("id", [inhouseProjectId, siteProjectId]);
    await admin.from("employees").delete().eq("id", employee_id);
    await admin.auth.admin.deleteUser(auth_id);
  }
});
