# Android release facts

Read before changing packaging, signing, app identity, or store artifacts.
The code remains authoritative when these notes disagree with it.

## Packaging

- Capacitor 8 wraps the existing static site. `index.html` stays a no-build
  file; the wrapper never edits it.
- `scripts/build-web.mjs` copies an allowlist (`index.html`,
  `manifest.webmanifest`, `icons/`) into the gitignored `www/`. Never widen it
  to copy the repository, or `node_modules` and `docs/` ship inside the app.
- `npx cap sync android` copies `www/` into `android/app/src/main/assets/public`.
  That directory is generated and gitignored.

## Values that can never change

Changing any of these breaks installed users or is rejected by Play.

- Application ID `io.github.romantrokachevskyi.dozarplaty`. Permanent once
  published, and the basis for the future iOS bundle ID.
- `androidScheme: "https"` in `capacitor.config.json`. It produces the
  `https://localhost` origin that owns `financeTrackerStateV1`. Changing the
  scheme or host silently destroys every user's saved plan.
- `versionCode` only ever increases, by one per upload to Play, including
  replacements for rejected builds.

## Privacy posture

The app embeds the Google Mobile Ads SDK, so it is no longer permissionless.
Full detail in `.agents/ads.md`; the store declarations it makes true live in
`docs/store/data-safety.md`.

- `android:allowBackup="false"` plus `backup_rules.xml` and
  `data_extraction_rules.xml`. Auto Backup would copy the user's financial data
  to Google Drive. This one is still absolute.
- `INTERNET` is granted, because the ad SDK cannot load a banner without it.
  The SDK merges in eight further permissions; `data-safety.md` lists all nine.
  None is a runtime permission, so the user is never prompted.
- The app's own code still makes no network calls, and `scripts/check.mjs`
  fails if `fetch`, `XMLHttpRequest` or `WebSocket` appears in `index.html`.
  That check is what keeps the privacy policy honest — treat it as load-bearing.

Verify the real permission set after any dependency change:

```sh
cd android && ./gradlew.bat assembleDebug
grep -o 'uses-permission[^/]*' app/build/intermediates/merged_manifest/debug/*/AndroidManifest.xml | sort -u
```

## Demo state

Store screenshots need populated states, defined once in
`scripts/store-seeds.mjs`. `scripts/serve.mjs` injects them into the HTTP
response for browser work; `scripts/capture-store.mjs` writes them into the
debug build's WebView over its DevTools socket and captures each state on a
device in English and Ukrainian. Neither path touches `index.html`, and
`scripts/check.mjs` fails if seeding code appears there.
`scripts/store-shots.mjs` crops the raw captures and renders both feature
graphics. Procedure: `docs/store/RELEASE.md`.

## Store artifacts

All in `docs/store/`: `RELEASE.md` (ordered runbook, account steps included),
`verification.md` (what ran on which build), `listing-uk.md`/`listing-en.md`,
`data-safety.md` (every Console declaration), `release-notes.md`,
`app-ads.txt` (published by hand at the developer-site root), and `assets/`.
The privacy policy is `docs/privacy/index.html`, live at
`https://romantrokachevskyi.github.io/FinanceTracker/docs/privacy/` because
Pages serves the repository root.

## Signing

The upload keystore and its password belong to the developer and never enter
this repository or an agent's context. `android/app/build.gradle` reads
`android/keystore.properties` when present and assembles unsigned when absent,
so builds work without secrets. Play App Signing holds the real signing key.

## Commands

```sh
node scripts/check.mjs        # includes every packaging contract above
npm run serve                 # local dev server, supports ?seed=
npm run sync:android          # stage web assets and sync into android/
npm run build:android         # release bundle at
                              # android/app/build/outputs/bundle/release/
npm run assets:android        # regenerate launcher icons and splashes
npm run capture:store         # raw device captures, both languages (debug build)
npm run shots                 # crop them and render the feature graphics
```

## Toolchain observed working

Node 22, JDK 17 Temurin, Android SDK platform 36, Capacitor 8.5.0. Play
requires `targetSdk` 36 for new submissions as of 2026-08-31; Capacitor 8
already defaults to it.
