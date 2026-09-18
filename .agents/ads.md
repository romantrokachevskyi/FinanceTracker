# Ads

Read before changing the banner, the visit counter, or anything about the
privacy posture. Design rationale: `docs/superpowers/specs/2026-09-18-ad-banner-design.md`.

## What ships

One Google AdMob banner, anchored bottom-centre, adaptive size. It appears only
after the user has opened the app on `AD_AFTER_VISITS` (10) separate calendar
days. On web and in the PWA there are no ads at all — the banner is native-only.

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

The GDPR message and the privacy options form are configured in the AdMob
console, not in this repo — an unconfigured message means the form never
appears and consent is never gathered.

`showBanner` passes no `npa` flag on purpose. The Mobile Ads SDK reads UMP's
consent signal itself, which is Google's own guidance. Setting `npa` from the
status was a bug: Ukraine is outside the EEA, so UMP returns `NOT_REQUIRED`
there, and every Ukrainian user — the primary audience — would have been served
non-personalised ads at a lower rate.

## Ad unit IDs

`AD_BANNER_ID` in `index.html` and `admob_app_id` in
`android/app/src/main/res/values/strings.xml` both hold Google's public **test**
IDs. `isTesting` is derived from the test publisher prefix
`ca-app-pub-3940256099942544`, so replacing the two IDs is the only edit needed
to go live — there is no separate flag to forget.

Never ship real IDs with `isTesting` forced on, and never click your own live
ads: AdMob suspends accounts for it.

## Out of scope by decision

Interstitials, rewarded ads, mediation, an ad-free purchase, and any runtime UI
for changing the threshold. `AD_AFTER_VISITS` is a source constant; changing it
is a code change.
