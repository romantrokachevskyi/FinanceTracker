# Android Play Store distribution — design

Date: 2026-08-31
Status: approved
Scope: Android / Google Play only. iOS is a separate spec that reuses the
packaging decision recorded here.

## Goal

Ship FinanceTracker to Google Play as a signed Android App Bundle, with a
complete store listing kit, without weakening the offline and privacy
guarantees in `AGENTS.md`.

Success means: a reproducible `app-release.aab` that Play accepts, plus every
listing artifact the Console asks for, prepared and reviewed before upload.

## Decision: Capacitor wrapper

The app is packaged with Capacitor 8.5.0. Web assets are bundled into the APK
and served by a native scheme handler. No hosting, no service worker, no
network dependency.

Alternatives rejected:

- **Trusted Web Activity (Bubblewrap/PWABuilder).** Smallest artifact and free
  auto-updates, but Android-only. Apple has no equivalent, so iOS would need a
  second packaging system. It also requires hosting the app publicly and
  writing a service worker, converting an app that makes zero network calls
  into one that needs the network for first load. That contradicts a
  non-negotiable in `AGENTS.md`.
- **Hand-written Kotlin WebView shell.** Best fit for this repo's
  "prefer the platform" ethos and viable on Android alone. Rejected because the
  iOS port would hand-write a second Swift shell and hit the `file://` storage
  problem below — reimplementing the one thing Capacitor exists to solve.

### Why the wrapper is load-bearing, not cosmetic

The entire app state is `financeTrackerStateV1` in `localStorage`. A bare
`file://` WebView has no stable origin. On iOS WKWebView, `localStorage` under
`file://` is unreliable and subject to eviction. Capacitor serves the app from
`https://localhost` via a native scheme handler, giving `localStorage` a real,
persistent origin on both platforms.

## Architecture

```
index.html, manifest.webmanifest, icons/   source of truth, unchanged, no build step
        |
        |  scripts/build-web.mjs  (copy only; no bundling, no transform)
        v
www/                                        staged web root (gitignored)
        |
        |  npx cap sync android
        v
android/app/src/main/assets/public/         bundled into the AAB
```

The staging step belongs to distribution, not to the app. `index.html` remains
directly openable and editable with no toolchain, so the "no build step"
agreement in `AGENTS.md` still holds for app development.

`scripts/build-web.mjs` copies a fixed allowlist of paths. It must never copy
the repo wholesale, or `node_modules`, `docs/`, and `.agents/` would ship
inside the app.

## App identity

These values are permanent once published and must never change:

| Field | Value |
| --- | --- |
| Application ID | `io.github.romantrokachevskyi.dozarplaty` |
| App name (uk) | До зарплати |
| App name (en) | Until Payday |
| Initial versionName | `1.0.0` |
| Initial versionCode | `1` |

`versionCode` increments by one on every upload to Play, including rejected
and replaced builds. It never decreases.

## SDK levels

`compileSdk` and `targetSdk` are **36** (Android 16). As of 2026-08-31 Google
Play requires API 36 for new app submissions, so 35 would be rejected.
`minSdk` stays at the Capacitor 8 default. The android-36 platform is already
installed locally.

## Storage contract (critical)

The Android origin is `https://localhost`, set by `androidScheme: "https"` in
`capacitor.config.json`. This is the Capacitor default and **must never be
changed after the first public release** — changing the scheme or hostname
changes the `localStorage` origin and silently destroys every user's saved
plan. This is a new non-negotiable, recorded in `.agents/android-release.md`.

Android Auto Backup is **disabled** (`android:allowBackup="false"` plus
matching data-extraction rules). Auto Backup would copy `localStorage` to the
user's Google Drive. That is convenient on a phone swap but would make the app
transmit user financial data off-device, contradicting the privacy boundary in
`AGENTS.md` and making an honest Data Safety declaration impossible. Users keep
their data by keeping the app installed; this trade is deliberate.

## Signing and the credential boundary

Play App Signing is enabled: Google holds the app signing key, the developer
holds only an upload key.

The upload keystore is created **by the developer, not by the agent**. The
agent produces a documented `keytool` command and the Gradle wiring, and never
sees, generates, stores, or transmits the keystore password.

- `android/keystore.properties` holds the local signing values and is
  gitignored. It is never read into agent context.
- `android/app/build.gradle` reads that file if present and configures the
  release signing config from it.
- If the file is absent, the release build still assembles unsigned rather than
  failing, so CI and review builds work without secrets.

The keystore file and its password are the only artifacts whose loss is
unrecoverable. Losing them means resetting the upload key through Play support.

## Store listing kit

- **Privacy policy.** `docs/privacy/index.html`, bilingual uk/en, published via
  GitHub Pages from the `docs/` folder of the existing public repo, at
  `https://romantrokachevskyi.github.io/FinanceTracker/privacy/`. Both stores
  require a reachable policy URL. Enabling Pages on `docs/` also exposes these
  spec files; the repo is already public, so this is acceptable.
- **Listing copy**, uk and en: app name, short description (80 char limit),
  full description (4000 char limit).
- **Screenshots.** At least four phone screenshots at 1080x1920, captured from
  the real running app in Ukrainian: initial setup, dashboard with allowance,
  balance check-in expanded, payday rollover.
- **Feature graphic**, 1024x500, required by the Console.
- **App icon**, 512x512 — already present as `icons/app-icon-512.png`.
- **Data Safety answers**: no data collected, no data shared, no account, data
  stays on device. Auto Backup being disabled is what makes this answer true.
- **Content rating**: IARC questionnaire, no objectionable content, Finance
  category.

Copy and answers are prepared as reviewable files in the repo. The developer
does the Console data entry.

## Release path

The Play account is an individual/personal account. Unless it has already
published an app to production, Google requires a closed test with 12 opted-in
testers running 14 continuous days before production access can be requested.
The plan therefore targets the **closed testing track first**, with production
as a follow-on step gated on that requirement.

If the account has already shipped to production, the closed-testing step is
skipped and the same AAB goes straight to production.

## Verification

- `node scripts/check.mjs` keeps passing unchanged. The existing checks are the
  regression guard for the web app; packaging must not alter `index.html`.
- New check: the staged `www/` output matches the source files byte for byte,
  and contains no extra paths.
- New check: the application ID and `versionName` in the Gradle config match
  the values recorded above.
- Manual: install the release build on a device or emulator; confirm the app
  renders at 320 px and 375-390 px, that the status and navigation bars do not
  overlap content under edge-to-edge, that a saved plan survives force-quit and
  relaunch, and that it survives an in-place update to a higher versionCode.
- Manual: confirm airplane mode changes nothing.

## Harness updates

Android guidance goes in a new `.agents/android-release.md`, linked from the
routing section of `AGENTS.md`. It is not inlined, because `scripts/check.mjs`
enforces a 120-line budget on each instruction file and the guidance is
specialized rather than always-needed.

## Out of scope

- iOS packaging, signing, and App Store listing. Separate spec.
- Any change to app features, layout, calculations, or copy. If a packaging
  defect requires a UI fix, it is specified and reviewed on its own.
- Automated CI builds. Local reproducible builds first; CI only if it earns its
  place later.

## Known risks

- **Apple guideline 4.2.** A single-screen budget calculator in a WebView is a
  plausible "minimum functionality" rejection on iOS. It does not affect
  Android, but it may reshape the iOS spec. Flagged now, resolved later.
- **Edge-to-edge on Android 15+.** The app already sets `viewport-fit=cover`
  and uses `env(safe-area-inset-*)`, so this is expected to work, but it is
  unverified on a real device until the manual pass runs.
- **Closed testing timeline.** If the 12-tester requirement applies, production
  is at least 14 days out regardless of how fast the build is ready.
