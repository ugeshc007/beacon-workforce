## Reason this keeps repeating

The previous fix corrected the display logic, but the underlying data model is still inconsistent for multi-shift days:

- `project_assignments` stores the correct schedule value: each shift can be `site` or `in_house`.
- `attendance_logs` does not store `work_location` and has only one `project_id` for the whole day/open punch.
- When an employee has multiple shifts on the same day, the attendance log can point to one project, while the actual `project_work_sessions` contain another project.
- Today’s data shows exactly that: the employee has a site shift first and an in-house shift later; the attendance row points to the in-house project, while the session records include the site project.
- The Attendance page currently uses the attendance log’s single `project_id` first, so the row can show `In-House` even though the actual session being worked was `Site`.

So it is not permanently fixed because the app is still deriving the attendance location from a single daily attendance row, instead of using the actual per-shift/per-project session as the source of truth.

## Permanent fix plan

1. Update Attendance listing logic
   - If a log has project sessions, derive the Job badge from those sessions first.
   - Show `Site` if any session for that attendance log is site.
   - Show `In-House` only when all sessions are in-house.
   - Only fall back to `attendance_logs.project_id` when there are no project sessions.

2. Update Attendance detail drawer/session cards
   - Pass each session’s resolved `work_location` into the detail UI.
   - Stop treating “no travel timestamps” as automatically in-house when the schedule says site.
   - This prevents a site shift from looking in-house before travel/site arrival is recorded.

3. Harden backend source selection
   - Review punch-in/project workflow functions so they do not overwrite or bias the daily attendance row toward the wrong project on multi-shift days.
   - Where possible, keep the per-project session as the authoritative project/location record for Attendance.

4. Validate with today’s multi-shift example
   - Confirm the same employee with `08:00–12:00 Site` and `12:18–18:00 In-House` shows correctly.
   - Confirm Attendance no longer flips back when there are multiple shifts on one date.

## Expected result

Attendance will reflect the actual scheduled/session location for each shift, instead of guessing from one daily attendance `project_id`. This should stop the recurring Site/In-House mismatch.