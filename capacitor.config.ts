import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.facemap',
  appName: 'facemap',
  webDir: 'dist',
  server: {
    url: 'https://5e863988-af72-4b73-bed5-bac763b6e9c8.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
