import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const { employee_id, project_id, date, shift_start, shift_end } = await req.json();

    if (!employee_id || !project_id || !date) {
      return errorResponse("employee_id, project_id, and date required");
    }

    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", project_id)
      .single();

    if (!project) return errorResponse("Project not found", 404);

    const shiftInfo = shift_start && shift_end ? ` (${shift_start}–${shift_end})` : "";
    const title = "📅 New Assignment";
    const message = `You've been assigned to ${project.name} on ${date}${shiftInfo}`;

    // Save in-app notification
    await supabase.from("employee_notifications").insert({
      employee_id,
      type: "assignment",
      title,
      message,
      priority: "high",
      reference_id: project_id,
      reference_type: "project",
    });

    // Fire FCM push (with sound) — fire & forget, don't block
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          employee_id,
          title,
          message,
          data: {
            type: "assignment",
            priority: "high",
            project_id,
            date,
            sound: "default",
          },
        },
      });
    } catch (_e) {
      // ignore push failure — in-app notification is already saved
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e, 500);
  }
});
