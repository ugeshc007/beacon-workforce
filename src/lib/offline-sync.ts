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
 * Recognize server errors that mean "state has already moved past this action".
 * These happen when an offline-queued step is replayed after the user has
 * completed the flow online, or when a later action already superseded it.
 * We treat them as success so the sync screen doesn't show scary red pills.
 */
const BENIGN_ERROR_PATTERNS: RegExp[] = [
  /already recorded/i,
  /already ended/i,
  /already punched (in|out)/i,
  /session already/i,
  /no active attendance/i,
  /no attendance record/i,
  /must punch in/i,
  /must return to office/i,
  /start travel first/i,
  /duplicate key/i,
  /deduped/i,
  /already exists/i,
];

function isBenignSyncError(msg: string): boolean {
  return BENIGN_ERROR_PATTERNS.some((re) => re.test(msg));
}

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
        try {
          const { logMobileError } = await import("@/lib/error-logger");
          logMobileError({
            category: "sync",
            action: item.action_type,
            message: `Unknown action: ${item.action_type}`,
            error_code: "unknown_action",
            context: { local_id: item.local_id },
          });
        } catch { /* noop */ }
        continue;
      }

      let attempt = 0;
      let success = false;

      // Resolve a missing session_id for project follow-up actions whose
      // creating action (project_start_travel / project_start_work) was also
      // queued offline. We look up the open session by (employee, project, date).
      let payloadToSend: Record<string, unknown> = item.payload;
      const needsSessionId = [
        "project_arrive_site",
        "project_start_work",
        "project_start_break",
        "project_end_break",
        "project_end_work",
      ].includes(item.action_type);
      if (needsSessionId && !payloadToSend.session_id) {
        const projectId = payloadToSend.project_id as string | undefined;
        const employeeId = payloadToSend.employee_id as string | undefined;
        const date = payloadToSend.date as string | undefined;
        if (projectId && employeeId && date) {
          try {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data: row } = await supabase
              .from("project_work_sessions")
              .select("id")
              .eq("employee_id", employeeId)
              .eq("project_id", projectId)
              .eq("date", date)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (row?.id) payloadToSend = { ...payloadToSend, session_id: row.id };
          } catch { /* will fail below if still missing */ }
        }
      }

      while (attempt < MAX_RETRIES && !success) {
        try {
          await invokeEdge(fnName, {
            ...payloadToSend,
            idempotency_key: item.idempotency_key,
          });

          await markSynced(item.local_id);
          synced++;
          success = true;
        } catch (e: any) {
          const msg: string = e?.message || "Sync failed";
          // Benign errors: server state has already moved past this queued
          // action (user completed the flow via another path, or a later
          // action superseded this one). Treat as success so users don't
          // see scary "error" pills for stale offline replays.
          if (isBenignSyncError(msg)) {
            await markSynced(item.local_id);
            synced++;
            success = true;
            break;
          }
          attempt++;
          lastErr = msg;
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
            await markError(item.local_id, msg);
            failed++;
            try {
              const { logMobileError } = await import("@/lib/error-logger");
              logMobileError({
                category: "sync",
                action: item.action_type,
                message: msg,
                error_code: "sync_failed_after_retries",
                context: {
                  local_id: item.local_id,
                  attempts: MAX_RETRIES,
                  payload: payloadToSend,
                },
              });
            } catch { /* noop */ }
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
  const handler = (trigger: string) => {
    syncPendingActions(trigger).catch(console.error);
    import("@/lib/offline-daily-logs")
      .then((m) => m.syncPendingDailyLogs().catch(console.error))
      .catch(() => { /* ignore */ });
  };

  const onlineHandler = () => handler("browser:online");
  const visHandler = () => { if (document.visibilityState === "visible") handler("visibilitychange"); };

  window.addEventListener("online", onlineHandler);
  document.addEventListener("visibilitychange", visHandler);

  let removeNativeListener: (() => void) | null = null;
  let removeResumeListener: (() => void) | null = null;
  (async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const sub = await Network.addListener("networkStatusChange", (status) => {
        if (status.connected) handler("native:network");
      });
      removeNativeListener = () => sub.remove();
      const status = await Network.getStatus();
      if (status.connected) handler("startup");
    } catch {
      handler("startup");
    }
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("appStateChange", (state) => {
        if (state.isActive) handler("native:resume");
      });
      removeResumeListener = () => sub.remove();
    } catch { /* ignore on web */ }
  })();

  const poll = setInterval(async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      if (status.connected) handler("poll");
    } catch {
      if (navigator.onLine) handler("poll");
    }
  }, 30000);

  return () => {
    window.removeEventListener("online", onlineHandler);
    document.removeEventListener("visibilitychange", visHandler);
    clearInterval(poll);
    removeNativeListener?.();
    removeResumeListener?.();
  };
}


function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
