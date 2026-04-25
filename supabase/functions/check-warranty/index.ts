import { createSupabaseAdmin, jsonResponse, errorResponse, corsResponse } from "../_shared/helpers.ts";

// Check for warranty expiry and send notifications
// Triggered by cron: checks 1 month before expiry and on expiry day
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const supabase = createSupabaseAdmin();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    
    // Date 30 days from now
    const oneMonthLater = new Date(today);
    oneMonthLater.setDate(oneMonthLater.getDate() + 30);
    const oneMonthStr = oneMonthLater.toISOString().split("T")[0];

    // Find projects with warranty expiring in exactly 30 days or today
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, name, warranty_end_date, branch_id, warranty_notification_sent")
      .eq("has_warranty", true)
      .not("warranty_end_date", "is", null);

    if (error) return errorResponse(error.message, 500);
    if (!projects?.length) return jsonResponse({ message: "No warranty projects found", notified: 0 });

    let notified = 0;

    for (const project of projects) {
      const expiryDate = project.warranty_end_date;
      
      // Check if expiry is today or exactly 30 days from now
      const isExpiring30Days = expiryDate === oneMonthStr;
      const isExpiringToday = expiryDate === todayStr;

      if (!isExpiring30Days && !isExpiringToday) continue;

      // Get branch managers/admins
      const { data: users } = await supabase
        .from("users")
        .select("id")
        .eq("branch_id", project.branch_id)
        .eq("is_active", true);

      if (!users?.length) continue;

      const userIds = users.map((u: { id: string }) => u.id);
      const { data: roleUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("user_id", userIds)
        .in("role", ["admin", "manager"]);

      if (!roleUsers?.length) continue;

      const title = isExpiringToday
        ? `⚠️ Warranty Expired: ${project.name}`
        : `🔔 Warranty Expiring Soon: ${project.name}`;
      const message = isExpiringToday
        ? `The warranty for project "${project.name}" has expired today (${expiryDate}).`
        : `The warranty for project "${project.name}" will expire on ${expiryDate} (30 days from now).`;

      const notifications = roleUsers.map((ru: { user_id: string }) => ({
        user_id: ru.user_id,
        type: "warranty_expiry",
        title,
        message,
        priority: isExpiringToday ? "critical" : "high",
        reference_id: project.id,
        reference_type: "project",
      }));

      await supabase.from("notifications").insert(notifications);
      notified++;
    }

    return jsonResponse({ success: true, notified });
  } catch (err) {
    return errorResponse(err, 500);
  }
});
