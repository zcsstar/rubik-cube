# Android release builds

How to produce a signed `app-release.aab` for upload to Google Play.

## One-command release

```sh
npm run release:android
```

This:

1. Sets `VITE_USE_PROD_ADS=1` so the real AdMob unit IDs are bundled
   (see [ADS.md](ADS.md)).
2. Runs `tsc -b && vite build` to compile the web bundle.
3. Runs `npx cap sync android` to copy `dist/` and plugin metadata into
   `android/app/src/main/assets/`.
4. Runs `./gradlew bundleRelease` to produce a minified, R8-shrunk,
   signed Android App Bundle at:

   `android/app/build/outputs/bundle/release/app-release.aab`

Upload that `.aab` directly to Play Console → *Production* (or
*Internal Testing* — recommended for the first build).

`scripts/gradle.mjs` auto-picks Android Studio's bundled JBR (a full
JDK) for `JAVA_HOME` and the standard Android SDK location for
`ANDROID_HOME`, so the command works out of the box on a machine that
already runs Android Studio.

## Versioning

Before each Play upload, bump both fields in [android/app/build.gradle](android/app/build.gradle):

```gradle
versionCode 1       // monotonically increasing integer; Play rejects duplicates
versionName "1.0.0" // semver, shown to users in the Play listing
```

If you forget to increase `versionCode`, the Play upload will fail with
"Version code N has already been used."

## Keystore — the most important file in the repo

The release AAB is signed with the **upload key** at:

```
android/cubist-upload.keystore
```

Credentials live in:

```
android/keystore.properties
```

**Both files are gitignored. Both must be backed up.** If you lose the
keystore *or* the password:

- You can still recover, because the app uses Google Play App Signing.
  Open Play Console → *Setup → App integrity → Upload key certificate*
  → *Request upload key reset*. Google rotates the upload key for you.
  The end-user signing certificate (managed by Google) is unaffected.
- Without Play App Signing, losing the keystore would mean you can
  never update the app on the Play Store. Always use Play App Signing.

Recommended backup locations (do all three):

1. **A password manager** (1Password, Bitwarden, etc.) — store the
   password and a copy of the `.keystore` file as a secure attachment.
2. **An encrypted drive or USB stick** kept offline.
3. **A second physical location** (laptop at home if your dev machine
   is at the office, or vice versa).

## Verifying the signed AAB

After a build, you can confirm the signature with `jarsigner`:

```sh
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
```

A self-signed upload key produces warnings about *self-signed* and
*no timestamp* — those are normal for upload keys and Play accepts
them. The important line is at the bottom:

```
The signer certificate will expire on YYYY-MM-DD.
```

Play requires upload keys valid until at least 25 years from now;
ours is generated with `-validity 10000` (≈ 27.4 years).

## Generating a new keystore

The repo ships without a keystore (intentionally — secrets stay out of
git). If you clone this repo on a fresh machine, regenerate one:

```sh
keytool -genkeypair -v \
  -keystore android/cubist-upload.keystore \
  -alias cubist-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Cheez, O=Cheez, L=Auckland, ST=Auckland, C=NZ"
```

It will prompt twice for a password. Use the same one for both prompts.

Then write `android/keystore.properties`:

```properties
STORE_PASSWORD=...your password here...
KEY_PASSWORD=...same password...
KEY_ALIAS=cubist-upload
STORE_FILE=cubist-upload.keystore
```

**Important**: a fresh keystore produces a fresh signing fingerprint.
Play will reject the upload as "key fingerprint doesn't match" unless
you've already requested an upload key reset from Google. Don't
regenerate the keystore casually — only when you've actually lost the
original.

## Local debug builds aren't affected

Debug builds (`npm run cap:android`, Android Studio's Run button) still
work without `keystore.properties`. They get auto-signed with the debug
keystore that ships with the Android SDK. Only `bundleRelease` and
`assembleRelease` need the upload keystore.

## What the release build does that debug doesn't

- **`minifyEnabled true`** — R8 strips unused code; the bundle is
  smaller and harder to reverse-engineer.
- **`shrinkResources true`** — unused PNG/XML resources are removed.
- **Real AdMob unit IDs** via `VITE_USE_PROD_ADS=1` instead of
  Google's test IDs.
- **`proguard-android-optimize.txt`** — Google's optimized R8 profile,
  vs the default that just strips dead code.

The `proguard-rules.pro` file keeps Capacitor plugin classes,
`com.google.android.gms.ads.*`, and `androidx.webkit.*` because they
are accessed by reflection at runtime. If you add a plugin that
crashes only in release builds, add `-keep` rules for its package
there.
