## Driver Workflow — Multi-Leg Trips

A new flow that activates **only** when an employee's assigned role for today is `driver`. If the same person is assigned as `team_member`/`team_leader` on another day or project, the existing technician flow runs unchanged.

### Mobile Flow

```
Punch In (office)
   ↓
[Select Project]  ← from today's pre-assigned driver projects
   ↓
Start Travel  → status: traveling
   ↓
Arrive at Site → choose:
   ├─ Drop Off  → log time, free to leave
   ├─ Pick Up   → log time, free to leave
   └─ Waiting   → stays on site, paid (tap "Done Waiting" when leaving)
   ↓
Leg Complete → choose:
   ├─ Start Another Project  → back to [Select Project]
   └─ Return to Office       → travel back → arrive office → Punch Out
```

Each drop / pickup / wait is a **separate leg**. A pickup later in the day is a new leg, not a continuation.

### Database

New table `driver_trip_legs`:
- `driver_id`, `date`, `project_id`
- `attendance_log_id` (links to the driver's daily punch-in row)
- `leg_number` (1, 2, 3… per day)
- `travel_start_time` + GPS
- `site_arrival_time` + GPS
- `leg_type`: `drop_off` | `pick_up` | `wait`
- `leg_end_time` (when driver leaves site or ends wait)
- `total_travel_minutes`, `total_onsite_minutes`
- `status`: `traveling` | `on_site` | `completed`

The driver's `attendance_logs` row continues to track punch-in / punch-out and total daily minutes (for OT/cost).

### Edge Functions

- `driver-start-trip` — driver picks project + starts travel → creates new leg
- `driver-arrive-site` — sets site_arrival + leg_type (drop/pick/wait)
- `driver-end-leg` — closes leg (driver leaves site or ends wait)
- Reuse existing `start-return-travel`, `arrive-office`, `punch-out` for the final return.

### Cost Report Allocation

Driver's daily total minutes (from `attendance_logs`) are split per project proportional to `(travel + on-site) minutes per project / total leg minutes`. Each project's labor breakdown shows the driver as a separate line item with the time they spent serving that project. Travel + on-site go into the **Site** bucket (or honor the day's In-House/Site tag if set, same as technicians).

### UI Changes

1. **Mobile** — new screens for driver:
   - `MobileHome.tsx` detects role and renders `DriverWorkflowCard` instead of standard workflow
   - Project picker (today's pre-assigned driver projects)
   - Trip leg timeline showing all completed + active legs
   - Action buttons: Start Travel / Arrive (drop/pick/wait) / End Leg / Return to Office

2. **Web schedule** — driver assignments display already works (driver role exists). No change.

3. **Web attendance/timeline** — show driver legs in the daily timeline drawer (collapsed list).

### Out of scope for this iteration
- Editing legs from web (admins still use override on `attendance_logs` totals).
- Mileage / vehicle tracking.

### Build order
1. Migration: `driver_trip_legs` table + RLS.
2. Edge functions: start-trip, arrive-site, end-leg.
3. Mobile UI: `DriverWorkflowCard` + integration into `MobileHome.tsx`.
4. Web: leg list in `AttendanceDetailDrawer`.
5. Cost report: per-project driver allocation in `useProjectLaborBreakdown`.
