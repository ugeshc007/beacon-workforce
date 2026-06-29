# Retroactive Time Entry for Stale Shifts

## Problem
When an employee forgets to close yesterday's (or older) shift and resumes the flow today, every action (Start Travel, Work Start, Work End, Return Travel, Arrive Office, Punch Out) gets stamped with **today's current time** — which is wrong. The real action happened yesterday.

## Solution
If the open shift is **stale** (date < today), prompt the employee for the **actual time** they did each step. For today's shift, keep the current behaviour (auto-capture `now()`).

## User Flow

For each workflow action on a stale shift:

1. Employee taps action (e.g. "Start Work")
2. A small time-picker dialog appears:
   - Title: "When did you start work?"
   - Default value: a sensible guess (e.g. last action time + a small offset, or shift start)
   - Date is locked to the stale shift's date
   - Only HH:MM editable
3. Employee confirms → action submits with the chosen timestamp
4. Server records that timestamp instead of `now()`

Today's shift: no dialog, instant action as today.

## Implementation

### 1. New component
`src/components/mobile/RetroTimeDialog.tsx`
- Props: `open`, `shiftDate`, `actionLabel`, `defaultTime`, `minTime`, `onConfirm(isoTimestamp)`, `onCancel`
- HH:MM input + Confirm / Cancel
- Builds ISO timestamp from `shiftDate + chosen time` in Asia/Dubai zone

### 2. Hook changes — `src/hooks/useMobileWorkflow.ts`
- Detect stale: `isStale = attendanceLog.date < todayStr`
- `executeAction(action, payload)` accepts optional `overrideTimestamp`
- When `isStale` and no override passed: return a signal to caller to open the dialog instead of submitting
- When override present: include `client_timestamp` (or per-field key, e.g. `work_start_time`) in payload

### 3. Edge function changes
Update the relevant functions to honour an optional `client_timestamp` from payload **only when the caller is the assigned employee and the log is stale**:
- `punch-in`, `punch-out`
- `project-start-travel`, `project-arrive-site`
- `project-start-work`, `project-end-work`
- `start-return-travel`, `arrive-office`

Each writes `client_timestamp` (validated to be within the shift date + not in future) to its respective column instead of `now()`.

### 4. UI wiring
- `MobileHome.tsx`: when stale, intercept office actions → open dialog → on confirm call `executeAction` with override
- `MobileProjectWorkflow.tsx`: same for site actions
- Default time logic: latest existing timestamp on the log + 1 minute (so order stays chronological)

## Validation Rules (server side)
- `client_timestamp` must be on the same calendar date as `attendance_logs.date`
- Must be ≥ previous step's timestamp
- Must be ≤ `now()`
- If invalid → fall back to `now()` and return a warning

## Out of Scope
- Editing already-completed timestamps (separate feature)
- Manager approval for retroactive entries (could be a follow-up if needed)

## Version
Bump to **v13.0.7 / build 20** after implementation.
