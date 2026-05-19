# Releasing Cubist

Operational guide for shipping new versions to the App Store and Google
Play. Read this before every release.

---

## Quick reference

| Want to do | Where |
|---|---|
| Ship to iOS TestFlight | GitHub → Actions → **iOS Release (TestFlight)** → Run workflow |
| Ship to Play Internal Testing | Run `npm run release:android`, then upload the `.aab` to Play Console |
| Bump version | Edit [package.json](package.json) **and** [android/app/build.gradle](android/app/build.gradle) |
| Regenerate native + PWA icons | `npm run assets:all` |
| Verify iOS builds without uploading | Push to `main`, watch [ios-build.yml](.github/workflows/ios-build.yml) |
| Swap real ad units | Already in place; see [ADS.md](ADS.md) |

---

## Step-by-step: ship a new version

Assume you want to ship `1.0.3`.

### 1. Bump the version (one commit, two files)

```diff
# package.json
- "version": "1.0.2",
+ "version": "1.0.3",
```

```diff
# android/app/build.gradle
-        versionCode 3
-        versionName "1.0.2"
+        versionCode 4
+        versionName "1.0.3"
```

`versionCode` must be **strictly increasing** — Play rejects duplicates. `versionName` is the user-facing string and should match `package.json`. iOS reads `package.json` automatically via the workflow.

Commit + push.

### 2. iOS — fire the release workflow

1. GitHub → Actions → **iOS Release (TestFlight)** → **Run workflow** (top-right) → field blank → **Run**.
2. Wait ~3–4 min for the run to complete.
3. App Store Connect → your app → **TestFlight** tab.
4. New build appears as "Processing" for 5–15 min. Once it's "Ready":
   - Click into the build → **Missing Compliance** → answer **No** (encryption).
   - Sidebar → **Cubist core** (Internal Testing group) → **+** next to Builds → add the new build.
5. Open **TestFlight** on your iPhone → pull to refresh → **Install** the new build.
6. Validate.

### 3. Android — sign and upload locally

```sh
npm run release:android
```

Produces `android/app/build/outputs/bundle/release/app-release.aab` (signed
with the upload key in `android/cubist-upload.keystore`).

1. Play Console → your app → **Test and release → Testing → Internal testing → Create new release**.
2. Upload the `.aab`.
3. Release notes (English):
   ```
   <one or two lines describing what changed>
   ```
4. **Save** → **Review release** → **Start rollout to Internal testing**.
5. Within ~10 min, your registered internal testers (you + anyone you've
   added in the Testers tab) can install via the opt-in link on a real
   Android device.

### 4. Submit for store review (when ready for public release)

After you've validated the build on both platforms:

- **iOS**: App Store Connect → Version 1.0.X → **Add for Review** (top-right). Apple review takes 1–3 days.
- **Android**: Promote the Internal track release → **Closed → Open → Production**. New developer accounts (created after 2023-11-13) require **12+ closed testers for 14 days** before Production rollout.

---

## Secrets and accounts

### iOS

| What | Where it lives | Used by |
|---|---|---|
| Apple Developer Program | `nzcheez@gmail.com` Apple ID | Everything |
| App in App Store Connect | `appstoreconnect.apple.com` → Cubist – Cube Solver & Tutor | TestFlight + review |
| Bundle ID | `com.cheez.cubist` registered in dev portal | Build + signing |
| Distribution cert + provisioning profile | Encrypted in private repo `zcsstar/cubist-match` (managed by `fastlane match`) | Every iOS release run |
| App Store Connect API key (.p8) | One-shot download from `appstoreconnect.apple.com → Users and Access → Integrations`. **Backed up in 1Password.** | Workflow auth |

iOS GitHub secrets (`rubik-cube` repo → Settings → Secrets → Actions):

| Secret | What it is |
|---|---|
| `APPSTORE_KEY_ID` | The 10-char Key ID from App Store Connect Integrations |
| `APPSTORE_ISSUER_ID` | The UUID Issuer ID from the same page |
| `APPSTORE_PRIVATE_KEY` | Full PEM contents of the `.p8` file |
| `APPSTORE_TEAM_ID` | The 10-char Team ID from developer.apple.com → Membership |
| `MATCH_GIT_URL` | `https://github.com/zcsstar/cubist-match.git` |
| `MATCH_GIT_BASIC_AUTHORIZATION` | `base64("zcsstar:<PAT-with-repo-scope>")` |
| `MATCH_PASSWORD` | Password encrypting the cert/profile in the match repo. **Backed up in 1Password.** |

> ⚠️ **If you lose `MATCH_PASSWORD`, the match repo is unreadable.** You'd
> have to revoke the cert in Apple's dev portal, delete the match repo
> contents, set a new password, and let the next workflow run rebuild.

### Android

| What | Where it lives | Used by |
|---|---|---|
| Google Play Console account | `nzcheez@gmail.com` Google account | Internal testing + production |
| App in Play Console | `play.google.com/console` → Cubist | Listing + uploads |
| Upload keystore | `android/cubist-upload.keystore` (gitignored), `android/keystore.properties` (gitignored). **Backed up in 1Password + offline.** | Signing |
| Play App Signing key | Held by Google. We never see it. | Final on-device APK signing |

If you ever lose the upload keystore *or* its password:

1. Play Console → Setup → App integrity → **Upload key certificate** → **Request upload key reset**.
2. Google rotates the upload key (~1 day) so you can keep updating the app.
3. The Play App Signing key — the one users actually verify against — is
   unaffected. Existing installs keep working.

### AdMob

- AdMob console: `apps.admob.com` signed in with `nzcheez@gmail.com`.
- App IDs hardcoded in:
  - `android/app/src/main/res/values/strings.xml` (`admob_app_id`)
  - `ios/App/App/Info.plist` (`GADApplicationIdentifier`)
- Ad-unit IDs in `src/ads/adIds.ts` (prod block).
- Builds with `VITE_USE_PROD_ADS=1` (set by both release scripts) request
  the real units. Default builds use Google's documented test IDs.

---

## When things break

### iOS workflow fails on signing

| Symptom | Likely cause | Fix |
|---|---|---|
| `Could not create another Distribution certificate` | This shouldn't happen with match. If it does, the match repo was wiped or you revoked the cert. | Clean cubist-match repo → revoke any orphan certs in dev portal → re-run workflow |
| `Error cloning certificates git repo` | `MATCH_GIT_BASIC_AUTHORIZATION` malformed (often a trailing newline), or PAT expired | Regenerate base64 of `zcsstar:<fresh-PAT>` and update the secret |
| `Unsupported SDK or Xcode version` | Apple released a newer Xcode; runner is behind | Bump the runner image to the next `macos-XX` label and re-run |
| `iOS XX.X Platform Not Installed` | Xcode is there but SDK isn't | The workflow runs `xcodebuild -downloadPlatform iOS` already; ensure that step ran |
| `App requires a provisioning profile` | match's `--readonly false` flag missing on first run, or profile not in match repo | The workflow already passes `--readonly false`. Check the match repo has a `profiles/appstore/` folder for `com.cheez.cubist` |

### Apple sign-in tokens expire

The App Store Connect API key is valid forever unless you revoke it. The
PAT for the match repo expires after 1 year (max for classic PAT).

When the PAT expires:
1. https://github.com/settings/tokens → Regenerate `Cubist match repo access`
2. Recompute the base64: `echo -n "zcsstar:<new-PAT>" | base64 -w 0` (Git Bash) or `[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("zcsstar:<new-PAT>"))` (PowerShell)
3. Update `MATCH_GIT_BASIC_AUTHORIZATION` secret in GitHub

### Apple Distribution cert expires (every 1 year)

Symptoms: `fastlane match` fails or `xcodebuild archive` complains about
an expired certificate.

1. Revoke the expiring cert in dev portal → Certificates.
2. In the workflow logs from a previous run, find the `fastlane match`
   call that ran (it cached the now-expired cert in the match repo).
3. Either delete the contents of `cubist-match` and re-run the workflow
   (it'll create a fresh cert + profile), or run `fastlane match nuke
   distribution` locally to clean Apple's side AND the match repo in one
   shot, then re-run the workflow.

### Build crashes on iPhone but works on simulator

Capture the crash log from the iPhone:

1. iPhone → Settings → Privacy & Security → Analytics & Improvements → Analytics Data → search for `Cubist`
2. Tap a log → share → email to yourself
3. Submit to `nzcheez@gmail.com` for review

For TestFlight builds, you can also see crashes in App Store Connect →
TestFlight → Crashes.

---

## First-time setup (already done; for reference only)

Run once on this account; you won't need to redo unless you migrate or
the records get lost.

- Apple Developer Program enrolment ($99/yr; auto-renews)
- Bundle ID `com.cheez.cubist` registered in dev portal
- App entry created in App Store Connect
- App Store Connect API key generated + downloaded as `.p8`
- Apple Team ID noted
- Cubist app registered in AdMob (iOS + Android entries with their own app IDs)
- 2 ad units per platform created in AdMob (Banner + Interstitial)
- Google Play Console account paid ($25 one-time)
- App registered in Play Console with bundle ID `com.cheez.cubist`
- Android upload keystore generated locally (`android/cubist-upload.keystore`)
- Privacy policy hosted at https://zcsstar.github.io/rubik-cube/privacy (in-app React route) AND https://zcsstar.github.io/rubik-cube/privacy/ (static page for crawlers)
- `cubist-match` private repo created on GitHub
- Personal Access Token created with `repo` scope for the match repo
- Distribution cert + AppStore profile created and stored in `cubist-match` via `fastlane match`

---

## Related docs

- [README.md](README.md) — what the app is, how to run locally
- [ADS.md](ADS.md) — AdMob unit ID locations and the test/prod toggle
- [ANDROID-RELEASE.md](ANDROID-RELEASE.md) — Android-specific keystore + Gradle details
