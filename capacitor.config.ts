import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'social.yuto.app',
  appName: 'Yuto',
  webDir: 'dist',
  server: {
    // Allow navigation to yuto.social for deep links
    allowNavigation: ['yuto.social', '*.yuto.social'],
  },
  ios: {
    scheme: 'Yuto',
    contentInset: 'automatic',
  },
};

export default config;
