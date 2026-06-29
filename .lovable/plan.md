## Goal
Make stale/overnight shifts behave correctly for **every** employee (not just Ugesh), and give app users a way to clean up a stuck shift themselves without admin help.

## Problem recap
1. The "Project Complete!" card was driving buttons from the office state machine, which fails when project timestamps live on `project_work_sessions` instead of `attendance_logs`. (Already fixed in v13.1.2.)
2. The "Worked 12:47 → 11:06 (862h 19m)" duration is wrong because work_start_time is from a previous day and the timeline subtracts raw timestamps without sanity capping.
3. There is no in-app escape hatch when an employee gets stuck on a stale shift — they have to wait for admin.

## Changes

### 1. Sanity-cap durations in `ProjectStepTimeline.tsx`
- If `endStamp - stamp` is > 18h, render `(>18h — overnight)` in amber instead of the raw number.
- Same guard in `MobileHome.tsx` "Worked" rollup and the stale-shift banner subtitle.
- Add a tiny `formatSaneDuration(min)` helper in `src/lib/time-format.ts` so all three call sites share one rule.

### 2. Surface stale shifts globally on Home (already partially done — tighten)
- `useMobileWorkflow.ts` already returns the **oldest** open log. Make the orange banner on `MobileHome.tsx` always visible whenever `attendanceLog.date < today`, with two clear chips: "Project: X" and "Close shift".
- Banner CTA opens `MobileStaleShiftSheet` (new bottom sheet, see #3).

### 3. New `MobileStaleShiftSheet` — user self-serve close
A new bottom sheet at `src/components/mobile/MobileStaleShiftSheet.tsx`:

- Shows the stale date and a summary of which steps are still open (e.g. "Work ended, return travel pending").
- One button per remaining step using the existing `RetroTimeDialog` flow, so the user enters the actual time for each:
  - Finish work (if project session still open)
  - Start return travel
  - Arrive office
  - Punch out
- Also a destructive "I forgot — close without travel back" option that calls a new edge function (see #4) to mark the shift closed with `office_punch_out = work_end_time` and a flag `auto_closed_by_user = true` for audit.
- Sheet stays open and refreshes after each step so the user walks through the whole close-out in one place.

### 4. New edge function `close-stale-shift`
- Input: `{ attendance_log_id, mode: "complete" | "forfeit", client_timestamp? }`.
- Validates the log belongs to the caller and `date < today` (UAE).
- `complete`: requires return_travel + arrive_office + punch_out timestamps already set; closes any still-open `project_work_sessions` with `work_end_time = office_punch_out`.
- `forfeit`: sets `office_punch_out = COALESCE(work_end_time, office_arrival_time, return_travel_start_time, office_punch_in)`, closes any open project sessions, sets `auto_closed_by_user = true` and `notes = 'Self-closed stale shift'`.
- Always idempotent (no-op if already punched out).

### 5. Schema
Add two columns to `attendance_logs` (nullable, default false):
- `auto_closed_by_user boolean default false`
- `notes text` (only add if not already present — confirm in migration)

### 6. Version
Bump to **v13.1.3 (build 26)**. Mobile app needs rebuild for the new sheet and home banner wiring; edge function and DB take effect immediately.

## Technical notes
- The 862h figure comes from a `work_start_time` that's likely days old on a recurring job session — capping display is the safe fix; the close-stale-shift function will rewrite that session's `work_end_time` so the bad number disappears after close.
- All changes scoped to mobile + 1 edge function + 1 small migration. Web admin attendance views are untouched.
- No change to the existing retro-time edge function logic; we reuse it for the per-step buttons in the new sheet.

Confirm and I'll implement.