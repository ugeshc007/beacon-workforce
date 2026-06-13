# Multi-Tenant SaaS Conversion Plan

Goal: turn the current single-company app into a SaaS that hosts ~5 companies (tenants), each with their own admin, role-based users, logo/branding, small customizations, and mobile app — all governed by one global **super-admin** (you).

Because this is a large, risky change, I will ship it in **4 phases**. Each phase is independently testable. You approve, I build phase 1, you verify, then we move on.

---

## Phase 1 — Tenant foundation (DB + auth scoping)

**New tables**
- `companies` — name, slug (used in subdomain), logo_url, primary_color, accent_color, currency, timezone, locale, contact_email, plan, is_active, created_at.
- `company_settings` — key/value per company (replaces parts of the global `settings` table).
- `company_features` — feature flags per company (Maintenance on/off, Site Visits on/off, etc.) to support "small customizations".

**New role**
- Add `super_admin` to the `user_role` enum. Stored in `user_roles` like every other role. Super-admin is **not** tied to any company.

**`company_id` everywhere**
Add a `company_id uuid NOT NULL REFERENCES companies(id)` column to every tenant table:
`branches, offices, employees, users, projects, project_assignments, project_daily_logs, project_work_sessions, project_day_work_locations, project_expenses, project_templates, attendance_logs, daily_team_overrides, driver_trip_legs, employee_leave, employee_notifications, maintenance_calls, maintenance_assignments, maintenance_images, site_visits, site_visit_work_sessions, site_visit_photos, timesheet_approvals, travel_pings, notifications, device_tokens, custom_skills, skill_permissions, role_permissions, public_holidays, report_presets, assignment_audit_log, system_audit_log, settings` (settings becomes per-company).

Backfill: create one company "BeBright" and set `company_id` to its id on every existing row.

**New security-definer helpers**
- `public.get_user_company_id()` — returns the caller's company.
- `public.is_super_admin()` — true if `super_admin` role.
- Rewrite **every RLS policy** so reads/writes require `company_id = get_user_company_id() OR is_super_admin()`. Super-admin can see/modify everything; every other role is locked to their own tenant.

**Auth**
- One Supabase Auth project still serves all tenants (cheaper, simpler).
- Each user belongs to exactly one company (super-admin = no company).
- Add a `pending_invitations` table so a company admin can invite users by email; signup links the new auth user to the right `company_id`.

---

## Phase 2 — Tenant routing & branding (web)

**Subdomain routing**
- `app.yourdomain.com` → SaaS marketing + login + super-admin console.
- `<slug>.yourdomain.com` → that company's portal (e.g. `bebright.planner.bebright.global`, `acme.planner.bebright.global`).
- A small `TenantProvider` reads the subdomain, fetches the matching `companies` row, and exposes `{ company, branding, features }` to the whole app.

**Branding**
- Logo, primary color, accent color, favicon swapped at runtime from the `companies` row.
- Tailwind tokens already use CSS variables — we just override `--brand` / `--accent` from `TenantProvider`.
- Per-company `app_name`, currency, timezone, date format pulled from `company_settings`.

**Feature flags**
- `ModuleGuard` already gates routes by role. Extend it to also check `company_features` so we can turn Maintenance / Site Visits / Travel on or off per tenant.

**Super-admin console** (new pages at `app.yourdomain.com/admin`)
- Companies list, create / edit / suspend a company.
- Per-company quick view: user count, plan, last activity, impersonate (issue a scoped token).
- Cross-tenant reports (total active users, revenue, usage).

---

## Phase 3 — Per-company onboarding flow

- "Create company" wizard (super-admin only): name, slug, logo upload, primary color, currency, timezone, modules to enable, plan, initial admin email.
- On submit: create `companies` row, seed default `branches`, `settings`, `role_permissions`, `custom_skills`, send invitation email to the company admin.
- Company admin signup link → sets password → lands on their own subdomain → adds branches, employees, projects.
- Update every existing edge function (`create-employee-auth`, `notify-*`, `morning-briefing`, `check-absent`, cron jobs, etc.) to scope by `company_id` so cron tasks fan out per tenant.

---

## Phase 4 — Mobile app per tenant

Two viable options — pick one in a follow-up:

1. **One mobile app, tenant selected at login.** User enters email + password; we look up their `company_id`, theme the app with that company's branding after login. One Play Store / App Store listing. Cheapest to maintain.
2. **One mobile app per company (white-label).** Same codebase, separate `applicationId`, app icon, splash, name, Firebase project per build. Five Play Store listings. More polish but more ops work (5 keystores, 5 store accounts, 5 release pipelines).

The Capacitor codebase doesn't change much in either case — only the build configuration and the branding source.

---

## Technical details (for reference)

- `companies.slug` is unique, lowercase, used in subdomain. Reserve `app`, `www`, `admin`, `api`.
- DNS: wildcard `*.planner.bebright.global` → Lovable. Each tenant subdomain is served by the same SPA; the client reads `window.location.hostname` to pick the tenant.
- Storage buckets stay shared; object keys are prefixed with `company_id/...` and RLS storage policies check the prefix matches `get_user_company_id()`.
- Edge functions read `company_id` from the caller's JWT (via `users`/`employees` lookup) — never trust client-supplied company_id.
- Audit logs (`system_audit_log`, `assignment_audit_log`) gain `company_id` so each tenant only sees their own audit trail; super-admin sees all.
- Migration size estimate: ~30 `ALTER TABLE ADD COLUMN`, ~80 RLS policies rewritten, 2 new helper functions, 3 new tables. Done in one migration so the app is never half-tenanted.

---

## Risk callouts

- **One bad RLS policy = cross-tenant data leak.** I will write a test edge function that, for each table, logs in as Company A and asserts it cannot read Company B's rows. Run before going live.
- **Existing data** all gets assigned to the seeded "BeBright" company — nothing is lost, nothing changes for current users.
- **Cost** stays on one Lovable Cloud project (cheap). If any single tenant grows huge we can later split them off to their own project using Phase 1's same schema.

---

## What I need from you before I start

1. Confirm domain pattern: `*.planner.bebright.global` (or do you want a fresh SaaS domain)?
2. Mobile: **one app with tenant login** or **5 white-label apps**? (recommend #1 to start)
3. Approve this plan, then I'll execute **Phase 1** (DB + RLS rewrite) as the first migration.