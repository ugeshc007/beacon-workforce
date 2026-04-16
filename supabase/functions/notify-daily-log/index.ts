import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const { project_id, employee_name, description, status } = await req.json();

    if (!project_id || !employee_name) {
      return errorResponse("project_id and employee_name required");
    }

    // Get project info
    const { data: project } = await supabase
      .from("projects")
      .select("name, branch_id")
      .eq("id", project_id)
      .single();

    if (!project) return errorResponse("Project not found", 404);

    // Get all admin/manager users in the branch
    const { data: users } = await supabase
      .from("users")
      .select("id")
      .eq("branch_id", project.branch_id)
      .eq("is_active", true);

    if (!users?.length) return jsonResponse({ ok: true, notified: 0 });

    const userIds = users.map((u: { id: string }) => u.id);

    const { data: roleUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("user_id", userIds)
      .in("role", ["admin", "manager"]);

    if (!roleUsers?.length) return jsonResponse({ ok: true, notified: 0 });

    const statusLabel = status === "completed" ? "✅ Completed" : status === "in_progress" ? "🔨 In Progress" : status || "update";
    const shortDesc = description?.length > 80 ? description.slice(0, 80) + "…" : description;

    const notifications = roleUsers.map((ru: { user_id: string }) => ({
      user_id: ru.user_id,
      type: "daily_log",
      title: `📋 ${employee_name} posted a daily log`,
      message: `${project.name} — ${statusLabel}: ${shortDesc}`,
      priority: "normal",
      reference_id: project_id,
      reference_type: "project",
    }));

    await supabase.from("notifications").insert(notifications);

    return jsonResponse({ ok: true, notified: notifications.length });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
});
