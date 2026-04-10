import { Preferences } from "@capacitor/preferences";

export interface QueuedAction {
  local_id: string;
  action_type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  sync_status: "pending" | "synced" | "error";
  error_message?: string;
  idempotency_key: string;
}

const QUEUE_KEY = "bebright_sync_queue";
const CACHE_PREFIX = "bebright_cache_";

export async function enqueueAction(action: Omit<QueuedAction, "local_id" | "sync_status" | "idempotency_key">): Promise<QueuedAction> {
  const queue = await getQueue();
  const entry: QueuedAction = {
    ...action,
    local_id: crypto.randomUUID(),
    sync_status: "pending",
    idempotency_key: `${action.action_type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  queue.push(entry);
  await saveQueue(queue);
  return entry;
}

export async function getQueue(): Promise<QueuedAction[]> {
  const { value } = await Preferences.get({ key: QUEUE_KEY });
  return value ? JSON.parse(value) : [];
}

export async function saveQueue(queue: QueuedAction[]): Promise<void> {
  await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
}

export async function markSynced(localId: string): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((q) => q.local_id === localId);
  if (idx >= 0) {
    queue[idx].sync_status = "synced";
    await saveQueue(queue);
  }
}

export async function markError(localId: string, error: string): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((q) => q.local_id === localId);
  if (idx >= 0) {
    queue[idx].sync_status = "error";
    queue[idx].error_message = error;
    await saveQueue(queue);
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.filter((q) => q.sync_status === "pending").length;
}

export async function clearSynced(): Promise<void> {
  const queue = await getQueue();
  await saveQueue(queue.filter((q) => q.sync_status !== "synced"));
}

// Simple cache for assignments, settings, etc.
export async function cacheData(key: string, data: unknown): Promise<void> {
  await Preferences.set({
    key: CACHE_PREFIX + key,
    value: JSON.stringify({ data, cachedAt: new Date().toISOString() }),
  });
}

export async function getCachedData<T>(key: string): Promise<{ data: T; cachedAt: string } | null> {
  const { value } = await Preferences.get({ key: CACHE_PREFIX + key });
  return value ? JSON.parse(value) : null;
}
