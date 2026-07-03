Four offline issues on the mobile app, fixed together. Each fix is scoped to the mobile hooks and offline libs — no schema or admin/web-portal changes.

## 1. Actions not syncing when back online

**Problem**
- After 3 failed retries, items are marked `error`. They keep getting re-tried on every reconnect (good), but the attempt counter never resets, and a transient auth-refresh failure early in the app life can permanently hide successful syncs behind the "3 attempts" ceiling.
- Queued follow-up actions (e.g. `project_end_work`) can be sent before the creating action (`project_start_work`) has actually landed on the server, because the queue isn't ordered strictly per (employee, project) chain.
- The auto-sync timer polls every 30s but only fires when `Network.getStatus().connected`; it never triggers an initial flush when the user is *already* online at app start unless the branch on line 284 succeeds — currently it does, but there's no flush on route change into the mobile section.

**Fix (`src/lib/offline-sync.ts`, `src/lib/offline-queue.ts`)**
- Reset `attempts` counter when the trigger is `browser:online`, `native:network`, or `native:resume` so a new connectivity event gets a fresh 3-attempt budget.
- Process the queue in strict timestamp order (already is), but skip a follow-up action when a *prior* action for the same (employee, project) is still pending — retry it on the next pass after the prior one succeeds. Prevents "session_id required" bursts.
- Add a `flushOnMount()` call from `MobileLayout` so entering the mobile app after being offline immediately drains the queue.

## 2. Login/session lost when offline

**Problem**
- `MobileAuthProvider` reacts to `supabase.auth.onAuthStateChange`. If the access token expires while offline, supabase-js emits `SIGNED_OUT` (refresh fails) and we wipe the cached employee, kicking the worker to the login screen even though we have a valid cached profile.
- `initSessionMirror` also clears the Preferences mirror on `SIGNED_OUT`, so the next cold boot has nothing to restore.

**Fix (`src/hooks/useMobileAuth.tsx`, `src/lib/mobile-session-persist.ts`)**
- In the `onAuthStateChange` handler, when `event === "SIGNED_OUT"` AND the device is offline, keep the cached employee and session in state (don't null them). The next successful online refresh will either restore or truly sign out.
- Same in `initSessionMirror`: skip `clearAll()` when offline. Only wipe the Preferences mirror on an intentional online sign-out.
- Extend the mobile session cache to also stash the raw session JSON so a cold boot with an expired access token can still hydrate the employee row (read-only mode) until network returns.

## 3. Daily logs with photos failing to upload

**Problem**
- `enqueueDailyLog` stores photos as base64 strings inside Capacitor Preferences. On Android, Preferences uses SharedPreferences with a soft ~2 MB per-key ceiling. A single log with 3 photos routinely blows past that; the write silently truncates and the sync then fails with corrupted base64.
- On sync failure the item is marked `error` but never retried automatically because `initDailyLogAutoSync` only re-fires on `online`/`visibilitychange`, not on the same reconnect events that flush the action queue.

**Fix (`src/lib/offline-daily-logs.ts`)**
- Write photos to `Filesystem` (Capacitor `Filesystem` plugin, `Directory.Data`) instead of embedding base64 in the queue. Store `{ path, ext }` in Preferences (tiny payload). On sync, read the file, upload, then delete.
- Fall back to base64 storage on plain web (no Filesystem plugin available).
- Hook the daily-log sync into the same `Network.addListener` + `App.appStateChange` triggers already used by `initAutoSync`, so reconnect fires both queues in the same pass.
- Increase retry budget with exponential backoff mirroring the action queue.

## 4. Today's projects / assignments not visible offline

**Problem**
- `MobileHome` reads `today_projects_${employee.id}_${today}` for the "last sync at …" banner, but `useTodayProjects` writes `today_projects_v2_${employee.id}_${today}`. The offline banner never shows a timestamp.
- The realtime subscription (`supabase.channel(...)`) attaches even when offline and produces "channel error" spam that can be mistaken for a data problem.
- The per-project workflow (`useProjectWorkflow`) reads `pwl_v2_...` from `localStorage`, which is cleared by `clearMobileSnapshots()` on logout — good — but the seeding in `useTodayProjects` only writes when we successfully fetched fresh data. A first-launch-then-offline user sees an empty screen.

**Fix (`src/hooks/useTodayProjects.ts`, `src/pages/mobile/MobileHome.tsx`, `src/hooks/useProjectWorkflow.ts`)**
- Align cache keys: `MobileHome` reads the `_v2_` key.
- Guard the realtime subscribe with `navigator.onLine` and re-subscribe on the `online` event.
- On fresh install / no cache, trigger one background prefetch of `today-assignment` from `MobileLogin` right after a successful sign-in so the first offline load has data.

## Technical Notes

- No edge functions change. No DB migrations.
- All work is inside `src/hooks/useMobileAuth.tsx`, `src/hooks/useMobileWorkflow.ts`, `src/hooks/useProjectWorkflow.ts`, `src/hooks/useTodayProjects.ts`, `src/lib/offline-sync.ts`, `src/lib/offline-queue.ts`, `src/lib/offline-daily-logs.ts`, `src/lib/mobile-session-persist.ts`, `src/pages/mobile/MobileLayout.tsx`, `src/pages/mobile/MobileLogin.tsx`, `src/pages/mobile/MobileHome.tsx`.
- After merging, users need to `git pull && npx cap sync` before installing on device (Filesystem plugin is already part of the Capacitor bundle, but a sync ensures native manifests are current).

## Verification

- Airplane-mode reproduction script: sign in online, prefetch, go airplane mode, restart app → home + today's projects still render, employee still logged in.
- Queue two project actions offline, come back online → both replay in order and disappear from the sync sheet.
- Attach 3 photos to a daily log offline, come back online → all upload and the queue clears.
- Let the access token expire while offline (fast-forward device clock) → app stays on mobile home; on reconnect it silently refreshes or, if refresh truly fails, then signs out.

Confirm the plan or tell me which parts to drop/add and I'll implement in one pass.