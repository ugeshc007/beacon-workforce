/**
 * Offline queue for project daily logs.
 * On native platforms, photos are stored on the filesystem (Directory.Data) so
 * we don't blow past the ~2 MB per-key ceiling of Capacitor Preferences /
 * SharedPreferences. Only tiny metadata (path + ext) sits in the queue.
 * On web (no Filesystem plugin), photos fall back to inline base64.
 *
 * Syncs to Supabase (upload photos → insert row) when network returns.
 */

import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";
import { logMobileError } from "@/lib/error-logger";

const QUEUE_KEY = "bebright_daily_log_queue";
const PHOTO_DIR = "bebright-daily-log-photos";

export interface QueuedDailyLogPhoto {
  /** Either a native filesystem path (preferred) OR a base64 blob (web fallback). */
  path?: string;
  data?: string;
  ext: string;
}

export interface QueuedDailyLog {
  local_id: string;
  project_id: string;
  employee_id: string | null;
  employee_name: string;
  description: string;
  issues: string | null;
  completion_pct: number | null;
  status: string;
  task_start_date: string | null;
  task_end_date: string | null;
  photos: QueuedDailyLogPhoto[];
  queued_at: string;
  sync_status: "pending" | "syncing" | "error";
  error_message?: string;
  attempts?: number;
}

export async function getDailyLogQueue(): Promise<QueuedDailyLog[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  return value ? JSON.parse(value) : [];
}

async function saveDailyLogQueue(queue: QueuedDailyLog[]): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
}

export async function enqueueDailyLog(
  log: Omit<QueuedDailyLog, "local_id" | "queued_at" | "sync_status">
): Promise<QueuedDailyLog> {
  const queue = await getDailyLogQueue();
  const entry: QueuedDailyLog = {
    ...log,
    local_id: crypto.randomUUID(),
    queued_at: new Date().toISOString(),
    sync_status: "pending",
  };
  queue.push(entry);
  await saveDailyLogQueue(queue);
  return entry;
}

export async function getPendingDailyLogCount(): Promise<number> {
  const queue = await getDailyLogQueue();
  return queue.filter((q) => q.sync_status === "pending" || q.sync_status === "error").length;
}

/**
 * Convert a File/Blob into a queued photo entry. On native, writes to
 * Filesystem and returns the path. On web, keeps the base64 payload.
 */
export async function fileToQueuedPhoto(file: File | Blob): Promise<QueuedDailyLogPhoto> {
  const ext = (file as File).name?.split(".").pop() || file.type.split("/")[1] || "jpg";

  // Try native Filesystem first
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const base64 = await blobToBase64(file);
    const name = `${PHOTO_DIR}/${crypto.randomUUID()}.${ext}`;
    await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return { path: name, ext };
  } catch {
    // Web fallback — inline base64
    const base64 = await blobToBase64(file);
    return { data: base64, ext };
  }
}

/** Legacy alias used elsewhere in the app. */
export async function fileToBase64(file: File | Blob): Promise<QueuedDailyLogPhoto> {
  return fileToQueuedPhoto(file);
}

async function blobToBase64(file: File | Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64: string, ext: string): Blob {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: `image/${ext}` });
}

async function readQueuedPhoto(photo: QueuedDailyLogPhoto): Promise<Blob> {
  if (photo.path) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const res = await Filesystem.readFile({ path: photo.path, directory: Directory.Data });
    const data = typeof res.data === "string" ? res.data : await (res.data as Blob).text();
    return base64ToBlob(data, photo.ext);
  }
  return base64ToBlob(photo.data || "", photo.ext);
}

async function deleteQueuedPhoto(photo: QueuedDailyLogPhoto): Promise<void> {
  if (!photo.path) return;
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    await Filesystem.deleteFile({ path: photo.path, directory: Directory.Data });
  } catch { /* best-effort */ }
}

let isSyncing = false;
const MAX_LOG_RETRIES = 3;

export async function syncPendingDailyLogs(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 };
  isSyncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getDailyLogQueue();
    const pending = queue.filter((q) => q.sync_status === "pending" || q.sync_status === "error");

    for (const item of pending) {
      try {
        // 1. Upload all queued photos
        const photoPaths: string[] = [];
        for (const photo of item.photos) {
          const blob = await readQueuedPhoto(photo);
          const path = `${item.project_id}/${item.employee_id || "anon"}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 6)}.${photo.ext}`;
          const { error: upErr } = await supabase.storage
            .from("daily-log-photos")
            .upload(path, blob, { upsert: false });
          if (upErr) throw upErr;
          photoPaths.push(path);
        }

        // 2. Insert daily log row
        const { error: insertErr } = await supabase.from("project_daily_logs").insert({
          project_id: item.project_id,
          description: item.description,
          issues: item.issues,
          completion_pct: item.completion_pct,
          photo_urls: photoPaths,
          employee_id: item.employee_id,
          status: item.status,
          task_start_date: item.task_start_date,
          task_end_date: item.task_end_date,
        } as any);
        if (insertErr) throw insertErr;

        // 3. Best-effort notify
        try {
          await supabase.functions.invoke("notify-daily-log", {
            body: {
              project_id: item.project_id,
              employee_name: item.employee_name,
              description: item.description,
              status: item.status,
            },
          });
        } catch { /* ignore */ }

        // 4. Clean up filesystem copies + remove from queue
        for (const photo of item.photos) await deleteQueuedPhoto(photo);
        const updated = (await getDailyLogQueue()).filter((q) => q.local_id !== item.local_id);
        await saveDailyLogQueue(updated);
        synced++;
      } catch (e: any) {
        const updated = await getDailyLogQueue();
        const idx = updated.findIndex((q) => q.local_id === item.local_id);
        if (idx >= 0) {
          updated[idx].attempts = (updated[idx].attempts || 0) + 1;
          const done = updated[idx].attempts! >= MAX_LOG_RETRIES;
          updated[idx].sync_status = done ? "error" : "pending";
          updated[idx].error_message = e?.message || "Sync failed";
          await saveDailyLogQueue(updated);
        }
        if ((updated[idx]?.attempts ?? 0) >= MAX_LOG_RETRIES) {
          failed++;
          logMobileError({
            category: "sync",
            action: "sync_daily_log",
            severity: "warning",
            message: e?.message || "Daily log sync failed",
            context: {
              local_id: item.local_id,
              project_id: item.project_id,
              queued_at: item.queued_at,
              photo_count: item.photos.length,
            },
          });
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Reset attempts on all failed items so a fresh network event gives them
 * a new retry budget. Called by initDailyLogAutoSync on reconnect signals.
 */
async function resetDailyLogAttempts(): Promise<void> {
  const q = await getDailyLogQueue();
  let mutated = false;
  for (const it of q) {
    if (it.sync_status === "error") {
      it.sync_status = "pending";
      it.error_message = undefined;
      it.attempts = 0;
      mutated = true;
    }
  }
  if (mutated) await saveDailyLogQueue(q);
}

/**
 * Auto-sync daily logs when network returns. Call once at app startup.
 */
export function initDailyLogAutoSync(): () => void {
  const handler = () => {
    resetDailyLogAttempts()
      .catch(() => { /* ignore */ })
      .finally(() => { syncPendingDailyLogs().catch(console.error); });
  };
  const onlineHandler = () => handler();

  window.addEventListener("online", onlineHandler);
  document.addEventListener("visibilitychange", onlineHandler);

  let removeNativeListener: (() => void) | null = null;
  let removeResumeListener: (() => void) | null = null;
  (async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const sub = await Network.addListener("networkStatusChange", (s) => {
        if (s.connected) handler();
      });
      removeNativeListener = () => sub.remove();
      const status = await Network.getStatus();
      if (status.connected) handler();
    } catch {
      handler();
    }
    try {
      const { App } = await import("@capacitor/app");
      const sub = await App.addListener("appStateChange", (state) => {
        if (state.isActive) handler();
      });
      removeResumeListener = () => sub.remove();
    } catch { /* ignore */ }
  })();

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
