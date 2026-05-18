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
    // 'never' lets the WebView extend edge-to-edge under the status bar
    // and home indicator; we handle the safe insets ourselves in CSS via
    // env(safe-area-inset-top) / -bottom on the header + tab bar. Setting
    // this to 'always' (the older default) made WKWebView and our CSS
    // each add the inset independently, leaving a ~200px white gap above
    // the header.
    contentInset: 'never',
  },
};

export default config;
