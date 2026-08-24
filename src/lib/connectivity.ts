/**
 * Authoritative connectivity state for the mobile app.
 *
 * Why this exists: inside the Android WebView `navigator.onLine` is very
 * often `true` even when the device has no usable connection. Every guard
 * written as `if (!navigator.onLine)` therefore fails open, the request is
 * sent, and it hangs on an open socket until the OS times it out. That is the
 * "screen appears delayed / button responds slowly after unlock" behaviour:
 * the UI is waiting on requests that will never answer.
 *
 * This module keeps a cached flag that is updated by the Capacitor Network
 * plugin (real radio state) and additionally degrades to "offline" for a short
 * cool-down whenever a request times out or fails at the transport level.
 */

let pluginConnected: boolean | null = null;
let degradedUntil = 0;

/** Cool-down after a transport failure before we try the network again. */
const DEGRADE_MS = 10_000;

/** Synchronous best-effort answer — safe to call in render/handlers. */
export function isOnline(): boolean {
  if (Date.now() < degradedUntil) return false;
  if (pluginConnected !== null) return pluginConnected;
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/** Called when a request times out or fails to reach the server. */
export function markNetworkFailure(): void {
  degradedUntil = Date.now() + DEGRADE_MS;
}

/** Called after any successful request. */
export function markNetworkSuccess(): void {
  degradedUntil = 0;
}

/** Start listening to the real network state. Call once at app startup. */
export function initConnectivity(): () => void {
  const onOnline = () => { pluginConnected = true; markNetworkSuccess(); };
  const onOffline = () => { pluginConnected = false; };
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);

  let removePlugin: (() => void) | null = null;
  (async () => {
    try {
      const { Network } = await import("@capacitor/network");
      const status = await Network.getStatus();
      pluginConnected = status.connected;
      const sub = await Network.addListener("networkStatusChange", (s) => {
        pluginConnected = s.connected;
        if (s.connected) markNetworkSuccess();
      });
      removePlugin = () => sub.remove();
    } catch {
      /* web: fall back to navigator.onLine */
    }
  })();

  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    removePlugin?.();
  };
}

export class OfflineError extends Error {
  constructor(message = "Offline: network unavailable") {
    super(message);
    this.name = "OfflineError";
  }
}
