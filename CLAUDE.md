# Project notes for Claude

Context that's specific to this codebase and the operational decisions
already in place. Read this before making architectural changes,
adding dependencies, or shipping a release. For account-specific
identifiers (Apple ID, GitHub username, private repo names), check the
`ops/` folder — gitignored, lives only on the developer's machine.

## What this is

A 2×2 / 3×3 Rubik's Cube solver and tutor. Pure-TS solver logic in
[`src/core/`](src/core/), React UI in [`src/ui/`](src/ui/). Ships as
three artifacts from one codebase:

- **Web PWA** — deployed to GitHub Pages from `main`
- **iOS app** — Capacitor wrap, distributed via App Store
- **Android app** — Capacitor wrap, distributed via Google Play

The boundary between `core/` and `ui/` is strict: `core/` has zero
React or DOM imports. New solvers or cube models go in `core/`; new
pages or components in `ui/`.

## Build outputs

| Target | Trigger | Output |
|---|---|---|
| Web (dev) | `npm run dev` | Vite dev server at `localhost:5173` |
| Web (GH Pages) | `git push main` | `dist/` deployed by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) with `DEPLOY_TARGET=gh-pages` |
| Web (Capacitor) | Implicit in iOS / Android workflows | `dist/` with relative `./` asset paths |
| iOS IPA | GitHub Actions → **iOS Release (TestFlight)** | TestFlight upload via [`.github/workflows/ios-release.yml`](.github/workflows/ios-release.yml) |
| Android AAB | `npm run release:android` locally | Signed `app-release.aab` ready for Play upload |

## Critical architecture decisions

### Vite base path
The Vite config reads `process.env.DEPLOY_TARGET`. Only the GH Pages
workflow sets `DEPLOY_TARGET=gh-pages`, producing `/rubik-cube/` asset
URLs. Every other context (dev, Capacitor iOS, Capacitor Android,
preview) gets `base: './'`. **Do not** key this off `GITHUB_ACTIONS`
because the iOS release workflow also runs on GitHub Actions and needs
relative paths for the Capacitor WebView. Symptom of getting it wrong:
iOS app launches into a blank white screen (assets 404).

### iOS signing — fastlane match
The iOS release workflow uses `fastlane match` against a **private
GitHub repo** (referenced via `MATCH_GIT_URL` secret). One Distribution
certificate, encrypted with `MATCH_PASSWORD`, lives in that repo and is
reused on every CI run. **Do not** revert to `fastlane cert + fastlane
sigh` — that path creates a new cert per run and hits Apple's 3-per-team
cert cap after a handful of releases.

### iOS pbxproj overrides
The Capacitor template's `ios/App/App.xcodeproj/project.pbxproj` ships
with legacy signing values that don't work for App Store distribution:

- `CODE_SIGN_IDENTITY` set to `"iPhone Developer"` (legacy name for the
  Development cert). Release config has been switched to
  `CODE_SIGN_IDENTITY[sdk=iphoneos*] = "Apple Distribution"`.
- `CODE_SIGN_STYLE` switched to `Manual` for the Release target so
  `fastlane match` can supply the profile name explicitly.

Don't run `npx cap sync` expecting it to keep these overrides — they
live in the committed pbxproj. If a future Capacitor upgrade wipes the
file, restore the manual signing setup from git history.

### iOS WebView contentInset
`capacitor.config.ts` has `ios.contentInset: 'never'`. Together with
the CSS `padding-top: env(safe-area-inset-top)` on the sticky header,
this gives a single inset for the notch. Setting it to `'always'` or
the older default causes a ~200 px white gap above the header (both
the WebView and our CSS each add the inset).

### iOS Camera permission
`navigator.mediaDevices.getUserMedia` is only exposed inside iOS
WKWebView when `NSCameraUsageDescription` is present in
[`ios/App/App/Info.plist`](ios/App/App/Info.plist). Without it the
whole `mediaDevices` object is undefined and the in-app camera
component reports "your browser does not support camera access".

### Xcode version on the runner
macos-26 ships every Xcode 26.x including unreleased seeds. App Store
Connect rejects uploads from seed Xcodes with `error 90534: Unsupported
SDK or Xcode version`. The workflow's "Select latest stable Xcode" step
iterates Xcodes highest-to-lowest, runs `xcodebuild -version`, and
picks the first one whose build number ends in a digit (i.e. not a
beta seed marker like `17F5022i`).

### AdMob plugin patch
`@capacitor-community/admob` 8.x ignores the user-provided `margin`
option on Android 15+ — the plugin's window-insets listener overwrites
it with just the system gesture inset. We patch
`BannerExecutor.java` to add our margin on top of the inset. Patch
is in [`patches/`](patches/) and applied via
[`patch-package`](https://github.com/ds300/patch-package) on `npm
install`. Don't bump the plugin major without verifying the patch
still applies (or upstreaming the fix).

### Cloudflare Web Analytics gate
[`index.html`](index.html) loads the CF Analytics beacon but only when
`window.Capacitor` is absent. The native apps **must not** ping CF
because our App Store / Play data-safety declaration says "no
analytics from native". Apple and Google cross-check this during
review.

### Static privacy page
The React `/privacy` route works for users inside the app, but the GH
Pages SPA-404 fallback returns HTTP 404 from the static host, which
Google Play's crawler rejects even though the page renders fine in a
browser. A real static page at `public/privacy/index.html` mirrors the
React copy and gives crawlers an HTTP 200. **Keep the two in sync** if
the React route's content changes.

### @capacitor/assets ic_launcher.xml
Every `npm run assets:native` run rewrites
`android/app/src/main/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml`
to reference `@mipmap/ic_launcher_background` — a resource the
generator never creates. Manually patch both files back to
`@color/ic_launcher_background` (the color resource is defined in
`values/ic_launcher_background.xml`) after every regeneration. The
Android build fails to link without this fix.

## Where things live

| Concern | Location |
|---|---|
| Solver and cube logic | [`src/core/`](src/core/) — pure TS, no React, no DOM |
| React pages and components | [`src/ui/`](src/ui/) |
| i18n locales | [`src/core/i18n/locales/`](src/core/i18n/locales/) — `en.ts`, `zh.ts` |
| Native ad logic | [`src/ads/admob.ts`](src/ads/admob.ts), [`src/ads/adIds.ts`](src/ads/adIds.ts) |
| Capacitor native iOS project | [`ios/App/`](ios/App/) |
| Capacitor native Android project | [`android/`](android/) |
| Cross-platform asset sources | [`assets/`](assets/) — for `@capacitor/assets` |
| Source-of-truth originals | [`store-assets/`](store-assets/) — never bundled to web |
| Web-served assets | [`public/`](public/) |
| Workflows | [`.github/workflows/`](.github/workflows/) |
| Personal operational notes | `ops/` — gitignored, ask the user if needed |

## Release cadence

For a new version `1.0.X`:

1. Bump `"version"` in [`package.json`](package.json) — canonical
   marketing version for iOS.
2. Bump `versionCode` (next int) **and** `versionName` (to `1.0.X`) in
   [`android/app/build.gradle`](android/app/build.gradle).
3. Commit both in one commit, push.
4. **iOS**: Actions → iOS Release → Run workflow → input blank
   (workflow reads version from `package.json`).
5. **Android**: `npm run release:android` locally, upload the AAB to
   Play Console.
6. App Store Connect: answer Missing Compliance = No, attach build to
   Cubist core group.
7. Play Console: write release notes, start rollout to Internal track.

## Common errors and root causes

| Symptom | Where to look |
|---|---|
| iOS app launches into blank white screen | Vite base path leaked GH Pages prefix (`DEPLOY_TARGET` regression) |
| iOS app has big white band above the header | `ios.contentInset` not `'never'` in `capacitor.config.ts` |
| In-app camera says "browser does not support" | `NSCameraUsageDescription` missing from Info.plist |
| `Could not create another Distribution certificate` | match repo wiped or cert revoked manually; restore via fresh match run |
| `Error cloning certificates git repo` | `MATCH_GIT_BASIC_AUTHORIZATION` malformed (trailing newline) or PAT expired |
| `Unsupported SDK or Xcode version` (90534) | Beta-seed Xcode picked; check the "Select Xcode" step's build-suffix filter |
| Android build links fail on `mipmap/ic_launcher_background` | Adaptive-icon XML regression — re-apply the `@color/...` patch |
| Play console rejects upload "no signing key" | `keystore.properties` missing on the machine running `release:android` |

## When in doubt

If a step in the release pipeline fails in a way that isn't in the
table above, the failure is almost always in the *most recent* change
to the workflow, plugin patch, or Capacitor template. Check the diff
against the last known-good run before re-deriving from scratch.

Operational specifics that aren't in this file (Apple ID, exact secret
values, match repo URL, etc.) live in `ops/` on the developer's
machine. Ask the user for them rather than guessing or hardcoding.
