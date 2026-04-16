import { useState, useCallback, useEffect } from "react";
import { isNativeApp } from "@/lib/capacitor";
import { Preferences } from "@capacitor/preferences";

const BIOMETRIC_ENABLED_KEY = "bebright_biometric_enabled";

/**
 * Hook for biometric authentication (fingerprint/face).
 * Uses @aparajita/capacitor-biometric-auth on native.
 */
export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    setChecking(true);
    try {
      if (!isNativeApp()) {
        setIsAvailable(false);
        setChecking(false);
        return;
      }

      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      const result = await BiometricAuth.checkBiometry();
      setIsAvailable(result.isAvailable);

      // Check user preference
      const { value } = await Preferences.get({ key: BIOMETRIC_ENABLED_KEY });
      setIsEnabled(value === "true");
    } catch {
      setIsAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const toggleBiometric = useCallback(async (enabled: boolean) => {
    if (enabled) {
      // Verify biometric works before enabling
      try {
        const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
        await BiometricAuth.authenticate({
          reason: "Verify biometric to enable unlock",
          allowDeviceCredential: true,
        });
      } catch {
        // User cancelled or biometric failed — don't enable
        return;
      }
    }
    await Preferences.set({ key: BIOMETRIC_ENABLED_KEY, value: enabled ? "true" : "false" });
    setIsEnabled(enabled);
  }, []);

  /**
   * Prompt biometric authentication. Returns true if verified.
   * On web or if biometrics unavailable/disabled, returns true (pass-through).
   */
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp() || !isEnabled) return true;

    try {
      const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
      await BiometricAuth.authenticate({
        reason: "Unlock BeBright",
        allowDeviceCredential: true,
      });
      return true;
    } catch {
      return false;
    }
  }, [isEnabled]);

  return {
    isAvailable,
    isEnabled,
    checking,
    toggleBiometric,
    authenticate,
  };
}
