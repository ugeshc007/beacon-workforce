import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { findModule, MODULE_NAMES } from "../modules";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "describe_module",
  title: "Describe module",
  description:
    "Return the available field names of a module by sampling one visible row. Use before query_module when you need exact column names for select/filters.",
  inputSchema: {
    module: z.string().min(1).describe(`Module name. One of: ${MODULE_NAMES.join(", ")}`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ module }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const def = findModule(module);
    if (!def) {
      return {
        content: [{ type: "text", text: `Unknown module "${module}". Call list_modules first.` }],
        isError: true,
      };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from(def.table).select("*").limit(1);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const row = (data ?? [])[0] as Record<string, unknown> | undefined;
    const info = {
      module: def.name,
      description: def.description,
      order_by: def.orderBy,
      date_filter_column: def.dateColumn ?? null,
      fields: row
        ? Object.entries(row).map(([name, value]) => ({
            name,
            sample_type: value === null ? "null" : typeof value,
          }))
        : [],
      note: row ? undefined : "No rows visible to this user, so fields could not be sampled.",
    };
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
      structuredContent: info,
    };
  },
});
