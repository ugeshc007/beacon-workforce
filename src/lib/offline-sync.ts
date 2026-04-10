/**
 * Enhanced offline-first sync engine.
 * Uses Capacitor Preferences as primary store (works on web + native).
 * Adds auto-sync on reconnect, retry with exponential backoff, and conflict detection.
 */

import { supabase } from "@/integrations/supabase/client";
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
  punch_out: "punch-out",
};

/**
 * Process all pending items in the queue, oldest first.
 * Uses idempotency keys so duplicate sends are safe.
 */
export async function syncPendingActions(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getQueue();
    const pending = queue.filter((q) => q.sync_status === "pending" || q.sync_status === "error");
    notifyListeners(pending.length, true);

    for (const item of pending) {
      const fnName = edgeFunctionMap[item.action_type];
      if (!fnName) {
        await markError(item.local_id, `Unknown action: ${item.action_type}`);
        failed++;
        continue;
      }

      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        try {
          const { error } = await supabase.functions.invoke(fnName, {
            body: JSON.stringify({
              ...item.payload,
              idempotency_key: item.idempotency_key,
            }),
          });

          if (error) throw error;

          await markSynced(item.local_id);
          synced++;
          success = true;
        } catch (e: any) {
          attempt++;
          if (attempt < MAX_RETRIES) {
            await delay(BASE_DELAY_MS * Math.pow(2, attempt - 1));
          } else {
            await markError(item.local_id, e?.message || "Sync failed after retries");
            failed++;
          }
        }
      }
    }

    // Clean up synced items
    await clearSynced();
  } finally {
    isSyncing = false;
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
    if (navigator.onLine) {
      syncPendingActions().catch(console.error);
    }
  };

  window.addEventListener("online", handler);

  // Also try syncing on init if online
  if (navigator.onLine) {
    syncPendingActions().catch(console.error);
  }

  return () => window.removeEventListener("online", handler);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
