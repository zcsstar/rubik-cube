// Thin wrapper around @capacitor-community/admob. All public functions are
// safe to call on web — they no-op when not running inside Capacitor.
//
// Placement policy (final spec):
//   - Cold-start interstitial: at most 1× per session, shown ~1.5s after
//     launch so the splash is visible first — and only while the user hasn't
//     touched the app yet and within COLD_START_DEADLINE_MS of launch. An ad
//     that loads later would land on the user's first tap (seen in the Play
//     closed test: the tap on Solve / Practice was swallowed by the ad).
//   - Banner on Home + Tutorial pages: adaptive size, anchored bottom.
//     The WebView footer gets a CSS-driven safe-area inset so it isn't
//     hidden by the banner.
//   - Post-solve interstitial: after a solution is fully stepped through,
//     capped to 1× per 5 minutes, and never before the user finishes
//     their first solve of the session.
//   - Solve / Practice / Camera pages stay banner-free.

import { Capacitor } from '@capacitor/core';
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
let coldStartShown = false;
let lastInterstitialAt = 0;
let firstSolveCompleted = false;

const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const COLD_START_DELAY_MS = 1500;
const COLD_START_DEADLINE_MS = 10000;

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
  // Pre-load an interstitial so cold-start + first post-solve trigger feel
  // instant. If the load fails (no network etc.), we just skip showing.
  void prepareInterstitial();
}

function prepareInterstitial(): Promise<void> {
  if (!isNative || interstitialReady) return Promise.resolve();
  // One load at a time: initAds starts it, the cold-start ad waits on it.
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, Math.max(0, ms)));
}

async function showInterstitialIfReady(): Promise<boolean> {
  if (!isNative || !interstitialReady) return false;
  try {
    await AdMob.showInterstitial();
    interstitialReady = false;
    lastInterstitialAt = Date.now();
    void prepareInterstitial(); // reload for next time
    return true;
  } catch (err) {
    console.warn('[ads] showInterstitial failed', err);
    interstitialReady = false;
    return false;
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
  if (!interstitialReady) {
    await Promise.race([
      prepareInterstitial(),
      sleep(COLD_START_DEADLINE_MS - (Date.now() - launchedAt)),
    ]);
  }
  // Once the user is using the app, a full-screen ad would swallow their tap.
  if (userInteracted || Date.now() - launchedAt > COLD_START_DEADLINE_MS) return;
  await showInterstitialIfReady();
}

export async function maybeShowPostSolveAd(): Promise<void> {
  if (!isNative) return;
  // First solve of the session is on the house — interrupting a user's
  // first success would set a bad tone.
  if (!firstSolveCompleted) {
    firstSolveCompleted = true;
    return;
  }
  if (Date.now() - lastInterstitialAt < INTERSTITIAL_COOLDOWN_MS) return;
  await ensureInitialized();
  if (!interstitialReady) await prepareInterstitial();
  await showInterstitialIfReady();
}

/**
 * Resolve the actual pixel value of `env(safe-area-inset-bottom)` via a
 * hidden probe element. CSS `env()` doesn't expand inside getComputedStyle,
 * so we measure it by rendering a 0-width box whose height is the inset.
 */
function measureSafeBottomPx(): number {
  if (typeof document === 'undefined') return 0;
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;left:0;bottom:0;width:0;visibility:hidden;height:env(safe-area-inset-bottom,0px)';
  document.body.appendChild(probe);
  const h = probe.getBoundingClientRect().height;
  probe.remove();
  return Math.round(h);
}

/**
 * Where the plugin measures `margin` from. iOS pins the banner to the
 * safe-area layout guide, so the home-indicator inset is already below it.
 * On Android our patch (patches/) measures from the WebView's bottom edge,
 * so the page's own safe-area inset has to be added. Adding the inset on iOS
 * too left a gap under the banner the size of the inset, and the banner
 * covered that much of the page.
 */
function marginIncludesSafeInset(): boolean {
  return Capacitor.getPlatform() !== 'ios';
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
    // Push the native banner up by the tab bar's full height so it sits just
    // ABOVE the in-app bottom tab bar (`margin` is in dp = CSS px).
    // Note: on Android this relies on the patch in patches/ — without it the
    // plugin positions the banner from the window insets instead.
    const marginPx = tabBarHeightPx() + (marginIncludesSafeInset() ? measureSafeBottomPx() : 0);
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
