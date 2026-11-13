import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geminipulse.monitor',
  appName: 'Gemini API Monitor',
  webDir: 'dist',
  bundledWebRuntime: false,
  android: { allowMixedContent: false }
};

export default config;
