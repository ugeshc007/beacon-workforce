import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, todayDate } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const url = new URL(req.url);
    const employee_id = url.searchParams.get("employee_id");

    if (!employee_id) return errorResponse("employee_id query param is required");

    const supabase = createSupabaseAdmin();
    const today = todayDate();

    // Get today's assignment with project details. Include the schedule's
    // per-employee work_location so mobile clients do not infer from GPS coords.
    const { data: assignment } = await supabase
      .from("project_assignments")
      .select(`
        id, date, shift_start, shift_end, work_location,
        projects (
          id, name, client_name, site_address,
          site_latitude, site_longitude, site_gps_radius, status
        )
      `)
      .eq("employee_id", employee_id)
      .eq("date", today)
      .maybeSingle();

    if (!assignment) {
      return jsonResponse({ assigned: false, message: "No assignment for today" });
    }

    // Get team members for the same project today
    const project = (assignment as any).projects;
    const { data: team } = await supabase
      .from("project_assignments")
      .select("employee_id, employees(name, skill_type, phone)")
      .eq("project_id", project.id)
      .eq("date", today);

    // Check for overrides
    const { data: overrides } = await supabase
      .from("daily_team_overrides")
      .select("action, reason, replacement_employee_id")
      .eq("employee_id", employee_id)
      .eq("project_id", project.id)
      .eq("date", today);

    const { data: dayLocation } = await supabase
      .from("project_day_work_locations")
      .select("location")
      .eq("project_id", project.id)
      .eq("date", today)
      .maybeSingle();

    const hasCoords = project.site_latitude != null && project.site_longitude != null;
    const inferredLocation = hasCoords ? "site" : "in_house";
    const workLocation = assignment.work_location ?? dayLocation?.location ?? inferredLocation;

    return jsonResponse({
      assigned: true,
      assignment_id: assignment.id,
      date: assignment.date,
      shift_start: assignment.shift_start,
      shift_end: assignment.shift_end,
      work_location: workLocation,
      assignment_work_location: assignment.work_location,
      day_work_location: dayLocation?.location ?? null,
      project: {
        id: project.id,
        name: project.name,
        client_name: project.client_name,
        site_address: project.site_address,
        site_latitude: project.site_latitude,
        site_longitude: project.site_longitude,
        site_gps_radius: project.site_gps_radius,
      },
      team: (team ?? []).map((t: any) => ({
        employee_id: t.employee_id,
        name: t.employees?.name,
        skill_type: t.employees?.skill_type,
        phone: t.employees?.phone,
      })),
      overrides: overrides ?? [],
    });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
