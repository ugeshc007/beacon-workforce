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
- `src/hooks/useBackgroundTracking.ts` — Background GPS pings during travel (Capacitor watchPosition + web fallback)
- `src/lib/workflow-engine.ts` — Pure state machine: idle→punched_in→traveling→at_site→working→on_break→work_done→punched_out
- `src/lib/offline-queue.ts` — Offline queue with idempotency keys (Capacitor Preferences)
- `src/lib/offline-sync.ts` — Auto-sync engine: retry with exponential backoff, reconnect listener
- `src/lib/gps.ts` — GPS module: accuracy detection (high/medium/low/none), map fallback trigger, haversine distance
- `src/lib/capacitor.ts` — Native platform detection
- `src/components/mobile/HoldToConfirm.tsx` — Hold-to-confirm button with fill animation + haptics
- `src/components/mobile/MapPicker.tsx` — Map fallback when GPS is weak (OSM embed + manual coords)

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

### Phase 2 Features (implemented)
1. **GPS module** — `src/lib/gps.ts` with accuracy thresholds (20m high, 50m medium, 100m+ triggers map fallback)
2. **Background travel tracking** — `useBackgroundTracking` hook, 30s interval pings via travel-ping edge function
3. **Offline-first sync** — `src/lib/offline-sync.ts` with auto-sync on reconnect, 3 retries with exponential backoff
4. **Hold-to-confirm** — `HoldToConfirm` component for punch_in, end_work, punch_out (1.5s hold with haptics)
