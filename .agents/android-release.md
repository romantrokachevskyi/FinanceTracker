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

Two settings make the store declarations in `docs/store/data-safety.md` true.
Do not relax either without changing those answers first.

- `android:allowBackup="false"` plus `backup_rules.xml` and
  `data_extraction_rules.xml`. Auto Backup would copy the user's financial data
  to Google Drive.
- The `INTERNET` permission is removed with `tools:node="remove"`, so the
  merged manifest requests no device permissions at all and the OS enforces the
  offline promise. Re-adding it would make the app capable of network calls
  even though it makes none.

## Demo state

Store screenshots need populated states. Seeding lives in `scripts/serve.mjs`,
which injects a script into the HTTP response. It never goes into `index.html`;
`scripts/check.mjs` fails if it does.

Screenshots themselves are captured from the app on a device with
`adb exec-out screencap -p`, then cropped by `scripts/store-shots.mjs`. See
`docs/store/RELEASE.md`.

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
npm run shots                 # rebuild store artwork from raw device captures
```

## Toolchain observed working

Node 22, JDK 17 Temurin, Android SDK platform 36, Capacitor 8.5.0. Play
requires `targetSdk` 36 for new submissions as of 2026-08-31; Capacitor 8
already defaults to it.
