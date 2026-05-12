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
advertisers.

## Placement summary

| Surface                          | Format        | Frequency                                                  |
|----------------------------------|---------------|------------------------------------------------------------|
| Cold start                       | Interstitial  | 1× per session, shown 1.5s after launch                    |
| Home page                        | Adaptive banner | Always visible, anchored bottom                          |
| Learn / Tutorial pages           | Adaptive banner | Always visible, anchored bottom                          |
| After completing a solution      | Interstitial  | At most 1× per 5 min, never before the first solve of session |
| Solve in-flow, Practice, Camera  | None          | —                                                          |

The cooldowns are enforced in `src/ads/admob.ts` — adjust there if you want
to tune. The body CSS reserves `padding-bottom: var(--ad-banner-h)` so the
app footer is not covered by the OS-level banner overlay.

## Consent & tracking

- **iOS ATT prompt** — auto-shown on first AdMob init via
  `AdMob.requestTrackingAuthorization()`. The user-facing copy lives in
  `NSUserTrackingUsageDescription` in `Info.plist` and explains that the
  app stays free either way. Updating it is fair game; review guidelines
  require it to actually describe what tracking is used for.
- **UMP (GDPR consent form)** — Created in AdMob → *Privacy & messaging*.
  The app calls `requestConsentInfo()` and `showConsentForm()` on first
  launch when required. No engineering work; configure the messages in
  the AdMob console.

## Verifying the integration

1. Build locally for Android: `npm run cap:android` (Android Studio
   required). Run on a device or emulator with Play Services; you should
   see a test banner on Home and a test interstitial 1.5s after launch.
2. The same flow on iOS needs a Mac with Xcode for actual installation;
   GitHub Actions verifies the project still compiles every push to main.
3. After swapping in real IDs, **do not click your own ads** — AdMob will
   strike the account. Use a real test device profile from AdMob if you
   need to validate live ad delivery.
