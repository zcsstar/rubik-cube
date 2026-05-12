import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cheez.cubist',
  appName: 'Cubist',
  webDir: 'dist',
  // Use localhost-style scheme so HTML5 history routing works for BrowserRouter.
  // (Capacitor 5+ defaults: iOS = capacitor://localhost, Android = https://localhost.)
  server: {
    androidScheme: 'https',
  },
  android: {
    // Keep keyboard from resizing the WebView; we handle our own layout.
    backgroundColor: '#020617',
  },
  ios: {
    backgroundColor: '#020617',
    contentInset: 'always',
  },
};

export default config;
