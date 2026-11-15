# Ads — what to replace before launch

The repo ships with Google's **AdMob test IDs** committed everywhere — those
return guaranteed test ads on real devices, so you can build, install, and
QA without earning revenue *or* risking a policy strike for clicking your
own real ads.

When you're ready to publish, swap in the real IDs from your AdMob console.
Three places to edit, all flagged with `TODO before launch`-style comments.

## 1. Android app ID — `android/app/src/main/res/values/strings.xml`

```xml
<string name="admob_app_id">ca-app-pub-3940256099942544~3347511713</string>
```

Replace the value with the Android app ID from AdMob → *Apps → App settings*.
Format is `ca-app-pub-<publisher>~<app>`.

## 2. iOS app ID — `ios/App/App/Info.plist`

```xml
<key>GADApplicationIdentifier</key>
<string>ca-app-pub-3940256099942544~1458002511</string>
```

Replace with the iOS app ID. Different from the Android one — each platform
gets its own AdMob app entry.

## 3. Ad unit IDs — `src/ads/adIds.ts`

```ts
const prod: Record<'ios' | 'android', AdIdSet> = {
  ios:     { banner: '', interstitial: '' },
  android: { banner: '', interstitial: '' },
};
```

In AdMob, create **two ad units** per platform: one Banner and one
Interstitial. Paste each unit ID into the table above. Format is
`ca-app-pub-<publisher>/<unit>` (note the `/`, not `~`).

Then, in your release build, set the env var so the app uses these instead
of the bundled test IDs:

```sh
VITE_USE_PROD_ADS=1 npm run build
```

The CI workflow that produces store-bound IPAs / AABs should set this; the
default `npm run build` keeps test IDs so dev builds never charge real
advertisers. On Android, `npm run release:android` (live ads) is for the
Production track only; testing tracks get `npm run release:android:test`
(test ads) — see CLAUDE.md, release cadence.

## Placement summary

| Surface                          | Format        | Frequency                                                  |
|----------------------------------|---------------|------------------------------------------------------------|
| Cold start                       | App open      | 1× per session, 1.5s after launch; skipped once the user has touched the app or if it isn't loaded within 10s |
| Back from the background         | App open      | After at least 5 min away |
| Home page                        | Adaptive banner | Always visible, just above the tab bar                   |
| Learn / Tutorial pages           | Adaptive banner | Always visible, just above the tab bar                   |
| A solution played to the end, or a Practice case solved | Interstitial | Never for the session's first completed task |
| Solve in-flow, Practice, Camera  | No banner     | Their controls sit at the bottom and are tapped repeatedly — a banner there invites accidental clicks, which AdMob treats as invalid traffic |

Every full-screen ad (app open or interstitial) is at most 1× per 5 min.
The rules live in `src/ads/admob.ts`. App open is Google's format for app
launch: it carries its own "Continue to app" button, so the user can skip
straight in. The page reserves `--ad-banner-h` at its end (Layout in
`src/App.tsx`) so the footer scrolls clear of the banner.

Ad units (publisher 2269650446819543), also in `src/ads/adIds.ts`:

| Unit | iOS | Android |
|---|---|---|
| Banner | `/5968405918` | `/8237906648` |
| Interstitial | `/1808229661` | `/2901819480` |
| App open (created 2026-11-15) | `/8223253648` | `/1268952154` |

## Revenue ideas to research (owner, 2026-11-15)

Done in 1.0.10–1.0.11: GDPR consent message for both apps (EEA/UK users can
now get personalised ads), app open ads, interstitial after a solved Practice
case. Still to look at:

1. **Mediation / bidding** — let other networks (Meta Audience Network,
   AppLovin, Unity, …) bid alongside AdMob for higher prices, no UI change.
   Needs accounts with those networks and their SDK adapters (a native build).
2. **iOS App Tracking Transparency** — without it iOS ads are
   non-personalised and earn less, and iOS earns most of Cubist's revenue.
   1.0.9 removed ATT to clear App Review; find out why it was rejected
   before adding it back.
3. **In-app privacy settings** — a "Privacy settings" entry that shows the
   UMP privacy options form, so users can change their consent (Google
   expects one when the form is required).
4. **Growth** — revenue scales with users: store listing, screenshots,
   keywords, promotion.
5. Not recommended: banners on Solve / Practice / Camera (accidental clicks,
   less room for the cube; banner prices are low).

## Consent & tracking

- **iOS ATT prompt** — removed in 1.0.9 to clear App Review; iOS ads are
  non-personalised until it comes back (see "Revenue ideas" above).
- **UMP (GDPR consent form)** — AdMob → *Privacy & messaging* → European
  regulations → "Cubist - GDPR consent" (English and Simplified Chinese;
  Consent, Do not consent, Manage options; both apps), published
  2026-11-15 — before that neither app had one, and `requestConsentInfo()`
  failed with "no form(s) configured". The app calls `requestConsentInfo()`
  and `showConsentForm()` on first launch when required.

## Verifying the integration

1. Build locally for Android: `npm run cap:android` (Android Studio
   required). Run on a device or emulator with Play Services; you should
   see a test banner on Home and a test interstitial 1.5s after launch.
2. The same flow on iOS needs a Mac with Xcode for actual installation;
   GitHub Actions verifies the project still compiles every push to main.
3. After swapping in real IDs, **do not click your own ads** — AdMob will
   strike the account. Use a real test device profile from AdMob if you
   need to validate live ad delivery.
