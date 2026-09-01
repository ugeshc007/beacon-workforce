import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { findModule, MODULE_NAMES } from "../modules";
import { supabaseForUser } from "../supabase";

const filterSchema = z.object({
  field: z.string().min(1).describe("Column name (see describe_module)."),
  op: z
    .enum(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is_null", "not_null", "in"])
    .default("eq"),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))])
    .optional()
    .describe("Value to compare. Omit for is_null / not_null. Array for `in`."),
});

export default defineTool({
  name: "query_module",
  title: "Query module",
  description:
    "Read rows from any module (projects, attendance, employees, site visits, maintenance, timesheets, expenses, notifications, audit logs, and more) with filters, date range, sorting and pagination. Row-level security applies, so only data the signed-in user may see is returned.",
  inputSchema: {
    module: z.string().min(1).describe(`Module name. One of: ${MODULE_NAMES.join(", ")}`),
    select: z
      .string()
      .optional()
      .describe("Comma-separated column list. Defaults to all columns."),
    filters: z.array(filterSchema).max(10).optional().describe("Column filters, ANDed together."),
    date_from: z.string().optional().describe("Inclusive start for the module's date column (YYYY-MM-DD)."),
    date_to: z.string().optional().describe("Inclusive end for the module's date column (YYYY-MM-DD)."),
    order_by: z.string().optional().describe("Column to sort by. Defaults to the module's natural order."),
    ascending: z.boolean().default(false).describe("Sort ascending instead of descending."),
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().min(0).default(0).describe("Rows to skip, for pagination."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (
    { module, select, filters, date_from, date_to, order_by, ascending, limit, offset },
    ctx,
  ) => {
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
    let q = supabase
      .from(def.table)
      .select(select?.trim() || "*", { count: "exact" })
      .order(order_by?.trim() || def.orderBy, { ascending, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (def.dateColumn) {
      if (date_from) q = q.gte(def.dateColumn, date_from);
      if (date_to) q = q.lte(def.dateColumn, date_to);
    } else if (date_from || date_to) {
      return {
        content: [{ type: "text", text: `Module "${def.name}" has no date column to filter on.` }],
        isError: true,
      };
    }

    for (const f of filters ?? []) {
      switch (f.op) {
        case "is_null":
          q = q.is(f.field, null);
          break;
        case "not_null":
          q = q.not(f.field, "is", null);
          break;
        case "in":
          q = q.in(f.field, Array.isArray(f.value) ? f.value : [f.value as string]);
          break;
        default: {
          if (f.value === undefined) {
            return {
              content: [{ type: "text", text: `Filter on "${f.field}" with op "${f.op}" needs a value.` }],
              isError: true,
            };
          }
          q = (q as any)[f.op](f.field, f.value);
        }
      }
    }

    const { data, error, count } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const result = {
      module: def.name,
      total: count ?? null,
      offset,
      limit,
      returned: data?.length ?? 0,
      rows: data ?? [],
    };
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  },
});
