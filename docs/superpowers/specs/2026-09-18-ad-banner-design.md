# Ad banner after N visits — design

Monetize the free app with a single AdMob banner that appears only once a user
has opened the app on `AD_AFTER_VISITS` separate days (default 10).

## Decisions

- **Provider:** Google AdMob via `@capacitor-community/admob@8` (targets
  Capacitor 8; the project runs 8.5.0). Accessed as
  `window.Capacitor.Plugins.AdMob`, so the no-build-step rule holds.
- **Placement:** anchored `BOTTOM_CENTER`, `ADAPTIVE_BANNER`.
- **Visit:** one app open per calendar day. Ten opens in one afternoon count as
  one. This is the "do not scare them" requirement read literally.
- **Consent:** UMP form via `requestConsentInfo()` / `showConsentForm()`. The
  user base is Ukrainian and EU, so this is required, not optional.
- **Web/PWA:** no ads at all. The browser build stays fully offline.

## Privacy boundary change

This reverses a contract the app was published under. AGENTS.md permits it only
as an explicit product requirement; this spec is that requirement.

| Before | After |
| --- | --- |
| `INTERNET` stripped with `tools:node="remove"` | `INTERNET` granted (AdMob needs it) |
| Data safety: no ads, no advertising ID | Contains ads, shares advertising ID |
| `.agents/project.md`: "makes no network calls" | the ad SDK makes network calls |

What does **not** change: the balance, payday and check-in dates never leave the
device. AdMob receives no financial data. `allowBackup="false"` stays, so Auto
Backup still cannot copy the plan to Google Drive. The in-app promise
«Дані зберігаються лише на цьому пристрої» stays true and stays on screen.

## Components

### 1. Visit counter (`index.html`, pure)

Separate storage key so the `financeTrackerStateV1` contract is untouched:

```js
const ADS_KEY="financeTrackerAdsV1";
const AD_AFTER_VISITS=10;
// stored: {"visits":3,"lastVisitDate":"2026-09-18"}
```

- `readAdState()` — returns `{visits:0,lastVisitDate:null}` on any missing,
  malformed or unreadable value. Never throws.
- `countVisit(adState,today)` — pure. Returns the same object when
  `lastVisitDate === today`, otherwise `{visits:visits+1,lastVisitDate:today}`.
- `shouldShowAds(adState)` — `adState.visits >= AD_AFTER_VISITS`.
- Persisting the counter is best-effort: a write failure is swallowed and never
  surfaces to the user or blocks the app.

Counting runs at startup, before rendering, and is independent of whether a plan
exists — a user still in setup accrues visits.

### 2. Native banner (`index.html`, guarded)

Runs only when `window.Capacitor?.isNativePlatform?.()` is true and
`Capacitor.Plugins.AdMob` exists. Entirely wrapped in `try/catch`: an ad failure
must never degrade the finance app.

```
initialize()
  → requestConsentInfo()
  → showConsentForm()            if status === "REQUIRED" && isConsentFormAvailable
  → showBanner({ adId, adSize:"ADAPTIVE_BANNER", position:"BOTTOM_CENTER",
                 npa: consent not OBTAINED, isTesting: <derived> })
```

`isTesting` is derived from the ad unit ID carrying Google's test publisher
prefix `ca-app-pub-3940256099942544`, so swapping in a real ID needs exactly one
edit and there is no second flag to forget.

### 3. Layout reservation

The banner is a native overlay that would otherwise cover the bottom of the
card. On `bannerAdSizeChanged` the reported height is written to a
`--ad-height` custom property, folded into the existing body padding:

```css
body{padding-bottom:calc(max(20px,env(safe-area-inset-bottom)) + var(--ad-height,0px))}
```

No banner → the property stays unset → layout is byte-identical to today. The
property is only ever written inside the native branch, so the vm test harness
never touches `documentElement.style`.

### 4. Android wiring

- `AndroidManifest.xml`: drop the `tools:node="remove"` line; add
  `com.google.android.gms.ads.APPLICATION_ID` meta-data pointing at
  `@string/admob_app_id`.
- `strings.xml`: add `admob_app_id`, seeded with Google's test app ID.
- `package.json`: `@capacitor-community/admob` in `dependencies`.

## Testing

Behaviour tests in `scripts/behavior-check.mjs` (the existing vm harness, with a
new `ads` seed option on `createAppHarness`):

1. First ever open writes `{visits:1,lastVisitDate:today}`.
2. A second open on the same day does not write `financeTrackerAdsV1` again.
3. An open on a later day increments to 2.
4. `visits: 9` → no ads; `visits: 10` → ads. Threshold is exact.
5. A malformed `financeTrackerAdsV1` value is replaced, not thrown on.
6. `failWrites` → the app still renders the dashboard normally.
7. No `Capacitor` global → no ad calls, no crash.

`scripts/check.mjs` keeps banning `fetch`/`XMLHttpRequest`/`WebSocket` in
`index.html` — still true, since the SDK is native — and gains an assertion that
`ADS_KEY` and `AD_AFTER_VISITS` are declared.

`scripts/android-check.mjs` `checkPrivacy` inverts: `INTERNET` must now be
present and un-removed, `allowBackup="false"` must still hold, and the AdMob
meta-data plus `admob_app_id` string must exist.

## Docs to correct in the same change

`AGENTS.md`, `.agents/project.md`, `.agents/android-release.md`,
`docs/store/data-safety.md`, `docs/store/listing-uk.md`,
`docs/store/listing-en.md`, `docs/privacy/index.html`.

## Out of scope

Interstitials, rewarded ads, mediation, an ad-free purchase, and any runtime UI
for changing the threshold. `AD_AFTER_VISITS` is a source constant.

## Requires the account owner

Creating the AdMob app and banner ad unit, linking AdMob to Play Console, and
re-answering the Play declarations. Ships with test IDs until then.
