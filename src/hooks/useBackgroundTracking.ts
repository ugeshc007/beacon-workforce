import { useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/capacitor";

const PING_INTERVAL_MS = 30_000; // 30 seconds

/**
 * Background travel tracking — sends periodic GPS pings during the "traveling" step.
 * On native: uses Capacitor Geolocation watchPosition.
 * On web: uses navigator.geolocation.watchPosition as fallback.
 */
export function useBackgroundTracking() {
  const watchIdRef = useRef<number | string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTracking = useCallback(async (employeeId: string, attendanceLogId: string) => {
    // Stop any existing tracking
    stopTracking();

    if (isNativeApp()) {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
          async (position, err) => {
            if (err || !position) return;
            await sendPing(employeeId, attendanceLogId, {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            });
          }
        );
        watchIdRef.current = id;
      } catch (e) {
        console.error("Native geolocation watch failed, falling back to web", e);
        startWebTracking(employeeId, attendanceLogId);
      }
    } else {
      startWebTracking(employeeId, attendanceLogId);
    }
  }, []);

  const startWebTracking = useCallback((employeeId: string, attendanceLogId: string) => {
    if (!navigator.geolocation) return;

    // Periodic pings using getCurrentPosition
    intervalRef.current = setInterval(async () => {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000,
          });
        });
        await sendPing(employeeId, attendanceLogId, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      } catch {
        // Silent fail — travel tracking is best-effort
      }
    }, PING_INTERVAL_MS);
  }, []);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      try {
        if (isNativeApp()) {
          const { Geolocation } = await import("@capacitor/geolocation");
          await Geolocation.clearWatch({ id: watchIdRef.current as string });
        }
      } catch {}
      watchIdRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return { startTracking, stopTracking };
}

async function sendPing(
  employeeId: string,
  attendanceLogId: string,
  coords: { lat: number; lng: number; accuracy: number }
) {
  try {
    await supabase.functions.invoke("travel-ping", {
      body: JSON.stringify({
        employee_id: employeeId,
        attendance_log_id: attendanceLogId,
        lat: coords.lat,
        lng: coords.lng,
        accuracy: coords.accuracy,
      }),
    });
  } catch (e) {
    console.warn("Travel ping failed:", e);
  }
}
