// Placeholder ad unit IDs. Replace `prod` values with your real AdMob unit
// IDs before shipping to the stores (see ADS.md). The `test` IDs below are
// Google's documented sample IDs; AdMob always returns a test ad for them
// and they're safe to commit.

import { Capacitor } from '@capacitor/core';

interface AdIdSet {
  banner: string;
  interstitial: string;
}

const test: Record<'ios' | 'android', AdIdSet> = {
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    interstitial: 'ca-app-pub-3940256099942544/4411468910',
  },
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
  },
};

// TODO before launch: paste the real unit IDs from your AdMob console.
const prod: Record<'ios' | 'android', AdIdSet> = {
  ios: {
    banner: '',
    interstitial: '',
  },
  android: {
    banner: '',
    interstitial: '',
  },
};

// We use test IDs unless explicitly opted into prod via env. Vite exposes
// import.meta.env.PROD only for the production *build*, not "production"
// in the AdMob sense — they're independent. Use VITE_USE_PROD_ADS=1 at
// build time to switch to real ad units (typically in the CI workflow that
// produces release IPAs / AABs).
const useProd = import.meta.env.VITE_USE_PROD_ADS === '1';

export function getAdIds(): AdIdSet {
  const platform = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
  const set = useProd ? prod[platform] : test[platform];
  if (useProd && (!set.banner || !set.interstitial)) {
    // eslint-disable-next-line no-console
    console.warn('[ads] VITE_USE_PROD_ADS=1 but adIds.ts has empty prod IDs');
  }
  return set;
}
