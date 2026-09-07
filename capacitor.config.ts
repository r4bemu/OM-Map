import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.wmr',
  appName: 'O&M Canal & Structures',
  webDir: 'dist',
  backgroundColor: '#0f172a',
  server: {
    androidScheme: 'https'
  }
};

export default config;
