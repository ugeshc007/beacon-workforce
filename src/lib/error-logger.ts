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
  // Primary: mobile auth context cache (localStorage)
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem("bb_emp_profile_v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed.id as string;
      }
    }
  } catch { /* ignore */ }
  // Secondary: capacitor preferences (legacy key)
  try {
    const { value } = await Preferences.get({ key: "mobile_employee" });
    if (value) {
      const parsed = JSON.parse(value);
      if (parsed?.id) return parsed.id as string;
    }
  } catch { /* ignore */ }
  // Fallback: derive from live auth session
  try {
    const { data } = await supabase.auth.getUser();
    const authId = data?.user?.id;
    if (!authId) return null;
    const { data: emp } = await (supabase.from("employees") as any)
      .select("id")
      .eq("auth_id", authId)
      .maybeSingle();
    return emp?.id ?? null;
  } catch { return null; }
}

function extractProjectIdFromRoute(route: string | null): string | null {
  if (!route) return null;
  const m = route.match(/\/m\/project\/([0-9a-f-]{36})/i);
  return m ? m[1] : null;
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
