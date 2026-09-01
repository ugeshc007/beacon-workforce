import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listProjectsTool from "./tools/list-projects";
import listEmployeesTool from "./tools/list-employees";
import attendanceSummaryTool from "./tools/attendance-summary";
import listModulesTool from "./tools/list-modules";
import describeModuleTool from "./tools/describe-module";
import queryModuleTool from "./tools/query-module";

// Build issuer from the Vite-inlined project ref so the entry stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bebright-planner-mcp",
  title: "BeBright Planner",
  version: "0.2.0",
  instructions:
    "Read-only data access for BeBright Planner — a workforce, scheduling and project management app. Discover the data surface with `list_modules`, inspect a module's fields with `describe_module`, then pull rows with `query_module` (filters, date range, sorting, pagination). Convenience shortcuts: `list_projects`, `list_employees`, `attendance_summary`, and `whoami` for connectivity. All tools run as the signed-in user with row-level security applied.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoamiTool,
    listModulesTool,
    describeModuleTool,
    queryModuleTool,
    listProjectsTool,
    listEmployeesTool,
    attendanceSummaryTool,
  ],
});

