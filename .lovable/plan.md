
# Idle Time Report

A new report that measures **idle time** (unproductive minutes) inside every employee's paid shift, so managers can spot people who punched in but didn't actually work.

## What counts as idle time

For each attendance log (one employee, one shift):

```text
Shift span   = office_punch_out - office_punch_in
Productive   = sum of work minutes across their project_work_sessions
                (work_start_time -> work_end_time, minus breaks)
             + real travel minutes (site & return)
Idle time    = Shift span - Productive - Break
```

Special cases that make the WHOLE shift idle:
- Punched in and out but **no project assignment** for that date.
- Punched in and out but **no work_start_time** was ever recorded (didn't press "Start Work").
- Long gaps (>30 min) between punch-in and travel start, or between site arrival and work start, are counted as idle.

Currently-open shifts (no punch-out yet) are excluded from totals but shown as "In progress".

## Report page

Route: `/reports/idle-time` (new entry in the Reports sidebar).

**Filters (top bar)**
- Date range (default: last 7 days)
- Branch / Project / Skill type
- Employee search
- Min idle threshold (e.g. show only ≥ 60 min)

**Section 1 — Summary cards**
- Total idle hours (range)
- Avg idle per employee per day
- Employees with any idle time
- Worst offender (name + hours)

**Section 2 — Employee-wise table** (one row per employee for the range)
| Employee | Days worked | Shift hrs | Productive hrs | Break hrs | **Idle hrs** | Idle % | Reason mix |
|---|---|---|---|---|---|---|---|
| Amin Ansari | 5 | 42.0 | 22.5 | 1.0 | **18.5** | 44% | No work start ×2, Gap ×3 |

- Row click → opens the individual drill-down.
- Sort by Idle hrs / Idle % / Employee.
- CSV export button.

**Section 3 — Individual drill-down (drawer)**
Per selected employee, one card per day:
- Timeline strip: Punch In → Travel → Site → Work → Break → Work End → Return → Punch Out, with **idle gaps highlighted in red** with their duration.
- Reason chips: `No project assigned`, `No work started`, `Long pre-travel gap 3h 12m`, `Long site-idle gap 7h 10m` (Amin's case).
- Totals for the day: Shift / Productive / Break / **Idle**.

## Technical details

**Data source** — read-only aggregation on the client from existing tables:
- `attendance_logs` (punch in/out, break)
- `project_work_sessions` (real work + travel windows) joined via `attendance_log_id`
- `project_assignments` (to detect "no assignment on this date")
- `employees` (name, code, skill_type, branch)

No schema changes. No new tables.

**New files**
- `src/hooks/useIdleTimeReport.ts` — react-query hook that pulls the 4 tables for the range and computes idle per (employee, date) client-side. Groups results by employee for the summary.
- `src/lib/idle-time.ts` — pure calculator: takes one attendance log + its sessions + assignments and returns `{ shiftMin, productiveMin, breakMin, idleMin, reasons[], gaps[] }`. Unit-testable.
- `src/pages/reports/IdleTimeReport.tsx` — the page (cards + table + CSV export).
- `src/components/reports/IdleEmployeeDrawer.tsx` — per-employee day-by-day drawer.
- Add route in `src/App.tsx` and sidebar entry in `src/components/layout/AppSidebar.tsx` (under Reports).

**Gap detection thresholds** (kept in `idle-time.ts` as constants so you can tune later):
- `PRE_TRAVEL_IDLE_MIN = 30` — punch-in → travel-start gap over this = idle.
- `SITE_IDLE_MIN = 30` — site-arrival → work-start gap over this = idle.
- `POST_WORK_IDLE_MIN = 30` — work-end → return-travel gap over this = idle.
- `RETURN_IDLE_MIN = 30` — at-office → punch-out gap over this = idle.

**Permissions**
- Guarded by existing `useCanAccess("reports", "can_view")` — same pattern as other reports pages, no new permission row needed.

## Not in scope
- No changes to punch/work edge functions.
- No changes to how idle time affects payroll (this is a visibility report only).
- No push notifications for high idle time — can be a follow-up.
