/**
 * Enhanced offline-first sync engine.
 * Uses Capacitor Preferences as primary store (works on web + native).
 * Adds auto-sync on reconnect, retry with exponential backoff, and conflict detection.
 */

import { invokeEdge } from "@/lib/invoke-edge";
import {
  QueuedAction,
  getQueue,
  saveQueue,
  markSynced,
  markError,
  clearSynced,
} from "@/lib/offline-queue";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

type SyncListener = (pending: number, syncing: boolean) => void;
const listeners = new Set<SyncListener>();

let isSyncing = false;

export interface SyncDiagnostics {
  last_sync_at: string | null;
  last_sync_result: { synced: number; failed: number } | null;
  last_sync_trigger: string | null;
  last_error: string | null;
}

const diagnostics: SyncDiagnostics = {
  last_sync_at: null,
  last_sync_result: null,
  last_sync_trigger: null,
  last_error: null,
};

export function getSyncDiagnostics(): SyncDiagnostics {
  return { ...diagnostics };
}

export function onSyncChange(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyListeners(pending: number, syncing: boolean) {
  listeners.forEach((fn) => fn(pending, syncing));
}


/**
 * Edge function name mapping (same as useMobileWorkflow)
 */
const edgeFunctionMap: Record<string, string> = {
  punch_in: "punch-in",
  start_travel: "start-travel",
  arrive_site: "arrive-site",
  start_work: "start-work",
  start_break: "start-break",
  end_break: "end-break",
  end_work: "end-work",
  start_return_travel: "start-return-travel",
  arrive_office: "arrive-office",
  punch_out: "punch-out",
  // Project-scoped workflow actions
  project_start_travel: "project-start-travel",
  project_arrive_site: "project-arrive-site",
  project_start_work: "project-start-work",
  project_start_break: "project-start-break",
  project_end_break: "project-end-break",
  project_end_work: "project-end-work",
  // Site-visit workflow actions
  sv_start_travel: "sv-start-travel",
  sv_arrive_site: "sv-arrive-site",
  sv_start_survey: "sv-start-survey",
  sv_start_break: "sv-start-break",
  sv_end_break: "sv-end-break",
  sv_end_visit: "sv-end-visit",
  sv_start_return_travel: "sv-start-return-travel",
  // Driver trip-leg actions
  driver_start_trip: "driver-start-trip",
  driver_arrive_site: "driver-arrive-site",
  driver_end_leg: "driver-end-leg",
};



/**
 * Process all pending items in the queue, oldest first.
 * Uses idempotency keys so duplicate sends are safe.
 */
export async function syncPendingActions(trigger: string = "manual"): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;
  diagnostics.last_sync_trigger = trigger;

  let synced = 0;
  let failed = 0;
  let lastErr: string | null = null;

  try {
    const queue = await getQueue();
    const pending = queue.filter((q) => q.sync_status === "pending" || q.sync_status === "error");
    notifyListeners(pending.length, true);

    for (const item of pending) {
      const fnName = edgeFunctionMap[item.action_type];
      if (!fnName) {
        await markError(item.local_id, `Unknown action: ${item.action_type}`);
        failed++;
        lastErr = `Unknown action: ${item.action_type}`;
        continue;
      }

      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        try {
          await invokeEdge(fnName, {
            ...item.payload,
            idempotency_key: item.idempotency_key,
          });

          await markSynced(item.local_id);
          synced++;
          success = true;
        } catch (e: any) {
          attempt++;
          lastErr = e?.message || "Sync failed";
          const cur = await getQueue();
          const idx = cur.findIndex((q) => q.local_id === item.local_id);
          if (idx >= 0) {
            cur[idx].attempts = (cur[idx].attempts || 0) + 1;
            cur[idx].last_attempt_at = new Date().toISOString();
            await saveQueue(cur);
          }
          if (attempt < MAX_RETRIES) {
            await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          } else {
            await markError(item.local_id, e?.message || "Sync failed after retries");
            failed++;
          }
        }
      }
    }

    await clearSynced();
  } finally {
    isSyncing = false;
    diagnostics.last_sync_at = new Date().toISOString();
    diagnostics.last_sync_result = { synced, failed };
    diagnostics.last_error = failed > 0 ? lastErr : null;
    const remaining = await getQueue();
    const pendingCount = remaining.filter((q) => q.sync_status === "pending").length;
    notifyListeners(pendingCount, false);
  }

  return { synced, failed };
}


/**
 * Set up auto-sync on network reconnect.
 * Call once at app startup.
 */
export function initAutoSync(): () => void {
  const handler = () => {
    syncPendingActions().catch(console.error);
    // Daily logs share the same "online" trigger — flush them too.
    import("@/lib/offline-daily-logs")
      .then((m) => m.syncPendingDailyLogs().catch(console.error))
      .catch(() => { /* ignore */ });
  };
  const onlineHandler = () => { handler(); };

  // Browser fallback (web/PWA)
  window.addEventListener("online", onlineHandler);
  document.addEventListener("visibilitychange", onlineHandler);

  // Capacitor native: browser 'online' event is unreliable on Android.
  let removeNativeListener: (() => void) | null = null;
  let removeResumeListener: (() => void) | null = null;
  (async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const sub = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected) handler();
      });
      removeNativeListener = () => sub.remove();
      const status = await Network.getStatus();
      if (status.connected) handler();
    } catch {
      handler();
    }
    // Flush whenever the app returns to foreground — covers the case where the
    // OS suspended JS in background and 'online' never fired on resume.
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("appStateChange", (state) => {
        if (state.isActive) handler();
      });
      removeResumeListener = () => sub.remove();
    } catch { /* ignore on web */ }
  })();

  // Safety net: poll every 30s. Use the Network plugin (navigator.onLine
  // can stay false on Android even with a real connection).
  const poll = setInterval(async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      if (status.connected) handler();
    } catch {
      if (navigator.onLine) handler();
    }
  }, 30000);

  return () => {
    window.removeEventListener("online", onlineHandler);
    document.removeEventListener("visibilitychange", onlineHandler);
    clearInterval(poll);
    removeNativeListener?.();
    removeResumeListener?.();
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
