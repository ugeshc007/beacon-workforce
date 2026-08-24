import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { isOnline, markNetworkFailure, markNetworkSuccess, OfflineError } from "@/lib/connectivity";

/** Hard ceiling for any edge call. Without it an unreachable network leaves
 * the promise pending for the OS socket timeout (30-120s), which is what makes
 * screens feel frozen after the device is unlocked. */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Wraps supabase.functions.invoke to surface the actual error message
 * returned by the edge function (e.g. "Must punch in at office first")
 * instead of the generic "Edge Function returned a non-2xx status code".
 *
 * Fails fast when the device is offline so callers can queue immediately.
 */
export async function invokeEdge<T = unknown>(
  fnName: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!isOnline()) throw new OfflineError();

  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    supabase.functions.invoke(fnName, { body }),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        markNetworkFailure();
        reject(new Error("Request timeout: network unavailable"));
      }, REQUEST_TIMEOUT_MS);
    }),
  ]).finally(() => { if (timer) clearTimeout(timer); });

  const { data, error } = result as Awaited<ReturnType<typeof supabase.functions.invoke>>;
  markNetworkSuccess();


  if (error) {
    let message = error.message || "Request failed";
    if (error instanceof FunctionsHttpError) {
      try {
        const ctx = await error.context.json();
        if (ctx?.error) message = typeof ctx.error === "string" ? ctx.error : JSON.stringify(ctx.error);
      } catch {
        try {
          const txt = await error.context.text();
          if (txt) message = txt;
        } catch { /* ignore */ }
      }
    }
    throw new Error(message);
  }

  // Edge function may return 200 with { error: "..." } body
  if (data && typeof data === "object" && "error" in data && (data as { error?: unknown }).error) {
    const e = (data as { error: unknown }).error;
    throw new Error(typeof e === "string" ? e : JSON.stringify(e));
  }

  return data as T;
}
