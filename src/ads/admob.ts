// Thin wrapper around @capacitor-community/admob. All public functions are
// safe to call on web — they no-op when not running inside Capacitor.
//
// Placement policy:
//   - App open ad (Google's format for app launch, with its own "Continue to
//     app" button):
//       * cold start: ~1.5s after launch, only while the user hasn't touched
//         the app yet and within COLD_START_DEADLINE_MS of launch — an ad that
//         loads later would land on the user's first tap (seen in the Play
//         closed test, when this was an interstitial);
//       * back from the background after at least RESUME_MIN_AWAY_MS away.
//   - Interstitial when a task is done: a solution played to the end, or a
//     Practice case solved. Never for the session's first completed task.
//   - Every full-screen ad (app open or interstitial) is at most 1 per
//     FULL_SCREEN_COOLDOWN_MS.
//   - Banner on Home + Learn pages: adaptive size, just above the tab bar.
//     The page reserves its height at the bottom (see Layout in App.tsx).
//   - Solve / Practice / Camera pages stay banner-free: their controls sit at
//     the bottom and are tapped repeatedly, so a banner there invites
//     accidental clicks.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  type BannerAdOptions,
} from '@capacitor-community/admob';
import { getAdIds } from './adIds';

const isNative = Capacitor.isNativePlatform();

let initialized = false;
let initializing: Promise<void> | null = null;
let bannerVisible = false;
let interstitialReady = false;
let interstitialLoading: Promise<void> | null = null;
let appOpenReady = false;
let appOpenLoadedAt = 0;
let appOpenLoading: Promise<void> | null = null;
let coldStartShown = false;
let lastFullScreenAt = 0;
let firstTaskCompleted = false;
let backgroundedAt = 0;

const FULL_SCREEN_COOLDOWN_MS = 5 * 60 * 1000;
const COLD_START_DELAY_MS = 1500;
const COLD_START_DEADLINE_MS = 10000;
const RESUME_MIN_AWAY_MS = 5 * 60 * 1000;
/** Google: a loaded app open ad expires after four hours. */
const APP_OPEN_MAX_AGE_MS = 4 * 60 * 60 * 1000;

// When the JS bundle started (≈ app launch) and whether the user has touched
// the app since — the cold-start ad must never interrupt an interaction.
const launchedAt = Date.now();
let userInteracted = false;
if (isNative && typeof window !== 'undefined') {
  const markInteracted = () => {
    userInteracted = true;
  };
  window.addEventListener('pointerdown', markInteracted, { capture: true, once: true });
  window.addEventListener('keydown', markInteracted, { capture: true, once: true });
}

function setBannerInsetPx(px: number): void {
  document.documentElement.style.setProperty('--ad-banner-h', `${px}px`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}

function inCooldown(): boolean {
  return Date.now() - lastFullScreenAt < FULL_SCREEN_COOLDOWN_MS;
}

async function ensureInitialized(): Promise<void> {
  if (!isNative) return;
  if (initialized) return;
  if (initializing) return initializing;

  initializing = (async () => {
    await AdMob.initialize({
      // Test ads are gated on adIds.ts (test vs prod). Leaving this false
      // means real-money ads are only requested when prod IDs are in use.
      initializeForTesting: false,
    });

    // UMP consent (GDPR / IDFA). If a consent form is required, show it
    // before requesting any ad. Failures here shouldn't block the app —
    // worst case the user sees non-personalized ads.
    try {
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && !consent.canRequestAds) {
        await AdMob.showConsentForm();
      }
    } catch (err) {
      console.warn('[ads] consent flow failed', err);
    }

    // Banner size events keep the footer inset in sync with the actual
    // ad height (adaptive banners vary by device + orientation). The native
    // banner is a native overlay drawn on top of the WebView, so we have
    // to reserve --ad-banner-h px of CSS space at the bottom ourselves.
    AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => {
      if (bannerVisible && size.height) setBannerInsetPx(size.height);
    }).catch(() => {
      // Older plugin versions may not emit this event; safe to ignore.
    });

    initialized = true;
  })();

  return initializing;
}

export async function initAds(): Promise<void> {
  if (!isNative) return;
  await ensureInitialized();
  // Pre-load both full-screen formats so they show at once when their moment
  // comes. If a load fails (no network etc.), that moment just passes.
  void prepareAppOpen();
  void prepareInterstitial();
  App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      backgroundedAt = Date.now();
      return;
    }
    const away = backgroundedAt ? Date.now() - backgroundedAt : 0;
    backgroundedAt = 0;
    if (away >= RESUME_MIN_AWAY_MS && !inCooldown()) void showAppOpenIfReady();
  }).catch((err: unknown) => console.warn('[ads] appStateChange listener failed', err));
}

function prepareInterstitial(): Promise<void> {
  if (!isNative || interstitialReady) return Promise.resolve();
  // One load at a time.
  if (interstitialLoading) return interstitialLoading;
  interstitialLoading = (async () => {
    try {
      const { interstitial } = getAdIds();
      await AdMob.prepareInterstitial({ adId: interstitial });
      interstitialReady = true;
    } catch (err) {
      console.warn('[ads] prepareInterstitial failed', err);
    } finally {
      interstitialLoading = null;
    }
  })();
  return interstitialLoading;
}

async function showInterstitialIfReady(): Promise<boolean> {
  if (!isNative || !interstitialReady) return false;
  try {
    await AdMob.showInterstitial();
    interstitialReady = false;
    lastFullScreenAt = Date.now();
    void prepareInterstitial(); // reload for next time
    return true;
  } catch (err) {
    console.warn('[ads] showInterstitial failed', err);
    interstitialReady = false;
    return false;
  }
}

function prepareAppOpen(): Promise<void> {
  if (!isNative || appOpenReady) return Promise.resolve();
  // One load at a time: initAds starts it, the cold-start ad waits on it.
  if (appOpenLoading) return appOpenLoading;
  appOpenLoading = (async () => {
    try {
      const { appOpen } = getAdIds();
      await AdMob.loadAppOpen({ adId: appOpen });
      appOpenReady = true;
      appOpenLoadedAt = Date.now();
    } catch (err) {
      console.warn('[ads] loadAppOpen failed', err);
    } finally {
      appOpenLoading = null;
    }
  })();
  return appOpenLoading;
}

async function showAppOpenIfReady(): Promise<boolean> {
  if (!isNative || !appOpenReady) return false;
  if (Date.now() - appOpenLoadedAt > APP_OPEN_MAX_AGE_MS) {
    appOpenReady = false;
    void prepareAppOpen();
    return false;
  }
  try {
    await AdMob.showAppOpen();
    lastFullScreenAt = Date.now();
    return true;
  } catch (err) {
    console.warn('[ads] showAppOpen failed', err);
    return false;
  } finally {
    appOpenReady = false;
    void prepareAppOpen(); // reload for the next return to the app
  }
}

export async function maybeShowColdStartAd(): Promise<void> {
  if (!isNative || coldStartShown) return;
  coldStartShown = true; // mark up front so we don't retry on failure
  await ensureInitialized();
  // Wait briefly so the user sees the app load first; ads on a black
  // screen feel hostile.
  await sleep(COLD_START_DELAY_MS - (Date.now() - launchedAt));
  // Give the preload until the deadline to finish, no longer.
  if (!appOpenReady) {
    await Promise.race([
      prepareAppOpen(),
      sleep(COLD_START_DEADLINE_MS - (Date.now() - launchedAt)),
    ]);
  }
  // Once the user is using the app, a full-screen ad would swallow their tap.
  if (userInteracted || Date.now() - launchedAt > COLD_START_DEADLINE_MS) return;
  await showAppOpenIfReady();
}

/**
 * A task is done — a solution played to the end or a Practice case solved —
 * which is a natural break for an interstitial.
 */
export async function maybeShowTaskCompleteAd(): Promise<void> {
  if (!isNative) return;
  // The session's first completed task is on the house — interrupting a
  // user's first success would set a bad tone.
  if (!firstTaskCompleted) {
    firstTaskCompleted = true;
    return;
  }
  if (inCooldown()) return;
  await ensureInitialized();
  if (!interstitialReady) await prepareInterstitial();
  await showInterstitialIfReady();
}

function tabBarHeightPx(): number {
  if (typeof document === 'undefined') return 56;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-h').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 56;
}

// Whether the current page wants the banner. Showing it is async (SDK init,
// native call), so a page the user leaves quickly can ask to hide it before
// it is up; without this the banner then stayed on banner-free pages
// (seen on Practice after a quick first tap).
let bannerWanted = false;
let bannerPending: Promise<void> | null = null;

export async function showBottomBanner(): Promise<void> {
  if (!isNative) return;
  bannerWanted = true;
  if (bannerVisible || bannerPending) return;
  bannerPending = (async () => {
    await ensureInitialized();
    if (!bannerWanted) return;
    const { banner } = getAdIds();
    // Push the native banner up by the tab bar's height so it sits just ABOVE
    // the in-app bottom tab bar (`margin` is in dp = CSS px). The plugin
    // measures it from the safe area — iOS pins the banner to the safe-area
    // guide, and on Android 8.3+ adds the system-bar inset Capacitor leaves
    // to the page — so the safe inset below the tab bar is already counted.
    const marginPx = tabBarHeightPx();
    const options: BannerAdOptions = {
      adId: banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: marginPx,
    };
    try {
      await AdMob.showBanner(options);
      bannerVisible = true;
      // Optimistic default — adaptive banner is up to ~90px tall depending on
      // device + orientation. The SizeChanged listener refines this once the
      // ad actually renders; the upper bound here keeps content off the ad
      // until then.
      setBannerInsetPx(90);
    } catch (err) {
      console.warn('[ads] showBanner failed', err);
    }
  })();
  try {
    await bannerPending;
  } finally {
    bannerPending = null;
  }
  // The page asked to hide it while it was still coming up.
  if (!bannerWanted) await hideBottomBanner();
}

export async function hideBottomBanner(): Promise<void> {
  if (!isNative) return;
  bannerWanted = false;
  if (!bannerVisible) return;
  try {
    await AdMob.removeBanner();
  } catch (err) {
    console.warn('[ads] removeBanner failed', err);
  }
  bannerVisible = false;
  setBannerInsetPx(0);
}
