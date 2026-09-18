# Ads

Read before changing the banner, the visit counter, or anything about the
privacy posture. Design rationale: `docs/superpowers/specs/2026-09-18-ad-banner-design.md`.

## What ships

One Google AdMob banner, anchored bottom-centre, adaptive size. It appears only
after the user has opened the app on `AD_AFTER_VISITS` (10) separate calendar
days. On web and in the PWA there are no ads at all — the banner is native-only.

While a text field has focus the banner is hidden (`hideBanner`) and it comes
back when focus leaves the fields (`resumeBanner`). With the keyboard up the SDK
re-anchors the banner above it, which on a Pixel 9a emulator (Android 16) put the ad over the field
being typed in — an accidental-click placement AdMob penalises. A focused text
field stands in for the keyboard; a date input does not count, since it opens
a picker. A field already focused when the banner arrives hides it at once.
`hideBanner` reports height 0 and `resumeBanner` the real size, so
`--ad-height` follows both ways without extra code.

Plugin: `@capacitor-community/admob@8.1.0`, reached through
`window.Capacitor.Plugins.AdMob`. Do not add a bundler to import it; the global
bridge is what keeps `index.html` a no-build file.

## The visit counter

Key `financeTrackerAdsV1`, deliberately separate from `financeTrackerStateV1`
so the state contract is untouched. Shape:

```json
{"visits": 3, "lastVisitDate": "2026-09-18"}
```

Counted once per calendar day, at startup, whether or not a plan exists. Ten
opens in one afternoon count as one. `readAdState()` never throws and returns
`{visits:0,lastVisitDate:null}` for anything it cannot trust; a write failure is
swallowed. An ad-counter failure must never be visible to the user.

`countVisit` and `shouldShowAds` are pure. Test them through
`scripts/behavior-check.mjs`, which seeds the counter with the `ads` option and
fakes the bridge with the `capacitor` option.

## Privacy posture, as it now stands

The app requests `INTERNET`. Eight more permissions arrive from the Ads SDK;
`docs/store/data-safety.md` lists all nine and why. Verify the real set after
any dependency change:

```sh
cd android && ./gradlew.bat assembleDebug
grep -o 'uses-permission[^/]*' app/build/intermediates/merged_manifest/debug/*/AndroidManifest.xml | sort -u
```

What must stay true, and what `scripts/android-check.mjs` enforces:

- `android:allowBackup="false"` and the extraction rules stay. Auto Backup must
  never copy the plan to Google Drive.
- `index.html` contains no `fetch`, `XMLHttpRequest` or `WebSocket`. The SDK is
  native; the app's own code stays networkless. This is what makes "your numbers
  never leave the device" true, and it is load-bearing for the store listing and
  the privacy policy.
- The AdMob `APPLICATION_ID` meta-data and the `admob_app_id` string exist.

Balance, payday and check-in dates are never passed to the SDK. Any change that
would send them anywhere needs the store declarations rewritten first.

## Consent

`startAds()` calls UMP (`requestConsentInfo`, then `showConsentForm` when
required) before the first ad request. It then shows a banner only when the
status is `OBTAINED` or `NOT_REQUIRED`. Gate on the status, not on
`canRequestAds` alone: an error path that omits that field would otherwise read
as consent given, and the privacy policy promises the opposite.

When UMP reports `privacyOptionsRequirementStatus: "REQUIRED"` (EEA, UK,
Switzerland) the hidden `#adPrivacy` button ("Налаштування реклами" / "Ad
settings") is shown and opens `showPrivacyOptionsForm()`. Google requires that
entry point, and the privacy policy names it. It is shown whether or not the
user allowed ads.

The GDPR message itself is configured in the AdMob console, not in this repo —
an unconfigured message means the form never appears, consent is never
gathered, and UMP never asks for the privacy options button.

`showBanner` passes no `npa` flag on purpose. The Mobile Ads SDK reads UMP's
consent signal itself, which is Google's own guidance. Setting `npa` from the
status was a bug: Ukraine is outside the EEA, so UMP returns `NOT_REQUIRED`
there, and every Ukrainian user — the primary audience — would have been served
non-personalised ads at a lower rate.

## Ad unit IDs

Two IDs, in two files, from one AdMob account:

- `AD_BANNER_ID` in `index.html` — the banner **ad unit** (`ca-app-pub-…/…`)
- `admob_app_id` in `android/app/src/main/res/values/strings.xml` — the
  **app** ID (`ca-app-pub-…~…`)

Both currently hold the project's live IDs. `isTesting` is derived from the
Google test publisher prefix `ca-app-pub-3940256099942544`, so there is no flag
to forget in either direction.

`scripts/android-check.mjs` fails the build if the two publisher IDs disagree or
if either reverts to a Google test ID. The mismatch case is why: nothing errors
at runtime, the banner simply never fills, and that is close to undiagnosable
from inside the app.

`docs/store/app-ads.txt` must carry the same publisher; the checker enforces it.
AdMob limits serving until that line is live at the root of the developer
website listed in Play — see `docs/store/RELEASE.md`.

To test against Google's test units, swap both IDs back together and expect the
checker to fail until you swap them forward again. Never click your own live
ads — AdMob suspends accounts for it.

## Out of scope by decision

Interstitials, rewarded ads, mediation, an ad-free purchase, and any runtime UI
for changing the threshold. `AD_AFTER_VISITS` is a source constant; changing it
is a code change.
