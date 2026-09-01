/**
 * Read-only module catalog exposed over MCP. Every entry maps a friendly module
 * name to a public table. Access is still enforced by row-level security as the
 * signed-in user — this list only bounds which tables are reachable at all.
 */
export interface ModuleDef {
  /** Module name callers pass to query_module / describe_module. */
  name: string;
  /** Underlying table. */
  table: string;
  description: string;
  /** Column used for default descending ordering. */
  orderBy: string;
  /** Date/timestamp column used by the date_from / date_to filters. */
  dateColumn?: string;
}

export const MODULES: readonly ModuleDef[] = [
  { name: "employees", table: "employees", description: "Employee master data (name, code, role, branch, skill).", orderBy: "name", dateColumn: "created_at" },
  { name: "branches", table: "branches", description: "Company branches.", orderBy: "name" },
  { name: "offices", table: "offices", description: "Office locations and geofences.", orderBy: "name" },
  { name: "companies", table: "companies", description: "Tenant companies.", orderBy: "created_at" },
  { name: "company_settings", table: "company_settings", description: "Per-company settings.", orderBy: "created_at" },
  { name: "settings", table: "settings", description: "Global key/value app settings.", orderBy: "key" },
  { name: "custom_skills", table: "custom_skills", description: "Custom skill roles.", orderBy: "name" },
  { name: "role_permissions", table: "role_permissions", description: "Module permissions per role.", orderBy: "role" },
  { name: "skill_permissions", table: "skill_permissions", description: "Module permissions per custom skill.", orderBy: "module" },

  { name: "projects", table: "projects", description: "Projects with client, status, dates, budget.", orderBy: "created_at", dateColumn: "start_date" },
  { name: "project_assignments", table: "project_assignments", description: "Daily employee-to-project schedule assignments.", orderBy: "date", dateColumn: "date" },
  { name: "project_work_sessions", table: "project_work_sessions", description: "Per-project work sessions (travel, work, break, return stamps).", orderBy: "date", dateColumn: "date" },
  { name: "project_daily_logs", table: "project_daily_logs", description: "Daily site progress logs per project.", orderBy: "date", dateColumn: "date" },
  { name: "project_expenses", table: "project_expenses", description: "Project expenses and purchase invoices.", orderBy: "date", dateColumn: "date" },
  { name: "project_templates", table: "project_templates", description: "Reusable project templates.", orderBy: "name" },
  { name: "project_day_work_locations", table: "project_day_work_locations", description: "Per-day site/in-house work location override for a project.", orderBy: "date", dateColumn: "date" },

  { name: "attendance", table: "attendance_logs", description: "Daily attendance logs with punch, travel, work, break stamps and derived minutes.", orderBy: "date", dateColumn: "date" },
  { name: "travel_pings", table: "travel_pings", description: "GPS pings captured during travel by the mobile app.", orderBy: "created_at", dateColumn: "created_at" },
  { name: "driver_trip_legs", table: "driver_trip_legs", description: "Driver trip legs (pickup, drop, distance).", orderBy: "created_at", dateColumn: "created_at" },
  { name: "timesheet_approvals", table: "timesheet_approvals", description: "Timesheet approval records per employee and period.", orderBy: "created_at", dateColumn: "period_start" },
  { name: "employee_leave", table: "employee_leave", description: "Leave records per employee.", orderBy: "date", dateColumn: "date" },
  { name: "public_holidays", table: "public_holidays", description: "Public holiday calendar.", orderBy: "date", dateColumn: "date" },
  { name: "daily_team_overrides", table: "daily_team_overrides", description: "Manual daily team composition overrides.", orderBy: "date", dateColumn: "date" },

  { name: "site_visits", table: "site_visits", description: "Site visit records with client, status and report fields.", orderBy: "visit_date", dateColumn: "visit_date" },
  { name: "site_visit_work_sessions", table: "site_visit_work_sessions", description: "Work sessions logged against site visits.", orderBy: "date", dateColumn: "date" },
  { name: "site_visit_photos", table: "site_visit_photos", description: "Photos attached to site visits.", orderBy: "created_at", dateColumn: "created_at" },

  { name: "maintenance_calls", table: "maintenance_calls", description: "Maintenance/service calls.", orderBy: "created_at", dateColumn: "scheduled_date" },
  { name: "maintenance_assignments", table: "maintenance_assignments", description: "Employees assigned to maintenance calls.", orderBy: "created_at" },
  { name: "maintenance_images", table: "maintenance_images", description: "Images attached to maintenance calls.", orderBy: "created_at", dateColumn: "created_at" },

  { name: "common_tasks", table: "common_tasks", description: "Common (non-project) tasks employees can pick up.", orderBy: "created_at" },
  { name: "common_task_sessions", table: "common_task_sessions", description: "Time logged by employees on common tasks.", orderBy: "date", dateColumn: "date" },

  { name: "recurring_jobs", table: "recurring_jobs", description: "Recurring job definitions.", orderBy: "created_at" },
  { name: "recurring_job_occurrences", table: "recurring_job_occurrences", description: "Generated occurrences of recurring jobs.", orderBy: "date", dateColumn: "date" },
  { name: "recurring_job_employees", table: "recurring_job_employees", description: "Employees attached to recurring jobs.", orderBy: "created_at" },

  { name: "notifications", table: "notifications", description: "Admin/system notifications.", orderBy: "created_at", dateColumn: "created_at" },
  { name: "employee_notifications", table: "employee_notifications", description: "Notifications targeted at employees.", orderBy: "created_at", dateColumn: "created_at" },
  { name: "assignment_audit_log", table: "assignment_audit_log", description: "Audit trail of schedule assignment changes.", orderBy: "created_at", dateColumn: "created_at" },
  { name: "system_audit_log", table: "system_audit_log", description: "System-level audit trail.", orderBy: "created_at", dateColumn: "created_at" },
  { name: "error_logs", table: "error_logs", description: "Mobile/web action audit log (successes and failures, 7-day rolling).", orderBy: "created_at", dateColumn: "created_at" },
  { name: "report_presets", table: "report_presets", description: "Saved report filter presets.", orderBy: "created_at" },
] as const;

export function findModule(name: string): ModuleDef | undefined {
  const key = name.trim().toLowerCase();
  return MODULES.find((m) => m.name === key || m.table === key);
}

export const MODULE_NAMES = MODULES.map((m) => m.name);
