import { Capacitor } from "@capacitor/core";

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function isMobileRoute(path: string): boolean {
  return path.startsWith("/m");
}
