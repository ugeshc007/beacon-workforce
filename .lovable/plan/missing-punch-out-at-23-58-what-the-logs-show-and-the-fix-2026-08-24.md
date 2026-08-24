# Missing punch-out at 23:58 — what the logs show, and the fix

## What actually happened (verified in the data)

The user is ADNAN V A (15037). There *is* activity at 11:58 PM Dubai yesterday, but it was not stored as a punch-out.

Timeline (Dubai time, 23 Aug):
```text
19:52  attendance log A (23 Aug) was auto-closed by the nightly job
       note: "Auto-completed after 24h with missing workflow steps"
       — that job stamped office_punch_in / return_travel / office_arrival all at 19:52
20:28  work start on project session (bound to log A)
23:43  second project session work start (bound to log A)
23:57:55  WORK END on that session  <-- the 23:58 activity the user remembers
          the same timestamp also landed in log A as office_punch_out + work_end_time
00:01:19 (24 Aug) a NEW attendance log B was opened
          note: "Start time recovered from first recorded activity"
07:45  work end on log B's session (session status = completed)
03:46 / 03:57 / 03:58 / 04:18 UTC (07:46-08:18 Dubai) four punch-out attempts
          all rejected: "Can't punch out yet. You went to a site today,
          so you must return to the office and tap 'Arrive Office'..."
```

So: nothing was lost at 23:58 — the tap was recorded as a *work end*, and because the previous shift had already been force-closed by the nightly job, the workflow rolled him into a brand-new shift after midnight. That new shift is the one he cannot punch out of, and his punch-out taps are being blocked by the old "must arrive office first" rule (his device is still on build 13.8.4, which enforces that check locally before calling the server).

No edge-function request logs exist for the 23:30-00:30 window, which is consistent with the work-end being the only call that reached the server.

## Root causes

1. The nightly auto-close job closed a shift that was still in use, so the following actions had no valid open shift and a second log was created after midnight.
2. The client on build 13.8.4 still hard-blocks punch-out when site work has no "Arrive Office" step, so the user cannot close the shift at all — even though the server no longer blocks it.
3. Work end on a shift already marked auto-closed writes into `office_punch_out`, which makes the record look like a punch-out that then contradicts the real one.

## Plan

1. Heal the two records for ADNAN V A
   - Close log B (24 Aug) with a punch-out at his real last activity (work end 07:45 Dubai), flag it `is_incomplete_process` with a note "Punched out with missing steps — corrected by admin".
   - Correct log A (23 Aug) so its punch-out reflects the 23:57:55 work end and it is clearly labelled as auto-closed/incomplete, not a normal shift.

2. Stop the nightly job from closing shifts that are still active
   - Only auto-close a shift when there has been no activity of any kind (log timestamps and its project/task sessions) for the cutoff period. Currently a shift with an open session in progress can be caught.

3. Remove the client-side punch-out block (mobile)
   - Punch-out becomes always allowed on the device, matching the server. Missing steps are flagged for admin correction instead of blocking the worker. Shows the blue guidance notice ("contact admin to override the time") instead of a red failure.

4. Do not create a new shift from a mid-flow action
   - When a work start / travel action arrives and the only recent shift was auto-closed, reopen that shift instead of creating a new post-midnight log, so a night shift stays as one record.

5. Version bump and rebuild
   - Bump to the next build so the punch-out block is removed on devices; steps 1, 2 and 4 are server-side and take effect immediately.

## Technical notes

- Records involved: `attendance_logs` 75b9ffea (23 Aug) and fa4aa020 (24 Aug); `project_work_sessions` for projects cdaec35f and 7bec465a.
- Edits: migration for the data heal; `close-day-incomplete` / absent-check function for the activity-aware cutoff; `punch-out` client guard in the mobile workflow engine and project workflow hook; log-resolution helper so mid-flow actions reopen an auto-closed shift.
