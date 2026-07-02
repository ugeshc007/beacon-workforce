/**
 * Mobile error logger — writes user-facing errors to the `error_logs` table
 * so admins can audit them on the /audit page. Never throws.
 */
import { supabase } from "@/integrations/supabase/client";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import { APP_VERSION, APP_BUILD } from "@/lib/app-version";

export type ErrorCategory =
  | "auth"
  | "punch"
  | "workflow"
  | "site_visit"
  | "daily_log"
  | "sync"
  | "gps"
  | "network"
  | "unknown";

export interface LogErrorInput {
  category: ErrorCategory;
  action?: string;              // e.g. "punch-in", "start-travel"
  message: string;
  error_code?: string;
  severity?: "info" | "warning" | "error" | "critical";
  context?: Record<string, unknown>;
}

async function getCachedEmployeeId(): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key: "mobile_employee" });
    if (!value) return null;
    const parsed = JSON.parse(value);
    return parsed?.id ?? null;
  } catch {
    return null;
  }
}

let netState: string | null = null;
if (typeof window !== "undefined") {
  netState = navigator.onLine ? "online" : "offline";
  window.addEventListener("online", () => (netState = "online"));
  window.addEventListener("offline", () => (netState = "offline"));
}

export async function logMobileError(input: LogErrorInput): Promise<void> {
  try {
    const employee_id = await getCachedEmployeeId();
    const platform = Capacitor.getPlatform?.() ?? "web";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
    const route = typeof window !== "undefined" ? window.location.pathname : null;

    await (supabase.from("error_logs") as any).insert({
      source: "mobile",
      severity: input.severity ?? "error",
      category: input.category,
      action: input.action ?? null,
      error_code: input.error_code ?? null,
      message: (input.message ?? "Unknown error").slice(0, 2000),
      context: input.context ?? {},
      employee_id,
      route,
      app_version: APP_VERSION,
      build_number: String(APP_BUILD),
      platform,
      user_agent: userAgent,
      network_state: netState,
    });
  } catch {
    // Silent — logging must never break the app
  }
}
