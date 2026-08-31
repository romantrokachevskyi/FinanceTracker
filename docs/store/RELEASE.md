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

Filled in by `docs/superpowers/plans/2026-08-31-android-play-distribution.md`
Task 7. Do not mark anything here as passing that was not actually run.
