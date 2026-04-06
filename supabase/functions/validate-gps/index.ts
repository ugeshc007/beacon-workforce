import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse, haversineDistance } from "../_shared/helpers.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lat, lng, target_type, employee_id } = await req.json();

    if (!lat || !lng || !target_type || !employee_id) {
      return errorResponse("lat, lng, target_type, and employee_id are required");
    }

    const supabase = createSupabaseAdmin();

    // Get employee's branch
    const { data: emp } = await supabase
      .from("employees")
      .select("branch_id")
      .eq("id", employee_id)
      .single();

    if (!emp) return errorResponse("Employee not found", 404);

    let targetLat: number, targetLng: number, radius: number;

    if (target_type === "office") {
      const { data: office } = await supabase
        .from("offices")
        .select("latitude, longitude, gps_radius_meters")
        .eq("branch_id", emp.branch_id)
        .limit(1)
        .single();

      if (!office || !office.latitude || !office.longitude) {
        return errorResponse("No office found for this branch", 404);
      }
      targetLat = Number(office.latitude);
      targetLng = Number(office.longitude);
      radius = office.gps_radius_meters;
    } else if (target_type === "site") {
      // Get today's assignment to find project site
      const today = new Date().toISOString().split("T")[0];
      const { data: assignment } = await supabase
        .from("project_assignments")
        .select("project_id, projects(site_latitude, site_longitude, site_gps_radius)")
        .eq("employee_id", employee_id)
        .eq("date", today)
        .limit(1)
        .single();

      if (!assignment) return errorResponse("No assignment found for today", 404);
      const proj = (assignment as any).projects;
      if (!proj?.site_latitude || !proj?.site_longitude) {
        return errorResponse("Project site coordinates not set", 400);
      }
      targetLat = Number(proj.site_latitude);
      targetLng = Number(proj.site_longitude);
      radius = proj.site_gps_radius;
    } else {
      return errorResponse("target_type must be 'office' or 'site'");
    }

    const distance = haversineDistance(lat, lng, targetLat, targetLng);
    const valid = distance <= radius;

    return jsonResponse({
      valid,
      distance_meters: Math.round(distance),
      message: valid
        ? `Within ${target_type} radius (${Math.round(distance)}m)`
        : `Outside ${target_type} radius by ${Math.round(distance - radius)}m`,
    });
  } catch (err) {
    return errorResponse(err.message, 500);
  }
});
