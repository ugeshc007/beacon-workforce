/**
 * Offline queue for project daily logs.
 * Stores log payloads + base64-encoded photos in Capacitor Preferences.
 * Syncs to Supabase (insert row + upload photos) when network returns.
 */

import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

const QUEUE_KEY = "bebright_daily_log_queue";

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
  /** Base64-encoded photo blobs with extension, stored locally until upload. */
  photos: { data: string; ext: string }[];
  queued_at: string;
  sync_status: "pending" | "syncing" | "error";
  error_message?: string;
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
 * Convert a File to a base64 data string (no prefix).
 */
export async function fileToBase64(file: File | Blob): Promise<{ data: string; ext: string }> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || "";
      const ext = (file as File).name?.split(".").pop() || file.type.split("/")[1] || "jpg";
      resolve({ data: base64, ext });
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

let isSyncing = false;

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
          const blob = base64ToBlob(photo.data, photo.ext);
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
        } catch {}

        // 4. Remove from queue
        const updated = (await getDailyLogQueue()).filter((q) => q.local_id !== item.local_id);
        await saveDailyLogQueue(updated);
        synced++;
      } catch (e: any) {
        failed++;
        const updated = await getDailyLogQueue();
        const idx = updated.findIndex((q) => q.local_id === item.local_id);
        if (idx >= 0) {
          updated[idx].sync_status = "error";
          updated[idx].error_message = e?.message || "Sync failed";
          await saveDailyLogQueue(updated);
        }
      }
    }
  } finally {
    isSyncing = false;
  }

  return { synced, failed };
}

/**
 * Auto-sync daily logs when network returns. Call once at app startup.
 */
export function initDailyLogAutoSync(): () => void {
  const handler = () => {
    if (navigator.onLine) {
      syncPendingDailyLogs().catch(console.error);
    }
  };
  window.addEventListener("online", handler);
  if (navigator.onLine) syncPendingDailyLogs().catch(console.error);
  return () => window.removeEventListener("online", handler);
}
