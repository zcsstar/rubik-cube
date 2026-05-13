// Thin wrapper around @capacitor-community/admob. All public functions are
// safe to call on web — they no-op when not running inside Capacitor.
//
// Placement policy (final spec):
//   - Cold-start interstitial: at most 1× per session, shown ~1.5s after
//     launch so the splash is visible first.
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
let coldStartShown = false;
let lastInterstitialAt = 0;
let firstSolveCompleted = false;

const INTERSTITIAL_COOLDOWN_MS = 5 * 60 * 1000;
const COLD_START_DELAY_MS = 1500;

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

    // iOS 14+ ATT prompt. On Android this resolves immediately and is a
    // no-op. The user is shown Apple's system prompt; if denied, AdMob
    // falls back to non-personalized ads (fill rate drops but still works).
    if (Capacitor.getPlatform() === 'ios') {
      try {
        const status = await AdMob.trackingAuthorizationStatus();
        if (status.status === 'notDetermined') {
          await AdMob.requestTrackingAuthorization();
        }
      } catch (err) {
        console.warn('[ads] ATT request failed', err);
      }
    }

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

async function prepareInterstitial(): Promise<void> {
  if (!isNative || interstitialReady) return;
  try {
    const { interstitial } = getAdIds();
    await AdMob.prepareInterstitial({ adId: interstitial });
    interstitialReady = true;
  } catch (err) {
    console.warn('[ads] prepareInterstitial failed', err);
  }
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
  await new Promise((r) => setTimeout(r, COLD_START_DELAY_MS));
  // Ensure interstitial has had a chance to load.
  if (!interstitialReady) await prepareInterstitial();
  const shown = await showInterstitialIfReady();
  if (shown) lastInterstitialAt = Date.now();
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

function tabBarHeightPx(): number {
  if (typeof document === 'undefined') return 56;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-h').trim();
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 56;
}

export async function showBottomBanner(): Promise<void> {
  if (!isNative || bannerVisible) return;
  await ensureInitialized();
  const { banner } = getAdIds();
  // Push the native banner up by tab-bar height + system inset so it sits
  // ABOVE the in-app bottom tab bar. AdMob measures `margin` from the
  // anchor position (bottom of the screen for BOTTOM_CENTER), in dp.
  // Push the banner up by tab-bar height + system gesture inset so the
  // tab bar can sit at the very bottom of the screen below the ad.
  // Note: requires the patch in patches/ on Android 15+ — without it the
  // plugin overrides our margin with just the system inset.
  const marginPx = tabBarHeightPx() + measureSafeBottomPx();
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
}

export async function hideBottomBanner(): Promise<void> {
  if (!isNative || !bannerVisible) return;
  try {
    await AdMob.removeBanner();
  } catch (err) {
    console.warn('[ads] removeBanner failed', err);
  }
  bannerVisible = false;
  setBannerInsetPx(0);
}
