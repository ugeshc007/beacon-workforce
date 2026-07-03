/**
 * Mirror the Supabase session between window.localStorage (where supabase-js
 * reads it) and Capacitor Preferences (durable native storage).
 *
 * Why: on native Android/iOS WebViews, localStorage can be cleared by the OS
 * (low storage, "Clear data", etc.) which silently signs the user out. Mirroring
 * to Preferences gives us a cold-start hydration path so the user stays logged in
 * after the first sign-in.
 *
 * This module is a no-op on web browsers — Supabase already persists there.
 */

import { Preferences } from "@capacitor/preferences";
import { supabase } from "@/integrations/supabase/client";

const PREF_PREFIX = "sb_session_mirror_";

function getSupabaseStorageKeys(): string[] {
  // supabase-js stores tokens under `sb-<project-ref>-auth-token` (and a few
  // related keys). Match by prefix so we don't hardcode the project ref.
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sb-")) keys.push(k);
    }
  } catch {
    /* ignore */
  }
  return keys;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Restore any mirrored session into localStorage BEFORE supabase-js boots.
 * Call once, as early as possible at app startup.
 */
export async function hydrateSessionFromPreferences(): Promise<void> {
  try {
    const { keys } = await Preferences.keys();
    const mirrored = keys.filter((k) => k.startsWith(PREF_PREFIX));
    for (const prefKey of mirrored) {
      const lsKey = prefKey.slice(PREF_PREFIX.length);
      // Don't overwrite a fresher localStorage value if one already exists.
      if (localStorage.getItem(lsKey)) continue;
      const { value } = await Preferences.get({ key: prefKey });
      if (value) localStorage.setItem(lsKey, value);
    }
  } catch {
    /* best-effort */
  }
}

/**
 * Start mirroring the active session to Preferences. Call once after the
 * MobileAuthProvider mounts.
 */
export function initSessionMirror(): () => void {
  const mirrorAll = async () => {
    try {
      for (const k of getSupabaseStorageKeys()) {
        const v = localStorage.getItem(k);
        if (v) await Preferences.set({ key: PREF_PREFIX + k, value: v });
      }
    } catch {
      /* best-effort */
    }
  };

  const clearAll = async () => {
    try {
      const { keys } = await Preferences.keys();
      for (const k of keys) {
        if (k.startsWith(PREF_PREFIX)) await Preferences.remove({ key: k });
      }
    } catch {
      /* best-effort */
    }
  };

  // Initial mirror on boot
  void mirrorAll();

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      // If we're offline, a SIGNED_OUT typically means the refresh call failed
      // due to no network — NOT that the user actually signed out. Keep the
      // mirror so the next cold boot can still hydrate the session.
      if (isOffline()) return;
      void clearAll();
    } else {
      void mirrorAll();
    }
  });

  return () => subscription.unsubscribe();
}
