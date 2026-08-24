import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { isOnline, markNetworkFailure, markNetworkSuccess, OfflineError } from "@/lib/connectivity";

/** Hard ceiling for any edge call. Without it an unreachable network leaves
 * the promise pending for the OS socket timeout (30-120s), which is what makes
 * screens feel frozen after the device is unlocked. */
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * Workflow functions whose successful calls are recorded in the audit trail so
 * admins can follow a worker's full day, not just the failures.
 */
function auditCategory(fnName: string): string | null {
  if (/^(punch-in|punch-out)$/.test(fnName)) return "punch";
  if (/^(start-travel|arrive-site|start-work|start-break|end-break|end-work|start-return-travel|arrive-office)$/.test(fnName)) return "workflow";
  if (fnName.startsWith("project-")) return "workflow";
  if (fnName.startsWith("driver-")) return "workflow";
  if (fnName.startsWith("common-task")) return "workflow";
  if (fnName.startsWith("sv-")) return "site_visit";
  if (fnName.startsWith("close-stale")) return "workflow";
  return null;
}

function auditSuccess(fnName: string, body: Record<string, unknown>) {
  const category = auditCategory(fnName);
  if (!category) return;
  import("@/lib/error-logger")
    .then(({ logMobileAction }) =>
      logMobileAction({
        category: category as any,
        action: fnName,
        message: `${fnName.replace(/-/g, " ")} completed`,
        context: {
          project_id: (body.project_id as string) ?? undefined,
          site_visit_id: (body.site_visit_id as string) ?? undefined,
          queued_offline: body.queued_offline ?? undefined,
        },
      })
    )
    .catch(() => { /* never break the action */ });
}


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

  auditSuccess(fnName, body);
  return data as T;

}
