// Cross-platform Gradle runner for the Capacitor Android project. Picks
// gradlew.bat on Windows and ./gradlew elsewhere, and falls back to the
// JDK bundled with Android Studio if JAVA_HOME isn't set. Use it from npm
// scripts as `node scripts/gradle.mjs <task> [...args]`.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ANDROID_DIR = resolve(process.cwd(), 'android');
const isWin = process.platform === 'win32';
// On Windows cmd's PATH lookup doesn't include the current directory, so we
// have to prefix the script name explicitly.
const gradlew = isWin ? '.\\gradlew.bat' : './gradlew';

// Always prefer Android Studio's bundled JBR (a full JDK) over whatever
// JAVA_HOME points to, because the typical Windows JAVA_HOME is OpenLogic's
// JRE (runtime only, no javac), which fails the Android Plugin's
// Java Toolchain check.
function pickJdk() {
  const candidates = isWin
    ? [
        'C:\\Program Files\\Android\\Android Studio\\jbr',
        process.env.JAVA_HOME,
      ]
    : [
        '/Applications/Android Studio.app/Contents/jbr/Contents/Home',
        process.env.JAVA_HOME,
      ];
  for (const c of candidates) {
    if (!c) continue;
    const javac = isWin ? `${c}\\bin\\javac.exe` : `${c}/bin/javac`;
    if (existsSync(javac)) return c;
  }
  return undefined;
}

// Default Android SDK location for each platform; checked in order.
function pickAndroidSdk() {
  const fromEnv = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const candidates = isWin
    ? [`${process.env.LOCALAPPDATA ?? ''}\\Android\\Sdk`]
    : [
        `${process.env.HOME ?? ''}/Library/Android/sdk`,
        `${process.env.HOME ?? ''}/Android/Sdk`,
      ];
  for (const c of candidates) if (c && existsSync(c)) return c;
  return undefined;
}

const env = { ...process.env };
const javaHome = pickJdk();
if (javaHome) env.JAVA_HOME = javaHome;
const sdk = pickAndroidSdk();
if (sdk) {
  env.ANDROID_HOME = sdk;
  env.ANDROID_SDK_ROOT = sdk;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/gradle.mjs <gradle-task> [...args]');
  process.exit(2);
}

// Pin Gradle's Java Toolchain to JAVA_HOME so it doesn't pick up some
// other JRE found on PATH (the Android Gradle plugin uses Toolchain for
// compileJava, separate from the daemon's JAVA_HOME). With shell:true on
// Windows, the path needs to be quoted because spaces break the cmd
// argument split.
const extra = [];
if (env.JAVA_HOME) {
  const quoted = isWin ? `"${env.JAVA_HOME}"` : env.JAVA_HOME;
  extra.push(`-Dorg.gradle.java.installations.paths=${quoted}`);
  extra.push('-Dorg.gradle.java.installations.auto-detect=false');
  extra.push('-Dorg.gradle.java.installations.auto-download=false');
}

const result = spawnSync(gradlew, [...extra, ...args], {
  cwd: ANDROID_DIR,
  stdio: 'inherit',
  env,
  shell: isWin, // gradlew.bat needs the shell on Windows
});
process.exit(result.status ?? 1);
