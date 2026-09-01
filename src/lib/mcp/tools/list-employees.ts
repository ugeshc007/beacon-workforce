import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_employees",
  title: "List employees",
  description: "List employees visible to the signed-in user.",
  inputSchema: {
    search: z.string().trim().min(1).optional().describe("Match name or employee code."),
    limit: z.number().int().min(1).max(100).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("employees")
      .select("id,name,employee_code,role,is_active,branch_id")
      .order("name", { ascending: true })
      .limit(limit);
    if (search) q = q.or(`name.ilike.%${search}%,employee_code.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { employees: data ?? [] },
    };
  },
});
