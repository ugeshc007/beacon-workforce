import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.CAPACITOR_DEV === 'true';

const config: CapacitorConfig = {
  appId: 'com.bebright.planner',
  appName: 'beacon-workforce',
  webDir: 'dist',
  ...(isDev && {
    server: {
      url: 'https://535ca16b-4da5-4c5f-88de-f3da094d2364.lovableproject.com?forceHideBadge=true',
      cleartext: true,
    },
  }),
};

export default config;
