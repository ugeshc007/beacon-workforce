import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "attendance_summary",
  title: "Attendance summary",
  description:
    "Get attendance logs for a date range (defaults to today). Returns rows the signed-in user is permitted to see.",
  inputSchema: {
    date_from: z.string().describe("Start date, YYYY-MM-DD.").optional(),
    date_to: z.string().describe("End date, YYYY-MM-DD.").optional(),
    employee_id: z.string().uuid().optional().describe("Filter to one employee."),
    limit: z.number().int().min(1).max(200).default(100),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ date_from, date_to, employee_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const today = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const from = date_from ?? today;
    const to = date_to ?? from;
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("attendance_logs")
      .select(
        "id,employee_id,date,office_punch_in,office_punch_out,total_work_minutes,total_travel_minutes,status"
      )
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false })
      .limit(limit);
    if (employee_id) q = q.eq("employee_id", employee_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { from, to, logs: data ?? [] },
    };
  },
});
