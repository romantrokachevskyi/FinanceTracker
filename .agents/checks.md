# Check suite

Read this file before changing `scripts/`, adding coverage, or reaching for a
DOM API that `index.html` does not already use.

## What `node scripts/check.mjs` covers

- Static assertions over `index.html`: Ukrainian `<html lang>`, `viewport-fit=cover`,
  the `financeTrackerStateV1` key literal, `Date.UTC(`, form semantics, the
  check-in disclosure and its described-by wiring, and explicit `requestSubmit()`.
- Bans in `index.html`: `localStorage.clear`/`removeItem`, `fetch`,
  `XMLHttpRequest`, `WebSocket`, and more than one `<script>`.
- `CLAUDE.md` must stay exactly `@AGENTS.md`.
- `AGENTS.md`, `.agents/project.md`, and `.agents/workflow.md` must each stay at
  or under 120 lines.
- `scripts/behavior-check.mjs` then runs the inline script as a behavior suite.

## The behavior harness constrains application code

`behavior-check.mjs` executes the single inline script in `node:vm` against a
hand-written stub, not a real DOM.

- `document.getElementById` returns an auto-created stub for any id. There is no
  element tree, no `querySelector`, no `dataset`, and no real event dispatch.
- `document.addEventListener` records listeners; a test fires them with
  `app.document.dispatch(type, event)`. Events do not bubble from elements —
  pass the `target` (a plain object with `tagName`) yourself.
- Stub element surface: `hidden`, `value`, `textContent`, `className`,
  `disabled`, `placeholder`, `classList.toggle`, `addEventListener`,
  `setAttribute`/`getAttribute`/`removeAttribute`, `focus`, `requestSubmit`,
  `showModal`, `close`.
- Available globals: `document`, `localStorage`, `window.matchMedia`,
  `window.addEventListener`, `navigator`, `Intl`, `Date`. `window.Capacitor`
  exists only when the `capacitor` option is set — its absence is what the web
  build looks like from inside the harness. The fake `AdMob` records
  `initialize`, `requestConsentInfo`, `showConsentForm`, `showBanner`,
  `hideBanner`, `resumeBanner`, `showPrivacyOptionsForm` and `addListener`.
- An API outside that surface works in the browser but fails the check. Extend
  the stub in the same change that introduces the need.

## Adding coverage

- There is no per-test runner or name filter; `node scripts/check.mjs` runs
  every case.
- Add a case with `createAppHarness(source, state, options)` and append a
  `requireBehavior(condition, message)` call inside `checkBehavior`.
- `options` supports `failReads`, `failWrites`, `locale`, `ads`, `capacitor`,
  `consentInfo` and `consentAfterForm`.
- Build fixtures with `localDate(offset)` so cases stay date-independent.
- `app.writes` and `app.writesFor(key)` assert exact write counts. They are the
  main guard against eager or duplicated storage rewrites.
- `checkBehavior` is `async`; `await` it, and `await flush()` before asserting
  on `app.adCalls` or `app.adCallNames()`, which are async by nature.
- Ad cases need a same-day `ads` seed when they assert on total `writes`, or the
  startup visit write shifts the count. See `.agents/ads.md`.

## Manual UI pass

The app is static with no build step. Serve it, then test at 320 px and a
375–390 px width:

```sh
npm run serve
```

`scripts/serve.mjs` also accepts `?seed=setup|dashboard|checkin|payday` to
render a populated state without touching `index.html`.

## Packaging checks

`scripts/android-check.mjs` guards the Android packaging contracts — app
identity, SDK levels, the `https://localhost` storage origin, the privacy
posture, signing, and store artifact sizes. `scripts/check.mjs` runs it. Add new
packaging assertions there rather than in `scripts/check.mjs`.
