# Release runbook

Steps only you can do are marked **you**. Everything else is automated by the
repository scripts.

## One-time: create the upload keystore (you)

Run this yourself. No agent creates, reads, or stores this password.

```bash
keytool -genkeypair -v -keystore "$HOME/keystores/dozarplaty-upload.jks" -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

Keep the `.jks` file **outside this repository**. Then copy
`android/keystore.properties.example` to `android/keystore.properties` and fill
in the four values, using the absolute path to the keystore you just created.

Back up the `.jks` file and its password somewhere durable. Losing them means
resetting the upload key through Play support.

Play App Signing is enabled at first upload, so Google holds the real app
signing key and this keystore is only your upload key.

## One-time: enable GitHub Pages (you)

In the repository settings, set Pages to build from the `main` branch,
`/docs` folder. Confirm that
`https://romantrokachevskyi.github.io/FinanceTracker/privacy/` loads before
submitting the listing — Play rejects an unreachable privacy policy URL.

## Build the release bundle

```bash
npm run build:android
```

The bundle is written to
`android/app/build/outputs/bundle/release/app-release.aab`.

On macOS or Linux the Gradle command inside that script is `./gradlew
bundleRelease` rather than `gradlew.bat bundleRelease`.

If `android/keystore.properties` is absent the build still succeeds but
produces an unsigned bundle, which Play will reject. Verify signing with:

```bash
jarsigner -verify -verbose:summary android/app/build/outputs/bundle/release/app-release.aab
```

## Regenerating store artwork

The four screenshots in `assets/` are real captures from the app running on a
device, not browser renders. To redo them, install the debug build on a device
or emulator and capture each state:

```bash
adb exec-out screencap -p > raw/01-setup.png
```

Capture `01-setup` on a fresh install, `02-dashboard` after creating a plan,
`03-checkin` after tapping "Оновити баланс" (dismiss the keyboard and scroll to
the top first), and `04-english` after tapping the EN toggle. Then crop them to
the ratio the Console accepts:

```bash
node scripts/store-shots.mjs <path-to-raw-directory>
```

Raw captures are not committed; only the cropped results are. The same command
re-renders `feature-graphic.png` from `feature-graphic.svg`.

## Increment for every upload

Raise `versionCode` by one in `android/app/build.gradle` before each upload to
Play, including replacements for rejected builds. It never decreases.
`versionName` is the human-facing string and changes only for real releases.

## Play Console submission (you)

1. Create the app. Default language **Ukrainian**, app name **До зарплати**,
   type **App**, **Free**.
2. Store listing: paste from `listing-uk.md`, then add the English translation
   from `listing-en.md`.
3. Upload the graphics from `assets/`: four phone screenshots, the feature
   graphic, and `icons/app-icon-512.png` as the app icon.
4. Privacy policy URL: the GitHub Pages URL above.
5. App content: answer every declaration from `data-safety.md`.
6. Content rating: complete the IARC questionnaire using the same file.
7. Upload `app-release.aab` to the **closed testing** track and opt in 12
   testers. The test must run 14 continuous days before you can apply for
   production access.
8. Apply for production access, then promote the same bundle.

If this account has already published an app to production, step 7's testing
requirement does not apply and the bundle goes straight to production.

## Verified

Run on 2026-08-31 against a Pixel 9a emulator, **Android 16 (API 36)**, debug
build, JDK 17 Temurin.

Passed:

- Debug build succeeds on JDK 17. Capacitor 8.5.0 defaults already gave
  `compileSdk`/`targetSdk` 36, so no override was needed.
- Merged manifest requests **zero device permissions**. `INTERNET` is gone; the
  only entry left is AndroidX's self-scoped
  `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, which grants nothing outside the
  app. `allowBackup="false"` and both extraction rules survive manifest merging.
- A plan created in the app survives **force-stop and relaunch**. This is the
  `androidScheme: https` origin contract working.
- The plan also survives an **in-place update** from `versionCode` 1 to 2.
- Airplane mode changes nothing, as expected for an app with no network
  permission.
- Edge-to-edge is correct on Android 16: neither the status bar nor the
  navigation bar overlaps content.
- The on-screen keyboard pushes the layout without hiding the submit button.

Not a defect, observed while testing: on a tall phone the card sits vertically
centred with a large gap above it, and below 480 px the page background matches
the card. Both come from existing media queries in `index.html` and render
identically in a desktop browser at the same viewport. Packaging did not change
them.

Still manual, not yet run:

- Any test on physical hardware. Everything above is emulator-only.
- A signed **release** build and `jarsigner` verification. That needs the upload
  keystore, which only you can create.
- The 320 px width pass and the reduced-motion, contrast, and screen-reader
  checks that `.agents/workflow.md` requires for UI changes. No UI was changed,
  so these were not re-run.
