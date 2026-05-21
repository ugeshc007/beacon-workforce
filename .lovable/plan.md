# Offline-First for Mobile App — Full Wire-Up

## The real problem

The offline plumbing already exists in the codebase (`offline-queue.ts`, `offline-sync.ts`, `offline-daily-logs.ts`) but **nothing is wired up**:

- `executeAction` in `useMobileWorkflow` calls `invokeEdge` directly — on failure it just rolls back the UI
- `initAutoSync` / `initDailyLogAutoSync` are never called at app startup
- Edge functions ignore the `idempotency_key` already being sent → risk of duplicate records when sync retries
- No UI shows queued actions or sync status

So when a driver is in a basement / poor signal at site, every tap fails and he gets stuck.

## What this plan ships

### 1. Wire startup sync
- Call `initAutoSync()` and `initDailyLogAutoSync()` once inside `MobileLayout` mount
- Auto-flushes queued actions whenever connection returns

### 2. Offline-aware action handler (attendance + project + site-visit)
Update `executeAction` in `useMobileWorkflow.ts`:
- If `navigator.onLine === false` **OR** `invokeEdge` throws a network error → call `enqueueAction(...)` instead of failing
- Keep the optimistic step advancement (don't roll back)
- Update local cached `attendance_log` so UI reflects the action even before sync
- Show toast: *"Saved offline — will sync when online"*

Same treatment for site-visit workflow hook (`useSiteVisitWorkflow`).

### 3. Offline driver trip legs
`useDriverWorkflow` mutations (`startTrip`, `arriveSite`, `endLeg`) get the same offline fallback. Driver leg payloads queued with `driver_start_trip` / `driver_arrive_site` / `driver_end_leg` action types (add to `edgeFunctionMap` in `offline-sync.ts`).

### 4. Offline daily logs + photos (already half-built)
- `MobileDailyLog` page already has the queue infra — just verify it calls `enqueueDailyLog` when offline and falls back gracefully
- Photos stored as base64 in Capacitor Preferences (already implemented)
- On reconnect: photos upload to `daily-log-photos` bucket → row inserted → notify

### 5. Server-side idempotency (prevents duplicates)
Add an `idempotency_keys` table:
```text
idempotency_keys(key text primary key, employee_id uuid, created_at timestamptz)
```
Wrap every mutating edge function with: *if key exists → return success without re-executing*. Add to: punch-in, punch-out, start-travel, arrive-site, start-work, start-break, end-break, end-work, start-return-travel, arrive-office, driver-start-trip, driver-arrive-site, driver-end-leg, plus sv-* functions. Auto-cleanup keys older than 7 days via existing cron.

### 6. Sync status UI
Small badge in `MobileLayout` header:
- Green dot + "Online" when connected and queue empty
- Amber dot + "3 pending sync" when queue has items
- Red dot + "Offline" when no connection
Tap badge → bottom sheet listing queued actions with timestamps + manual "Retry now" button.

### 7. Original-timestamp preservation
Critical for accuracy: edge functions must use the `timestamp` from the queued payload (not `now()`) when set. Update each function to accept optional `client_timestamp` field and prefer it when present.

## Technical notes

- Queue uses `@capacitor/preferences` (already installed) — works on web preview too via localStorage shim
- Idempotency key format: `{action}_{ms_epoch}_{rand}` (already generated client-side)
- Photos: base64 in Preferences works up to ~5MB/photo; we'll add a 2MB resize step before queueing using existing `usePhotoCapture` hook
- Retry: exponential backoff already present (2s, 4s, 8s, then mark error)
- Failed items stay in queue with `error` status and show in the sync sheet for manual retry

## Out of scope
- Background sync while app is killed (would need Capacitor Background Tasks plugin — separate effort)
- Conflict resolution UI (rare; for now last-write-wins server-side, manager can override in attendance page)

## Files touched
- `src/pages/mobile/MobileLayout.tsx` — startup sync init + status badge
- `src/hooks/useMobileWorkflow.ts` — offline fallback in executeAction
- `src/hooks/useSiteVisitWorkflow.ts` — same pattern
- `src/hooks/useDriverWorkflow.ts` — same pattern
- `src/lib/offline-sync.ts` — add driver_* / sv_* action mappings
- `src/components/mobile/SyncStatusBadge.tsx` — new
- `src/components/mobile/SyncQueueSheet.tsx` — new
- `supabase/functions/_shared/helpers.ts` — `checkIdempotency()` helper
- All ~15 mutating edge functions — add idempotency check + accept client_timestamp
- 1 migration — `idempotency_keys` table + cleanup function
