## Goal
Let Everfresh (cleaning company) define **recurring cleaning jobs** (daily / weekly / monthly / custom) per client/site, and have the system auto-generate the actual day-by-day assignments that show up in Schedule, Attendance, and Timesheets — exactly like one-off projects do today.

## How it fits the current system
Today: `projects` + `project_assignments` are one-shot. A manager assigns employees per day via `DayAssignmentPanel`.
New: a **recurrence template** that spawns those rows automatically on a schedule, with the same overlap/double-booking guard already in place.

## Plan

### 1. Data model (new tables)
- `recurring_jobs`
  - id, company_id, branch_id, client_name, site_name, address, lat, lng
  - frequency: `daily | weekly | monthly | custom`
  - days_of_week (int[]) — e.g. [1,3,5] for Mon/Wed/Fri
  - day_of_month (int, nullable) — for monthly
  - start_date, end_date (nullable = open-ended)
  - start_time, end_time, break_minutes
  - required_skills, headcount, notes, color
  - status: `active | paused | ended`
  - created_by, timestamps
- `recurring_job_employees` — default crew (employee_id, role)
- `recurring_job_occurrences` — generated rows (recurring_job_id, date, project_assignment_id, status: scheduled/skipped/done)

All with company-scoped RLS + GRANTs (matches existing pattern).

### 2. Generation logic
- Edge function `generate-recurring-occurrences` runs **nightly via pg_cron** (e.g. 01:00 UAE).
  - Looks ahead 14 days for every active recurring job.
  - For each matching date with no existing occurrence: creates a `project_assignment` row (or a lightweight "recurring task" record reusing the schedule grid) for each default crew member.
  - Skips public holidays and employee leave automatically.
  - Respects the same overlap check used in `DayAssignmentPanel` — conflicts are logged, not silently overwritten.
- Manual "Generate now" button in UI for ad-hoc backfill.

### 3. UI (web portal)
- New module: **Recurring Jobs** (sidebar entry, admin/manager only).
  - List view: client, site, frequency summary ("Mon/Wed/Fri 08:00–12:00"), crew, next occurrence, status.
  - Create/Edit modal with frequency builder (daily, weekly w/ day picker, monthly, custom RRULE-lite).
  - "Pause", "End today", "Skip this date", "Replace employee for this date" actions.
- **Schedule grid**: recurring-generated assignments show with a small 🔁 badge so managers can tell them apart from one-off projects.

### 4. Android side (no new collection)
- The mobile app already reads `project_assignments`, so generated occurrences appear automatically for the assigned cleaner — punch in/out, GPS, photos all work as-is.

### 5. Edge cases handled
- Holiday → auto-skip (configurable per job).
- Employee on leave → swap to backup from crew, else flag for manager.
- Recurring job paused → stop future generation, keep history.
- Editing a recurring job → only affects **future** occurrences; past stays intact.

### 6. Rollout order
1. Migration: 3 new tables + RLS + grants.
2. Edge function + cron schedule.
3. Recurring Jobs list + create form.
4. Schedule grid badge + "skip/replace this date" actions.
5. Reports: hours/cost rolled up per recurring job (per client billing).

### Technical notes
- Reuse existing `project_assignments` so Schedule/Attendance/Timesheets need zero changes.
- Conflict guard reuses the `toMin()` overlap helper already added in `DayAssignmentPanel`.
- Cron via existing pattern (`update_absent_check_cron` style helper).

Approve and I'll start with step 1 (migration) and step 2 (generator function).
