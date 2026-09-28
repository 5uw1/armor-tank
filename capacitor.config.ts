import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.suw1labs.armortank',
  appName: 'Armor Tank',
  webDir: 'dist',
  backgroundColor: '#15171a',
  android: { backgroundColor: '#15171a' },
  ios: { backgroundColor: '#15171a', contentInset: 'never' },
};

export default config;
