import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Everfresh Mobile — separate native app build.
 *
 * Shares the same React/Vite web codebase as the BeBright Planner web portal,
 * but is packaged as an independent Android (and optionally iOS) app with
 * Everfresh branding (appId, appName, icon, splash screen).
 *
 * Usage (run from the everfresh-mobile/ folder — Capacitor auto-detects this config):
 *   1. Build web bundle from project root:   npm run build
 *   2. Add Android platform (first time):    npx cap add android
 *   3. Sync after every web build:           npx cap sync android
 *   4. Open in Android Studio:               npx cap open android
 *
 * Set CAPACITOR_DEV=true to point the app at the live Lovable sandbox
 * (hot reload). Leave unset for production builds bundled with dist/.
 */

const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'ae.everfresh.planner',
  appName: 'Everfresh Planner',
  // Web bundle lives at the project root, one level up from this folder.
  webDir: '../dist',
  ...(isDev && {
    server: {
      url: 'https://535ca16b-4da5-4c5f-88de-f3da094d2364.lovableproject.com?forceHideBadge=true',
      cleartext: true,
    },
  }),
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      // Everfresh brand green — swap to your exact brand hex if different.
      backgroundColor: '#0F7A3D',
      showSpinner: false,
      androidScaleType: 'CENTER_INSIDE',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
