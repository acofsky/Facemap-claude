import type { CapacitorConfig } from '@capacitor/cli';

const liveReloadUrl = process.env.CAP_LIVE_RELOAD?.trim();

const config: CapacitorConfig = {
  appId: 'com.acofsky.facemap',
  appName: 'FaceMap',
  webDir: 'dist',
  ...(liveReloadUrl && {
    server: { url: liveReloadUrl, cleartext: false },
  }),
};

export default config;
