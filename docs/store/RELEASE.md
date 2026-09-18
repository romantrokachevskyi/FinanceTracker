# Release runbook

The ordered path from nothing to a published app. Steps marked **you** need
your accounts or secrets; everything else is a repository command. What has
been verified, and on what, lives in `verification.md`.

Fixed values used below:

| What | Value |
| --- | --- |
| Package name | `io.github.romantrokachevskyi.dozarplaty` (permanent) |
| App name | Until Payday (default, English) · До зарплати (Ukrainian) |
| Privacy policy URL | `https://romantrokachevskyi.github.io/FinanceTracker/docs/privacy/` |
| Developer website | `https://romantrokachevskyi.github.io` |
| AdMob publisher | `pub-7574415603200995` |

GitHub Pages serves this repository from the `main` branch root, which is what
keeps the web app live, so the policy sits under `/docs/`. Do not switch Pages
to the `/docs` folder: the web app would disappear.

## 1. Publish the web side (you)

1. Push `main`. The live policy is whatever `main` holds, and Play reviewers
   compare it with the Data safety answers. Confirm the policy URL shows the
   AdMob section.
2. `app-ads.txt` is served from the separate repository
   `romantrokachevskyi/romantrokachevskyi.github.io`, at
   `https://romantrokachevskyi.github.io/app-ads.txt`; its `index.html`
   forwards the root to `/FinanceTracker/`. AdMob only crawls the domain root,
   never `/FinanceTracker/`, and limits serving until the file verifies. If the
   publisher ever changes, update `docs/store/app-ads.txt` here and copy it
   there — the checker only guards this repository's copy.

## 2. Configure AdMob (you)

In AdMob → **Privacy & messaging**:

1. Create a **European regulations (GDPR)** message for this app, choose
   Google-certified CMP defaults, and **publish** it. Without a published
   message the consent form never appears and EEA/UK users get no ads.
2. Nothing to build for the privacy options entry point: the app already shows
   an "Налаштування реклами" button whenever UMP asks for it.

## 3. Create the upload keystore (you, once)

No agent creates, reads, or stores this password.

```bash
keytool -genkeypair -v -keystore "$HOME/keystores/dozarplaty-upload.jks" -alias upload -keyalg RSA -keysize 4096 -validity 10000
```

Keep the `.jks` **outside this repository** and back it up with its password.
Copy `android/keystore.properties.example` to `android/keystore.properties` and
fill in the four values, with the absolute path to the keystore. Play App
Signing holds the real signing key; this is only your upload key.

## 4. Build and verify the bundle

```bash
npm run build:android
```

```bash
jarsigner -verify -verbose:summary android/app/build/outputs/bundle/release/app-release.aab
```

`jar verified.` means signed. `jar is unsigned.` means `keystore.properties`
was not found — Play rejects that bundle. The first upload uses `versionCode 1`;
raise it by one for every later upload, including replacements for rejected
builds. `versionName` changes only for real releases.

## 5. Create the app in Play Console (you)

1. **Create app**: name **Until Payday**, package name as in the table,
   default language **English (United States) – en-US**, **App**, **Free**.
   Accept the declarations. English is the default because Play shows it to
   every language without its own translation; the app itself opens in the
   device language.
2. **Store settings**: category **Finance**; contact email of your choice
   (shown publicly); website `https://romantrokachevskyi.github.io` — this is
   what points AdMob at `app-ads.txt`.
3. **Main store listing** — each language gets its own text and graphics:

   | Listing | Text | Feature graphic | Phone screenshots, in order |
   | --- | --- | --- | --- |
   | English (en-US), default | `listing-en.md` | `assets/en/feature-graphic.png` | `assets/en/01-setup` … `04-payday` |
   | Ukrainian (uk) translation | `listing-uk.md` | `assets/uk/feature-graphic.png` | `assets/uk/01-setup` … `04-payday` |

   The app icon, `icons/app-icon-512.png`, is shared. Add the Ukrainian
   translation first, then open it and replace the graphics it inherited
   from English.
4. **App content**: privacy policy URL from the table above, then every
   declaration in `data-safety.md` — Ads, App access (all functionality
   available without login), Target audience, Data safety, Financial features,
   Advertising ID, Government apps, Health.
5. **Content rating**: the IARC questionnaire, answers in `data-safety.md`.
6. **Countries**: the app is ready for all countries. Include EEA, UK and
   Swiss countries only after step 2 is done and the EEA consent run listed as
   open in `verification.md` has passed; until then select every other
   country and add those later — no new upload is needed.

## 6. Test track and production (you)

1. **Testing → Closed testing**: create a release, upload `app-release.aab`,
   paste the notes from `release-notes.md`, add at least 12 testers by email
   list, and share the opt-in link.
2. For a personal developer account created after 13 November 2023, each new
   app must keep that test running with 12+ opted-in testers for 14 continuous
   days before **Apply for production** unlocks on the app's dashboard. An
   earlier published app does not waive it. Organisation accounts, and personal
   accounts created before that date, may release to production directly.
3. After production access: **Production → Create release**, promote the same
   bundle, submit for review.

## 7. After it is live (you)

1. AdMob → Apps → this app → **Add app store details**, and link it to the
   Play listing. AdMob then reviews the app; until it passes, fill rates stay
   low. "Ad failed to load: 3" (no fill) in logcat is expected before that.
2. Install from Play on a real phone and confirm the banner appears after the
   tenth day. Do not tap your own ads — AdMob suspends accounts for it.

## Regenerating store artwork

Screenshots are real captures of the debug build on an Android 13+ emulator or
phone. With the debug APK installed and the device connected:

```bash
npm run capture:store
```

```bash
npm run shots
```

The first writes raw captures of every seed in `scripts/store-seeds.mjs`, in
English and Ukrainian, to the gitignored `assets/raw/`; it clears the app's
data on that device. The second crops them to 1080 × 1920 and renders each
language's `feature-graphic.svg`. Edit a feature graphic's text in its SVG,
never in the PNG.

## Testing the banner without waiting ten days

Edit the staged copy, never `index.html`: run `node scripts/build-web.mjs`, set
`AD_AFTER_VISITS=1` and Google's test unit
`ca-app-pub-3940256099942544/9214589741` in `www/index.html`, then
`npx cap copy android` and `cd android && ./gradlew.bat assembleDebug`.
Run `npm run sync:android` afterwards so the real values are staged again.
