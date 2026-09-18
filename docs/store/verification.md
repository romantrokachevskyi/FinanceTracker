# Release verification

What has been checked on real builds, on what, and what is still open. The
runbook is `RELEASE.md`.

Toolchain throughout: JDK 17 Temurin, Node 22, Capacitor 8.5.0, Pixel 9a
emulator on **Android 16 (API 36)**. Nothing here has run on physical hardware.

## Packaging and persistence (2026-08-31, debug build)

- `compileSdk`/`targetSdk` 36 come from Capacitor 8 defaults.
- `allowBackup="false"` and both extraction rules survive manifest merging.
- A plan survives force-stop and relaunch, and an in-place update from
  `versionCode` 1 to 2 — the `androidScheme: https` origin contract.
- Airplane mode changes nothing for the plan, the calculations or persistence.
- Edge-to-edge is correct: no bar overlaps content.
- The keyboard pushes the layout without hiding the submit button.

On a tall phone the card sits vertically centred with a gap above it, and below
480 px the page background matches the card. Both come from existing media
queries and render the same in a desktop browser.

## Ad banner (2026-09-18)

- `npm run build:android` → BUILD SUCCESSFUL, 7.0 MB `app-release.aab`,
  unsigned because no keystore exists yet.
- The merged manifest has nine permissions, none of them runtime:
  `INTERNET` from the app, the rest from the Mobile Ads SDK and Play services.
  `data-safety.md` lists and justifies each. Reproduce with
  `grep -o 'uses-permission[^/]*' android/app/build/intermediates/merged_manifest/debug/*/AndroidManifest.xml | sort -u`.
- **Live unit** on the emulator, threshold staged down to 1: `initialize` →
  consent `NOT_REQUIRED` (Ukrainian locale, `gdprApplies` 0) → `showBanner`
  with `isTesting:false`; the SDK logs "sent from a test device" and returns
  error 3, no fill — expected for an app not yet on Play. `--ad-height` stays
  0, so no empty gap appears.
- **Google test unit**, same build otherwise: the adaptive banner renders at
  411 × 64 dp at the bottom, above the navigation bar, and the page moves up by
  its height. On the dashboard the last control, "Почати новий план", clears it.
- Keyboard: before the fix, focusing the balance field re-anchored the banner
  mid-screen, directly over the field. Now the banner hides while a text field
  has focus and returns to the bottom when focus leaves — checked on the
  emulator and by `scripts/behavior-check.mjs`. Logcat shows the size events
  that drive `--ad-height`: `{"width":0,"height":0}` after `hideBanner`,
  `{"width":411,"height":64}` after `resumeBanner`.
- "Налаштування реклами" renders at 320 px as a 48 px quiet button with no
  horizontal overflow (browser, forced visible).

## Signed release bundle (2026-09-18)

`npm run build:android` with the upload keystore in place → 7.1 MB
`app-release.aab`. `jarsigner -verify` reports `jar verified.`, signed by the
`upload` alias: RSA 4096, SHA256withRSA, valid until 2054. The bundle carries
the live ad unit and `AD_AFTER_VISITS=10`.

## Still open

- Physical hardware, any model.
- The UMP consent form and the privacy options button on a device. Both need
  the GDPR message published in AdMob, then an EEA test run
  (`debugGeography` or an EEA device).
- Live-unit fill. It starts after the Play listing is linked in AdMob and
  `app-ads.txt` verifies.
- Reduced-motion, contrast and screen-reader passes with the banner present.
