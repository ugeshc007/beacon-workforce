import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const { employee_id, project_id, date, shift_start, shift_end } = await req.json();

    if (!employee_id || !project_id || !date) {
      return errorResponse("employee_id, project_id, and date required");
    }

    // Get project name
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .single();

    if (!project) return errorResponse("Project not found", 404);

    const shiftInfo = shift_start && shift_end ? ` (${shift_start}–${shift_end})` : "";

    await supabase.from("employee_notifications").insert({
      employee_id,
      type: "assignment",
      title: "📅 New Assignment",
      message: `You've been assigned to ${project.name} on ${date}${shiftInfo}`,
      priority: "normal",
      reference_id: project_id,
      reference_type: "project",
    });

    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
