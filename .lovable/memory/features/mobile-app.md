---
name: Mobile App Architecture
description: BeBright field worker mobile app structure, routes, and Capacitor setup
type: feature
---
## Mobile App (Capacitor + React)

### Routes
- `/m/login` — Employee login (MobileAuthProvider)
- `/m` — MobileLayout with bottom nav (Home, Timesheet, Team*, Alerts, Profile)
- `/m/timesheet` — Weekly timesheet view
- `/m/team` — Team leader live status view (team leaders only)
- `/m/notifications` — Employee notifications (realtime)
- `/m/profile` — Profile + settings (theme toggle, biometric toggle, sign out)

### Key Files
- `src/hooks/useMobileAuth.tsx` — Employee auth context
- `src/hooks/useMobileWorkflow.ts` — Workflow state machine + edge function calls
- `src/hooks/useBackgroundTracking.ts` — Background GPS pings during travel
- `src/hooks/usePhotoCapture.ts` — Camera capture + upload to daily-log-photos bucket
- `src/hooks/useBiometricAuth.ts` — Biometric auth toggle + verification
- `src/lib/workflow-engine.ts` — Pure state machine
- `src/lib/offline-queue.ts` — Offline queue with idempotency keys + cacheData/getCachedData helpers
- `src/lib/offline-sync.ts` — Auto-sync engine for workflow actions
- `src/lib/offline-daily-logs.ts` — Offline queue + sync for daily logs (incl. base64 photos)
- `src/lib/gps.ts` — GPS module with accuracy detection + map fallback trigger
- `src/lib/capacitor.ts` — Native platform detection
- `src/components/mobile/HoldToConfirm.tsx` — Hold-to-confirm button with haptics
- `src/components/mobile/MapPicker.tsx` — Map fallback when GPS is weak

### Edge Functions (mobile-specific)
- `create-employee-auth` — Admin creates auth account for employee
- `travel-ping` — Stores periodic GPS during travel
- `send-push` — FCM push notifications to employee device tokens

### Tables (mobile-specific)
- `employee_notifications` — Notifications for field workers (realtime enabled)
- `travel_pings` — Background GPS pings during travel
- `device_tokens` — FCM push notification tokens

### Phase 2 Features
1. GPS module with accuracy detection + map fallback
2. Background travel tracking (30s pings)
3. Offline-first sync with retry + auto-reconnect
4. Hold-to-confirm for critical actions (punch_in, end_work, punch_out)

### Phase 3 Features
1. Push notifications via FCM (`send-push` edge function) — needs FCM_SERVER_KEY secret
2. Photo capture for daily logs (`usePhotoCapture` hook, Capacitor Camera)
3. Team leader live status view (`/m/team` route, 30s auto-refresh)
4. Biometric auth toggle (`useBiometricAuth` hook, needs native plugin for full support)
5. Dark/light theme toggle on profile page
