import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Wraps supabase.functions.invoke to surface the actual error message
 * returned by the edge function (e.g. "Must punch in at office first")
 * instead of the generic "Edge Function returned a non-2xx status code".
 */
export async function invokeEdge<T = unknown>(
  fnName: string,
  body: Record<string, unknown>
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fnName, { body });

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
