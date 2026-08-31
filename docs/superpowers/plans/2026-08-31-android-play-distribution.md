# Android Play Store Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FinanceTracker to Google Play as a signed Android App Bundle with a complete store listing kit, without weakening its offline or privacy guarantees.

**Architecture:** Capacitor 8 wraps the existing static site as a native Android app. A copy-only staging script moves an allowlist of web assets into `www/`, which Capacitor syncs into the APK. The web app itself is never modified and keeps its no-build-step workflow. Store screenshots are captured from the real running app using headless Chrome against a local dev server that seeds demo state at the HTTP layer, so no store-only code enters `index.html`.

**Tech Stack:** Node 22 (already installed), Capacitor 8.5.0, Gradle/AGP via Capacitor, Android SDK 36 (already installed), headless Chrome (already installed), JDK 17 Temurin (already installed).

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `docs/superpowers/specs/2026-08-31-android-play-distribution-design.md`.

- Application ID is exactly `io.github.romantrokachevskyi.dozarplaty`. Permanent, never changes.
- App name (uk) is exactly `До зарплати`. App name (en) is exactly `Until Payday`.
- Initial `versionName` is `1.0.0`, initial `versionCode` is `1`.
- `compileSdk` and `targetSdk` are `36`. Play rejects new submissions below 36 as of 2026-08-31.
- `androidScheme` is `https`, producing the origin `https://localhost`. Never change it after first release — it would destroy every user's `localStorage`.
- `android:allowBackup` is `false`. Auto Backup would transmit user financial data to Google Drive.
- `index.html`, `manifest.webmanifest`, and `icons/` are **never modified** by this work. No store-only code, no seeding hooks, no analytics.
- No network calls are added to the shipped app.
- The agent never creates, reads, stores, or transmits the keystore password. The developer runs `keytool` themselves.
- `scripts/check.mjs` must pass at the end of every task.
- Each instruction file under `.agents/` and `AGENTS.md` stays at or under 120 lines (enforced by `scripts/check.mjs`).

---

### Task 1: Web asset staging and npm scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `scripts/build-web.mjs`
- Create: `scripts/android-check.mjs`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: `scripts/build-web.mjs` default behavior — running `node scripts/build-web.mjs` empties and repopulates `www/` at the repo root with exactly `index.html`, `manifest.webmanifest`, and `icons/`. `scripts/android-check.mjs` exports `async function checkAndroid(): Promise<string[]>` returning an array of failure message strings (empty when all contracts hold). Later tasks append checks to this same function.

- [ ] **Step 1: Write the failing check**

Create `scripts/android-check.mjs`:

```js
import { readFile, readdir } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);

const WEB_ASSETS = ["index.html", "manifest.webmanifest", "icons"];

async function readIfPresent(relativePath) {
  try {
    return await readFile(new URL(relativePath, ROOT), "utf8");
  } catch {
    return null;
  }
}

async function checkStaging(failures) {
  const source = await readIfPresent("scripts/build-web.mjs");
  if (source === null) {
    failures.push("scripts/build-web.mjs is missing");
    return;
  }
  for (const asset of WEB_ASSETS) {
    if (!source.includes(`"${asset}"`)) {
      failures.push(`build-web.mjs must stage ${asset}`);
    }
  }
  for (const forbidden of ["node_modules", "docs", ".agents", "android"]) {
    if (source.includes(`"${forbidden}"`)) {
      failures.push(`build-web.mjs must not stage ${forbidden}`);
    }
  }
}

async function checkGitignore(failures) {
  const ignore = await readIfPresent(".gitignore");
  if (ignore === null) {
    failures.push(".gitignore is missing");
    return;
  }
  for (const entry of ["node_modules", "www/", "keystore.properties", "*.jks"]) {
    if (!ignore.includes(entry)) {
      failures.push(`.gitignore must ignore ${entry}`);
    }
  }
}

export async function checkAndroid() {
  const failures = [];
  await checkStaging(failures);
  await checkGitignore(failures);
  return failures;
}
```

Wire it into `scripts/check.mjs` by adding the import next to the existing `checkBehavior` import:

```js
import { checkAndroid } from "./android-check.mjs";
```

and adding this line immediately before the final `if (failures.length)` block:

```js
failures.push(...await checkAndroid());
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL, listing `scripts/build-web.mjs is missing` and `.gitignore is missing`.

- [ ] **Step 3: Create the staging script**

Create `scripts/build-web.mjs`:

```js
import { cp, mkdir, rm } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const OUT = new URL("www/", ROOT);

const ENTRIES = ["index.html", "manifest.webmanifest", "icons"];

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const entry of ENTRIES) {
  await cp(new URL(entry, ROOT), new URL(entry, OUT), { recursive: true });
}

console.log(`staged ${ENTRIES.length} web entries into www/`);
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules/
www/
android/keystore.properties
*.jks
*.keystore
android/.gradle/
android/build/
android/app/build/
android/local.properties
android/app/release/
android/app/src/main/assets/public/
.DS_Store
```

- [ ] **Step 5: Create `package.json`**

```json
{
  "name": "financetracker",
  "version": "1.0.0",
  "private": true,
  "description": "Offline Ukrainian-first daily spending allowance app",
  "type": "module",
  "scripts": {
    "check": "node scripts/check.mjs",
    "serve": "node scripts/serve.mjs",
    "build:web": "node scripts/build-web.mjs",
    "sync:android": "npm run build:web && npx cap sync android"
  },
  "devDependencies": {
    "@capacitor/android": "8.5.0",
    "@capacitor/cli": "8.5.0",
    "@capacitor/core": "8.5.0"
  }
}
```

- [ ] **Step 6: Install and run staging**

```bash
npm install
node scripts/build-web.mjs
```

Expected: `staged 3 web entries into www/`, and `www/` contains `index.html`, `manifest.webmanifest`, `icons/` and nothing else.

- [ ] **Step 7: Verify staging is exact**

```bash
ls www/ && diff -r icons www/icons && diff index.html www/index.html && echo "STAGING EXACT"
```

Expected: `STAGING EXACT` with no diff output.

- [ ] **Step 8: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore scripts/build-web.mjs scripts/android-check.mjs scripts/check.mjs
git commit -m "Stage web assets for native packaging"
```

---

### Task 2: Generate the Capacitor Android project and lock app identity

**Files:**
- Create: `capacitor.config.json`
- Create: `android/` (generated, then edited)
- Modify: `android/app/build.gradle`
- Modify: `android/variables.gradle`
- Modify: `android/app/src/main/res/values/strings.xml`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: `www/` produced by `scripts/build-web.mjs` (Task 1).
- Produces: a committed `android/` Gradle project whose `applicationId` is `io.github.romantrokachevskyi.dozarplaty`. `checkAndroid()` gains identity assertions.

- [ ] **Step 1: Write the failing checks**

Add to `scripts/android-check.mjs`, above the `checkAndroid` export:

```js
const APP_ID = "io.github.romantrokachevskyi.dozarplaty";
const APP_NAME_UK = "До зарплати";

async function checkIdentity(failures) {
  const raw = await readIfPresent("capacitor.config.json");
  if (raw === null) {
    failures.push("capacitor.config.json is missing");
  } else {
    const config = JSON.parse(raw);
    if (config.appId !== APP_ID) failures.push(`capacitor appId must be ${APP_ID}`);
    if (config.webDir !== "www") failures.push("capacitor webDir must be www");
    if (config.server?.androidScheme !== "https") {
      failures.push("androidScheme must be https to keep the localStorage origin stable");
    }
  }

  const gradle = await readIfPresent("android/app/build.gradle");
  if (gradle === null) {
    failures.push("android/app/build.gradle is missing");
  } else {
    if (!gradle.includes(`applicationId "${APP_ID}"`)) {
      failures.push(`gradle applicationId must be ${APP_ID}`);
    }
    if (!/versionName "\d+\.\d+\.\d+"/.test(gradle)) {
      failures.push("gradle versionName must be semantic");
    }
  }

  const variables = await readIfPresent("android/variables.gradle");
  if (variables === null) {
    failures.push("android/variables.gradle is missing");
  } else {
    for (const key of ["compileSdkVersion", "targetSdkVersion"]) {
      if (!new RegExp(`${key}\\s*=\\s*36\\b`).test(variables)) {
        failures.push(`${key} must be 36 for Play submission`);
      }
    }
  }

  const strings = await readIfPresent("android/app/src/main/res/values/strings.xml");
  if (strings === null) {
    failures.push("android strings.xml is missing");
  } else if (!strings.includes(`>${APP_NAME_UK}<`)) {
    failures.push(`android app_name must be ${APP_NAME_UK}`);
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkIdentity(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `capacitor.config.json is missing` and `android/app/build.gradle is missing`.

- [ ] **Step 3: Create the Capacitor config**

Create `capacitor.config.json`:

```json
{
  "appId": "io.github.romantrokachevskyi.dozarplaty",
  "appName": "До зарплати",
  "webDir": "www",
  "server": {
    "androidScheme": "https"
  },
  "android": {
    "backgroundColor": "#eaf2f6"
  }
}
```

- [ ] **Step 4: Generate the Android project**

```bash
npm run build:web && npx cap add android
```

Expected: `android/` is created and `✔ add in ...` is printed. If the CLI reports a JDK version error, install Temurin 21 and set `JAVA_HOME` to it, then re-run — Capacitor 8's AGP may require JDK 21 even though JDK 17 is present.

- [ ] **Step 5: Set SDK levels to 36**

In `android/variables.gradle`, set:

```groovy
ext {
    minSdkVersion = 23
    compileSdkVersion = 36
    targetSdkVersion = 36
    androidxActivityVersion = '1.9.2'
    androidxAppCompatVersion = '1.7.0'
    androidxCoordinatorLayoutVersion = '1.2.0'
    androidxCoreVersion = '1.15.0'
    androidxFragmentVersion = '1.8.4'
    coreSplashScreenVersion = '1.0.1'
    androidxWebkitVersion = '1.12.1'
    junitVersion = '4.13.2'
    androidxJunitVersion = '1.2.1'
    androidxEspressoCoreVersion = '3.6.1'
    cordovaAndroidVersion = '10.1.1'
}
```

Keep whatever dependency versions Capacitor generated if they differ from the ones above; only `minSdkVersion`, `compileSdkVersion`, and `targetSdkVersion` are mandated by this plan.

- [ ] **Step 6: Set the version name and code**

In `android/app/build.gradle`, inside `android { defaultConfig { ... } }`, confirm or set:

```groovy
        applicationId "io.github.romantrokachevskyi.dozarplaty"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0.0"
```

- [ ] **Step 7: Set the Ukrainian app name**

In `android/app/src/main/res/values/strings.xml`, set `app_name` and `title_activity_main` to the Ukrainian name and leave `package_name`/`custom_url_scheme` at the generated application ID:

```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">До зарплати</string>
    <string name="title_activity_main">До зарплати</string>
    <string name="package_name">io.github.romantrokachevskyi.dozarplaty</string>
    <string name="custom_url_scheme">io.github.romantrokachevskyi.dozarplaty</string>
</resources>
```

- [ ] **Step 8: Add the English app name resource**

Create `android/app/src/main/res/values-en/strings.xml`:

```xml
<?xml version='1.0' encoding='utf-8'?>
<resources>
    <string name="app_name">Until Payday</string>
    <string name="title_activity_main">Until Payday</string>
</resources>
```

- [ ] **Step 9: Sync and verify the checks pass**

```bash
npm run sync:android && node scripts/check.mjs
```

Expected: sync succeeds and `FinanceTracker checks passed`.

- [ ] **Step 10: Commit**

```bash
git add capacitor.config.json android scripts/android-check.mjs
git commit -m "Add Capacitor Android project with locked app identity"
```

---

### Task 3: Disable Auto Backup to keep data on device

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`
- Create: `android/app/src/main/res/xml/backup_rules.xml`
- Create: `android/app/src/main/res/xml/data_extraction_rules.xml`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: the `android/` project from Task 2.
- Produces: an app that never transmits `localStorage` off device, which is what makes the Data Safety declaration in Task 9 truthful.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
async function checkPrivacy(failures) {
  const manifest = await readIfPresent("android/app/src/main/AndroidManifest.xml");
  if (manifest === null) {
    failures.push("AndroidManifest.xml is missing");
    return;
  }
  if (!manifest.includes('android:allowBackup="false"')) {
    failures.push("allowBackup must be false to keep financial data on device");
  }
  if (!manifest.includes("android:dataExtractionRules")) {
    failures.push("dataExtractionRules must be declared");
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkPrivacy(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `allowBackup must be false to keep financial data on device`.

- [ ] **Step 3: Create the backup rules**

Create `android/app/src/main/res/xml/backup_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="root" path="." />
</full-backup-content>
```

Create `android/app/src/main/res/xml/data_extraction_rules.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" path="." />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" path="." />
    </device-transfer>
</data-extraction-rules>
```

- [ ] **Step 4: Wire the rules into the manifest**

In `android/app/src/main/AndroidManifest.xml`, on the `<application>` element, set `android:allowBackup="false"` and add both rule attributes:

```xml
    <application
        android:allowBackup="false"
        android:fullBackupContent="@xml/backup_rules"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme">
```

- [ ] **Step 5: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 6: Commit**

```bash
git add android scripts/android-check.mjs
git commit -m "Keep saved plans on device by disabling Auto Backup"
```

---

### Task 4: Generate launcher icons and splash screen

**Files:**
- Create: `assets/icon.svg`
- Create: `assets/splash.svg`
- Create: `assets/splash-dark.svg`
- Modify: `package.json`
- Modify: `scripts/android-check.mjs`
- Modify: `android/app/src/main/res/**` (generated)

**Interfaces:**
- Consumes: `icons/app-icon.svg` as the single source of truth for brand artwork.
- Produces: adaptive launcher icons at every density plus splash resources, generated rather than hand-placed.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
async function checkArtwork(failures) {
  const source = await readIfPresent("icons/app-icon.svg");
  const generated = await readIfPresent("assets/icon.svg");
  if (generated === null) {
    failures.push("assets/icon.svg is missing");
  } else if (source !== null && source !== generated) {
    failures.push("assets/icon.svg must stay identical to icons/app-icon.svg");
  }
  try {
    const mipmaps = await readdir(new URL("android/app/src/main/res/mipmap-anydpi-v26", ROOT));
    if (!mipmaps.includes("ic_launcher.xml")) {
      failures.push("adaptive launcher icon is missing");
    }
  } catch {
    failures.push("adaptive launcher icon directory is missing");
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkArtwork(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `assets/icon.svg is missing`.

- [ ] **Step 3: Copy the brand icon into the generator input directory**

```bash
mkdir -p assets && cp icons/app-icon.svg assets/icon.svg
```

- [ ] **Step 4: Create the splash artwork**

Create `assets/splash.svg` — the launcher mark centred on the app's light background at the 2732x2732 size the generator expects:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732" width="2732" height="2732">
  <rect width="2732" height="2732" fill="#eaf2f6"/>
  <g transform="translate(1110 1110) scale(1)">
    <rect width="512" height="512" rx="112" fill="#102a43"/>
    <circle cx="256" cy="256" r="170" fill="#0f766e"/>
    <path d="M148 189c0-23 18-41 41-41h134c23 0 41 18 41 41v134c0 23-18 41-41 41H189c-23 0-41-18-41-41V189Z" fill="#fff"/>
    <path d="M188 215h136M188 256h86M188 297h106" fill="none" stroke="#0f766e" stroke-linecap="round" stroke-width="22"/>
    <circle cx="325" cy="299" r="31" fill="#102a43"/>
    <path d="M325 280v38m-13-24h18c8 0 12 5 12 11s-5 12-14 12h-16" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="8"/>
  </g>
</svg>
```

Create `assets/splash-dark.svg` with the same content but `fill="#102a43"` on the backing `<rect>`.

- [ ] **Step 5: Generate the Android artwork**

```bash
npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor "#102a43" --iconBackgroundColorDark "#102a43" --splashBackgroundColor "#eaf2f6" --splashBackgroundColorDark "#102a43"
```

Expected: the command reports generated icons and splashes, and `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` now exists.

- [ ] **Step 6: Record the generator in package.json**

Add to the `scripts` block:

```json
    "assets:android": "npx @capacitor/assets generate --android --assetPath assets --iconBackgroundColor \"#102a43\" --iconBackgroundColorDark \"#102a43\" --splashBackgroundColor \"#eaf2f6\" --splashBackgroundColorDark \"#102a43\""
```

- [ ] **Step 7: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 8: Commit**

```bash
git add assets android package.json scripts/android-check.mjs
git commit -m "Generate adaptive launcher icons and splash screens"
```

---

### Task 5: Wire release signing without handling secrets

**Files:**
- Modify: `android/app/build.gradle`
- Create: `android/keystore.properties.example`
- Create: `docs/store/RELEASE.md`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: the `android/` project from Task 2.
- Produces: a release build that signs itself when `android/keystore.properties` exists and assembles unsigned when it does not. The keystore and its password are created by the developer and never enter the repository or agent context.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
async function checkSigning(failures) {
  const gradle = await readIfPresent("android/app/build.gradle");
  if (gradle === null) return;
  if (!gradle.includes("keystore.properties")) {
    failures.push("release signing must read android/keystore.properties");
  }
  if (!gradle.includes("signingConfigs")) {
    failures.push("release signingConfig is missing");
  }
  const example = await readIfPresent("android/keystore.properties.example");
  if (example === null) {
    failures.push("android/keystore.properties.example is missing");
  } else if (/=\s*\S/.test(example.replace(/^#.*$/gm, ""))) {
    failures.push("keystore.properties.example must not contain real values");
  }
  const ignore = await readIfPresent(".gitignore");
  if (ignore !== null && !ignore.includes("android/keystore.properties")) {
    failures.push("android/keystore.properties must be gitignored");
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkSigning(failures);
```

The check asserts the real properties file is *ignored*, never that it is absent — the developer's machine is expected to have an untracked copy.

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `release signing must read android/keystore.properties`.

- [ ] **Step 3: Add the signing configuration**

At the top of `android/app/build.gradle`, above the `android {` block:

```groovy
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
def hasSigningConfig = keystorePropertiesFile.exists()
if (hasSigningConfig) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Inside the `android { }` block, add `signingConfigs` before `buildTypes`:

```groovy
    signingConfigs {
        release {
            if (hasSigningConfig) {
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
```

and in `buildTypes { release { ... } }` add:

```groovy
            if (hasSigningConfig) {
                signingConfig signingConfigs.release
            }
```

- [ ] **Step 4: Create the example properties file**

Create `android/keystore.properties.example`:

```properties
# Copy to android/keystore.properties and fill in locally.
# This file is gitignored. Never commit real values.
# storeFile is an absolute path to your upload keystore, kept OUTSIDE this repo.
storeFile=
storePassword=
keyAlias=
keyPassword=
```

- [ ] **Step 5: Document keystore creation for the developer**

Create `docs/store/RELEASE.md` with a signing section:

```markdown
# Release runbook

## One-time: create the upload keystore

Run this yourself. The agent never sees or stores the password.

    keytool -genkeypair -v \
      -keystore "$HOME/keystores/dozarplaty-upload.jks" \
      -alias upload -keyalg RSA -keysize 4096 -validity 10000

Then copy `android/keystore.properties.example` to
`android/keystore.properties` and fill in the four values, using the absolute
path to the `.jks` file you just created.

Back up the `.jks` file and its password somewhere durable. Losing them means
resetting the upload key through Play support.

Play App Signing is enabled at first upload, so Google holds the app signing
key and this keystore is only your upload key.

## Build the release bundle

    npm run build:android

The bundle is written to
`android/app/build/outputs/bundle/release/app-release.aab`.

## Increment for every upload

Raise `versionCode` by one in `android/app/build.gradle` before each upload to
Play, including replacements for rejected builds. It never decreases.
```

- [ ] **Step 6: Add the build script**

Add to `package.json` `scripts`:

```json
    "build:android": "npm run sync:android && cd android && gradlew.bat bundleRelease"
```

On non-Windows machines the command is `./gradlew bundleRelease`; note this in `docs/store/RELEASE.md`.

- [ ] **Step 7: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 8: Commit**

```bash
git add android/app/build.gradle android/keystore.properties.example docs/store/RELEASE.md package.json scripts/android-check.mjs
git commit -m "Wire release signing from a gitignored properties file"
```

---

### Task 6: Local dev server with seeded demo states

**Files:**
- Create: `scripts/serve.mjs`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: `index.html`, `manifest.webmanifest`, `icons/` served from the repo root.
- Produces: `node scripts/serve.mjs [port]` serving the repo root on `http://localhost:8080` by default. When a request carries `?seed=<name>`, the server injects a `<script>` that writes `financeTrackerStateV1` before the app script runs. Seed names are `setup`, `dashboard`, `checkin`, and `payday`. `index.html` on disk is never modified.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
async function checkServer(failures) {
  const source = await readIfPresent("scripts/serve.mjs");
  if (source === null) {
    failures.push("scripts/serve.mjs is missing");
    return;
  }
  for (const seed of ["setup", "dashboard", "checkin", "payday"]) {
    if (!source.includes(`${seed}:`)) {
      failures.push(`serve.mjs must define the ${seed} seed`);
    }
  }
  const html = await readIfPresent("index.html");
  if (html !== null && html.includes("seed")) {
    failures.push("index.html must not contain seeding hooks");
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkServer(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `scripts/serve.mjs is missing`.

- [ ] **Step 3: Write the server**

Create `scripts/serve.mjs`:

```js
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const ROOT = new URL("../", import.meta.url);
const PORT = Number(process.argv[2] ?? 8080);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function daysFromToday(offset) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

const SEEDS = {
  setup: () => null,
  dashboard: () => ({
    balance: 18000,
    startDate: daysFromToday(-9),
    salaryDate: daysFromToday(12),
    schemaVersion: 2
  }),
  checkin: () => ({
    balance: 18000,
    startDate: daysFromToday(-9),
    salaryDate: daysFromToday(12),
    currentBalance: 11400,
    currentBalanceDate: daysFromToday(-1),
    schemaVersion: 2
  }),
  payday: () => ({
    balance: 18000,
    startDate: daysFromToday(-21),
    salaryDate: daysFromToday(0),
    currentBalance: 900,
    currentBalanceDate: daysFromToday(0),
    schemaVersion: 2
  })
};

function inject(html, seed) {
  const state = SEEDS[seed]();
  const script = `<script>try{localStorage.clear();${
    state ? `localStorage.setItem("financeTrackerStateV1",${JSON.stringify(JSON.stringify(state))});` : ""
  }}catch(e){}</script>`;
  return html.replace("</head>", `${script}</head>`);
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${PORT}`);
  const path = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  try {
    const body = await readFile(new URL(path, ROOT));
    const type = TYPES[extname(path)] ?? "application/octet-stream";
    const seed = url.searchParams.get("seed");
    if (path === "index.html" && seed && Object.hasOwn(SEEDS, seed)) {
      response.writeHead(200, { "content-type": type });
      response.end(inject(body.toString("utf8"), seed));
      return;
    }
    response.writeHead(200, { "content-type": type });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("not found");
  }
}).listen(PORT, () => console.log(`serving on http://localhost:${PORT}`));
```

The injected script runs `localStorage.clear()` only in this dev server, never in the shipped app. `scripts/check.mjs` already asserts `index.html` contains no destructive `localStorage` call, and that assertion still reads the file on disk.

- [ ] **Step 4: Verify each seed renders**

```bash
node scripts/serve.mjs 8080 &
sleep 1
for s in setup dashboard checkin payday; do curl -s "http://localhost:8080/?seed=$s" | grep -c financeTrackerStateV1; done
```

Expected: `setup` prints a count of at least 1 (from the app script), and the other three print a higher count because the seed script adds another occurrence.

- [ ] **Step 5: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 6: Commit**

```bash
git add scripts/serve.mjs scripts/android-check.mjs
git commit -m "Add a local dev server with seeded demo states"
```

---

### Task 7: Build the release bundle and verify on a device

**Files:**
- Modify: `docs/store/RELEASE.md`

**Interfaces:**
- Consumes: everything from Tasks 1-6.
- Produces: `android/app/build/outputs/bundle/release/app-release.aab` and a recorded verification result.

- [ ] **Step 1: Build the debug APK first**

```bash
npm run sync:android && cd android && ./gradlew assembleDebug
```

Expected: `BUILD SUCCESSFUL`. If Gradle reports an unsupported JDK, install Temurin 21, point `JAVA_HOME` at it, and re-run.

- [ ] **Step 2: Install on an emulator or device**

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Expected: `Success`.

- [ ] **Step 3: Verify the storage contract by hand**

Create a plan in the app, force-quit it, relaunch, and confirm the plan is still there. Then check in a balance, force-quit, relaunch, and confirm the check-in survived.

Expected: state persists across both restarts. If it does not, `androidScheme` is wrong — stop and fix Task 2 before continuing.

- [ ] **Step 4: Verify edge-to-edge layout**

On a device running Android 15 or newer, confirm the status bar and navigation bar do not overlap the card content, at both the default width and with display size set to its largest setting.

Expected: no clipped or hidden content. If content is overlapped, the fix belongs in `index.html` and must be specified and reviewed as its own change, per the spec's out-of-scope rule.

- [ ] **Step 5: Verify offline behaviour**

Enable airplane mode and use the full flow: create a plan, check in a balance, switch language, reload.

Expected: no change in behaviour.

- [ ] **Step 6: Build the signed release bundle**

Requires `android/keystore.properties` to exist locally, per `docs/store/RELEASE.md`.

```bash
npm run build:android
```

Expected: `BUILD SUCCESSFUL` and `app-release.aab` present.

- [ ] **Step 7: Confirm the bundle is signed**

```bash
jarsigner -verify -verbose:summary android/app/build/outputs/bundle/release/app-release.aab | tail -5
```

Expected: `jar verified.`

- [ ] **Step 8: Record results in the runbook**

Append a `## Verified` section to `docs/store/RELEASE.md` listing the Android version tested on, and the outcome of Steps 3, 4, and 5. Record anything that could not be tested as still-manual rather than as passing.

- [ ] **Step 9: Commit**

```bash
git add docs/store/RELEASE.md
git commit -m "Record release build verification"
```

---

### Task 8: Publish the privacy policy

**Files:**
- Create: `docs/privacy/index.html`
- Create: `docs/index.html`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a bilingual policy page served by GitHub Pages at `https://romantrokachevskyi.github.io/FinanceTracker/privacy/`, which both stores require.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
async function checkPolicy(failures) {
  const policy = await readIfPresent("docs/privacy/index.html");
  if (policy === null) {
    failures.push("docs/privacy/index.html is missing");
    return;
  }
  for (const marker of ["lang=\"uk\"", "Конфіденційність", "Privacy"]) {
    if (!policy.includes(marker)) {
      failures.push(`privacy policy must include ${marker}`);
    }
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkPolicy(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `docs/privacy/index.html is missing`.

- [ ] **Step 3: Write the policy page**

Create `docs/privacy/index.html` as a single self-contained page with the Ukrainian text first and the English text below it, both stating: the app collects no data; it has no accounts and no analytics; it makes no network requests; all data stays in the device's local browser storage; nothing is shared with any third party; uninstalling the app deletes the data; and questions go to the repository's issue tracker at `https://github.com/romantrokachevskyi/FinanceTracker/issues`. Include a "last updated" date of 2026-08-31. Use `lang="uk"` on the root element and mark the English section with `lang="en"`.

Do not put a personal email address on this page. Play requires a support email, and that is entered directly in the Console by the developer rather than published here.

- [ ] **Step 4: Add a landing page**

Create `docs/index.html` with the app name, a one-line description in both languages, and a link to `privacy/`. This keeps the Pages root from serving a directory listing.

- [ ] **Step 5: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 6: Commit**

```bash
git add docs/privacy docs/index.html scripts/android-check.mjs
git commit -m "Publish a bilingual privacy policy for store listings"
```

- [ ] **Step 7: Note the Pages activation step**

Add to `docs/store/RELEASE.md` a prerequisite line: GitHub Pages must be enabled for this repository with source set to the `main` branch and the `/docs` folder, and the resulting URL confirmed reachable before submitting the listing. This is a Console/settings action for the developer.

---

### Task 9: Write the store listing copy and compliance answers

**Files:**
- Create: `docs/store/listing-uk.md`
- Create: `docs/store/listing-en.md`
- Create: `docs/store/data-safety.md`
- Modify: `scripts/android-check.mjs`

**Interfaces:**
- Consumes: the privacy policy URL from Task 8.
- Produces: reviewable listing text within Play's length limits, plus the answers for the Data Safety and content rating forms.

- [ ] **Step 1: Write the failing check**

Add to `scripts/android-check.mjs`:

```js
const LISTINGS = [
  ["docs/store/listing-uk.md", "До зарплати"],
  ["docs/store/listing-en.md", "Until Payday"]
];

async function checkListing(failures) {
  for (const [path, name] of LISTINGS) {
    const text = await readIfPresent(path);
    if (text === null) {
      failures.push(`${path} is missing`);
      continue;
    }
    if (!text.includes(name)) failures.push(`${path} must use the app name ${name}`);
    const short = text.match(/## Short description\n\n(.+)/);
    if (!short) {
      failures.push(`${path} must contain a short description`);
    } else if (short[1].trim().length > 80) {
      failures.push(`${path} short description exceeds Play's 80 character limit`);
    }
    const full = text.match(/## Full description\n\n([\s\S]+?)(\n## |$)/);
    if (!full) {
      failures.push(`${path} must contain a full description`);
    } else if (full[1].trim().length > 4000) {
      failures.push(`${path} full description exceeds Play's 4000 character limit`);
    }
  }
  if ((await readIfPresent("docs/store/data-safety.md")) === null) {
    failures.push("docs/store/data-safety.md is missing");
  }
}
```

and call it inside `checkAndroid`:

```js
  await checkListing(failures);
```

- [ ] **Step 2: Run the check to verify it fails**

```bash
node scripts/check.mjs
```

Expected: FAIL with `docs/store/listing-uk.md is missing`.

- [ ] **Step 3: Write the Ukrainian listing**

Create `docs/store/listing-uk.md` with exactly these headings, in this order: `# До зарплати`, `## Short description`, `## Full description`, `## Category`, `## Tags`.

The short description must be at most 80 characters and answer the product question directly: how much can be spent per day until payday.

The full description must cover: what the app calculates, the four-step flow (create a plan from balance and payday, see the daily allowance, check in the actual balance without resetting the plan, start a new period on payday), that the app works fully offline, that no account is required, that no data leaves the device, and that the interface is available in Ukrainian and English. Do not claim features the app does not have — there are no notifications, no bank sync, no categories, and no multi-currency support.

Category is `Finance`.

- [ ] **Step 4: Write the English listing**

Create `docs/store/listing-en.md` with the same headings and equivalent content under the name `Until Payday`. It is a translation of the same claims, not a different pitch.

- [ ] **Step 5: Write the compliance answers**

Create `docs/store/data-safety.md` recording the answers to enter in the Console:

- Does your app collect or share any of the required user data types? **No.**
- Is all user data encrypted in transit? **Not applicable — no data is transmitted.**
- Do you provide a way for users to request data deletion? **Uninstalling the app deletes all data. No server-side data exists.**
- Data types collected: **none.**
- Content rating questionnaire: no violence, no sexual content, no profanity, no controlled substances, no gambling, no user-generated content, no data sharing. Expected rating: **Everyone / PEGI 3.**
- Ads: **none.**
- In-app purchases: **none.**
- Target audience: **adults, 18+**, because the app is a personal finance tool. This keeps the app out of the Families programme and its extra requirements.
- Government app: **no.** Financial features declaration: **no**, the app does not provide banking, lending, or investment services; it performs arithmetic on numbers the user types in.

- [ ] **Step 6: Run the check to verify it passes**

```bash
node scripts/check.mjs
```

Expected: `FinanceTracker checks passed`

- [ ] **Step 7: Commit**

```bash
git add docs/store scripts/android-check.mjs
git commit -m "Write bilingual store listing copy and compliance answers"
```

---

### Task 10: Capture screenshots and the feature graphic

**Files:**
- Create: `scripts/store-shots.mjs`
- Create: `docs/store/assets/feature-graphic.svg`
- Create: `docs/store/assets/*.png` (generated, committed)
- Modify: `package.json`

**Interfaces:**
- Consumes: `scripts/serve.mjs` from Task 6 and its four seed names.
- Produces: four 1080x1920 phone screenshots and one 1024x500 feature graphic, all committed under `docs/store/assets/`.

These PNGs are release deliverables, not the temporary screenshots that `AGENTS.md` tells agents not to commit. They are required by the Console and must be reviewable.

- [ ] **Step 1: Write the capture script**

Create `scripts/store-shots.mjs`. It starts nothing itself; it shells out to headless Chrome against an already-running `scripts/serve.mjs`. Using `--window-size=360,640` with `--force-device-scale-factor=3` produces exactly 1080x1920 at a genuine phone layout.

```js
import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const CHROME = process.env.CHROME_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = new URL("../docs/store/assets/", import.meta.url);
const PORT = Number(process.argv[2] ?? 8080);

const SHOTS = [
  ["01-setup", `http://localhost:${PORT}/?seed=setup`, 360, 640, 3],
  ["02-dashboard", `http://localhost:${PORT}/?seed=dashboard`, 360, 640, 3],
  ["03-checkin", `http://localhost:${PORT}/?seed=checkin`, 360, 640, 3],
  ["04-payday", `http://localhost:${PORT}/?seed=payday`, 360, 640, 3],
  ["feature-graphic", new URL("../docs/store/assets/feature-graphic.svg", import.meta.url).href, 1024, 500, 1]
];

await mkdir(OUT, { recursive: true });

for (const [name, url, width, height, scale] of SHOTS) {
  const file = new URL(`${name}.png`, OUT);
  await run(CHROME, [
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--virtual-time-budget=4000",
    `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`,
    `--screenshot=${file.pathname.replace(/^\//, "")}`,
    url
  ]);
  console.log(`captured ${name}.png at ${width * scale}x${height * scale}`);
}
```

- [ ] **Step 2: Author the feature graphic**

Create `docs/store/assets/feature-graphic.svg` at exactly 1024x500: the app's dark background `#102a43`, the launcher mark on the left, and the Ukrainian name `До зарплати` with the tagline beneath it on the right. Use a `system-ui` font stack so it renders identically in headless Chrome. No screenshots inside the graphic, and no claims that are not in the listing copy.

- [ ] **Step 3: Capture**

```bash
node scripts/serve.mjs 8080 &
sleep 1
node scripts/store-shots.mjs 8080
```

Expected: five `captured ...` lines.

- [ ] **Step 4: Verify dimensions**

```bash
node -e "const{readFileSync}=require('fs');for(const f of ['01-setup','02-dashboard','03-checkin','04-payday','feature-graphic']){const b=readFileSync('docs/store/assets/'+f+'.png');console.log(f,b.readUInt32BE(16)+'x'+b.readUInt32BE(20))}"
```

Expected: the four screenshots report `1080x1920` and the feature graphic reports `1024x500`.

- [ ] **Step 5: Review each screenshot by eye**

Open all five PNGs. Confirm each screenshot shows the intended state, that no text is clipped at 360 px, that the Ukrainian copy is correct, and that no seeded number looks implausible.

Expected: all five are presentable. If a state did not render as intended, fix the seed in `scripts/serve.mjs` and recapture.

- [ ] **Step 6: Add the capture script to package.json**

```json
    "shots": "node scripts/store-shots.mjs"
```

- [ ] **Step 7: Commit**

```bash
git add scripts/store-shots.mjs docs/store/assets package.json
git commit -m "Capture store screenshots and feature graphic"
```

---

### Task 11: Record the release harness and Console runbook

**Files:**
- Create: `.agents/android-release.md`
- Modify: `AGENTS.md`
- Modify: `docs/store/RELEASE.md`
- Modify: `.agents/checks.md`

**Interfaces:**
- Consumes: every decision made in Tasks 1-10.
- Produces: durable agent guidance and a developer runbook for the Console steps the agent cannot perform.

- [ ] **Step 1: Write the Android agent guidance**

Create `.agents/android-release.md`, at most 120 lines, covering only durable facts a future agent could otherwise undo: the permanent application ID; that `androidScheme` must stay `https` because changing it destroys user data; that `allowBackup` stays `false` for the privacy boundary and to keep the Data Safety answer truthful; that `versionCode` only ever increases; that `index.html` is never modified for packaging or store purposes and `scripts/serve.mjs` is where demo seeding lives; that the keystore and its password are the developer's and never enter the repo; and the build commands.

- [ ] **Step 2: Link it from the routing section**

In `AGENTS.md`, under "Start here", add one line after the existing `.agents/workflow.md` item:

```markdown
5. Read `.agents/android-release.md` before changing packaging, signing, app
   identity, or store artifacts.
```

- [ ] **Step 3: Note the new checks**

In `.agents/checks.md`, add a short paragraph stating that `scripts/android-check.mjs` guards the packaging contracts and is run from `scripts/check.mjs`, and that new packaging contracts belong there rather than in `scripts/check.mjs`.

- [ ] **Step 4: Verify the line budgets**

```bash
wc -l AGENTS.md .agents/*.md
```

Expected: every file is at or under 120 lines.

- [ ] **Step 5: Write the Console runbook**

Extend `docs/store/RELEASE.md` with the ordered Console steps the developer performs: create the app in Play Console with the Ukrainian default listing; enable Play App Signing at first upload; complete the app content declarations using `docs/store/data-safety.md`; paste the listing copy from `docs/store/listing-uk.md` and `docs/store/listing-en.md`; upload the assets from `docs/store/assets/`; set the privacy policy URL from Task 8; upload the AAB to the **closed testing** track; recruit 12 testers and keep the test running 14 continuous days; then apply for production access.

State plainly that if this account has already published an app to production, the closed testing requirement does not apply and the same bundle goes straight to production.

- [ ] **Step 6: Run the full check suite**

```bash
node scripts/check.mjs && git diff --check
```

Expected: `FinanceTracker checks passed` and no whitespace errors.

- [ ] **Step 7: Commit**

```bash
git add AGENTS.md .agents docs/store/RELEASE.md
git commit -m "Document the Android release contract and Console runbook"
```

---

## Self-review notes

Spec coverage checked section by section: packaging decision (Task 2), asset staging (Task 1), app identity (Task 2), SDK levels (Task 2), storage contract (Tasks 2 and 7), Auto Backup (Task 3), signing and credential boundary (Task 5), privacy policy (Task 8), listing copy (Task 9), screenshots and feature graphic (Task 10), Data Safety and content rating (Task 9), release path (Task 11), verification (Tasks 1-11 checks plus Task 7 manual pass), harness updates (Task 11).

`checkAndroid()` keeps one signature across all tasks and each task only appends a new `checkX(failures)` helper and one call line. The `readIfPresent`, `ROOT`, and `WEB_ASSETS` names defined in Task 1 are the only shared identifiers later tasks depend on.

Icon generation uses `@capacitor/assets` via `npx` rather than a committed dependency, so it does not appear in `package.json` `devDependencies`.
