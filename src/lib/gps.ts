/**
 * GPS Module — accuracy detection, spoof heuristics, map fallback trigger
 */

export interface GpsReading {
  lat: number;
  lng: number;
  accuracy: number; // metres
  timestamp: number;
  isMock: boolean;
}

export interface GpsResult {
  reading: GpsReading | null;
  quality: "high" | "medium" | "low" | "none";
  needsMapFallback: boolean;
  error?: string;
}

/** Accuracy thresholds (metres) */
const HIGH_ACCURACY = 20;
const MEDIUM_ACCURACY = 50;
const MAP_FALLBACK_THRESHOLD = 100;

function classifyAccuracy(accuracy: number): GpsResult["quality"] {
  if (accuracy <= HIGH_ACCURACY) return "high";
  if (accuracy <= MEDIUM_ACCURACY) return "medium";
  return "low";
}

/**
 * Attempt to get GPS with timeout. Returns quality assessment.
 * On web/PWA uses navigator.geolocation; on native uses Capacitor Geolocation.
 */
export async function getGpsPosition(timeoutMs = 15000): Promise<GpsResult> {
  try {
    // Try Capacitor Geolocation first (native)
    const { Geolocation } = await import("@capacitor/geolocation").catch(() => ({ Geolocation: null }));

    if (Geolocation) {
      try {
        const perm = await Geolocation.checkPermissions();
        if (perm.location === "denied") {
          return { reading: null, quality: "none", needsMapFallback: true, error: "Location permission denied" };
        }
        if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
          await Geolocation.requestPermissions();
        }

        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        });

        const reading: GpsReading = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
          isMock: false, // Capacitor doesn't expose mock flag directly; rely on server validation
        };

        const quality = classifyAccuracy(reading.accuracy);
        return {
          reading,
          quality,
          needsMapFallback: reading.accuracy > MAP_FALLBACK_THRESHOLD,
        };
      } catch {
        // Fall through to web API
      }
    }

    // Web fallback
    if (!navigator.geolocation) {
      return { reading: null, quality: "none", needsMapFallback: true, error: "Geolocation not supported" };
    }

    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0,
      });
    });

    const reading: GpsReading = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
      isMock: false,
    };

    const quality = classifyAccuracy(reading.accuracy);
    return {
      reading,
      quality,
      needsMapFallback: reading.accuracy > MAP_FALLBACK_THRESHOLD,
    };
  } catch (e: any) {
    const msg = e?.message || "GPS unavailable";
    return { reading: null, quality: "none", needsMapFallback: true, error: msg };
  }
}

/**
 * Haversine distance in metres between two lat/lng points
 */
export function distanceMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Quality colour for UI display */
export function qualityColor(q: GpsResult["quality"]): string {
  switch (q) {
    case "high": return "text-green-400";
    case "medium": return "text-amber-400";
    case "low": return "text-orange-400";
    case "none": return "text-red-400";
  }
}

export function qualityLabel(q: GpsResult["quality"]): string {
  switch (q) {
    case "high": return "GPS: High accuracy";
    case "medium": return "GPS: Medium accuracy";
    case "low": return "GPS: Low accuracy";
    case "none": return "GPS: Unavailable";
  }
}
