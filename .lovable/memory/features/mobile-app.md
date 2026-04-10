---
name: Mobile App Architecture
description: BeBright field worker mobile app structure, routes, and Capacitor setup
type: feature
---
## Mobile App (Capacitor + React)

### Routes
- `/m/login` — Employee login (MobileAuthProvider)
- `/m` — MobileLayout with bottom nav (Home, Timesheet, Notifications, Profile)
- `/m/timesheet` — Weekly timesheet view
- `/m/notifications` — Employee notifications (realtime)
- `/m/profile` — Profile + sign out

### Key Files
- `src/hooks/useMobileAuth.tsx` — Employee auth context (reads from `employees` table, not `users`)
- `src/hooks/useMobileWorkflow.ts` — Workflow state machine + edge function calls
- `src/lib/workflow-engine.ts` — Pure state machine: idle→punched_in→traveling→at_site→working→on_break→work_done→punched_out
- `src/lib/offline-queue.ts` — Offline queue with idempotency keys (Capacitor Preferences)
- `src/lib/capacitor.ts` — Native platform detection

### Edge Functions (mobile-specific)
- `create-employee-auth` — Admin creates auth account for employee
- `travel-ping` — Stores periodic GPS during travel

### Tables (mobile-specific)
- `employee_notifications` — Notifications for field workers (realtime enabled)
- `travel_pings` — Background GPS pings during travel
- `device_tokens` — FCM push notification tokens

### Capacitor Config
- appId: `app.lovable.535ca16b4da54c5f88def3da094d2364`
- appName: `beacon-workforce`
- webDir: `dist`
