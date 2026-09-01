import { defineTool } from "@lovable.dev/mcp-js";
import { MODULES } from "../modules";

export default defineTool({
  name: "list_modules",
  title: "List modules",
  description:
    "List every data module that can be read with query_module, including its description and default sort column. Start here to discover the data surface.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const modules = MODULES.map((m) => ({
      module: m.name,
      description: m.description,
      order_by: m.orderBy,
      date_filter_column: m.dateColumn ?? null,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(modules, null, 2) }],
      structuredContent: { modules },
    };
  },
});
