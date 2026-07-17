import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listProjectsTool from "./tools/list-projects";
import listEmployeesTool from "./tools/list-employees";
import attendanceSummaryTool from "./tools/attendance-summary";

// Build issuer from the Vite-inlined project ref so the entry stays import-safe.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "bebright-planner-mcp",
  title: "BeBright Planner",
  version: "0.1.0",
  instructions:
    "Tools for BeBright Planner — a workforce and project management app. Use `whoami` to verify connectivity, `list_projects` and `list_employees` to browse workspace data, and `attendance_summary` to review daily attendance. All tools run as the signed-in user with row-level security applied.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listProjectsTool, listEmployeesTool, attendanceSummaryTool],
});
