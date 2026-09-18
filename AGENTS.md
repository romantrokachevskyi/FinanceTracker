# FinanceTracker agent guide

This file is the canonical instruction entry point for every coding agent.
Vendor adapters must reference it, not duplicate it.

## Product

FinanceTracker is an offline-first, Ukrainian and English, mobile-first web app,
distributed worldwide, that answers one question: how much can the user safely
spend each day until payday? It is free, and one ad banner pays for it.

## Start here

1. Run `git status --short` and preserve unrelated work.
2. Read `.agents/project.md` before changing behavior, storage, calculations,
   accessibility, or layout.
3. Read `.agents/workflow.md` before implementing or reviewing a change.
4. Read `.agents/android-release.md` before changing packaging, signing, app
   identity, or store artifacts.
5. Read `.agents/ads.md` before changing the banner, the visit counter, or
   anything touching the privacy posture or store declarations.
6. Inspect the relevant code; do not rely on these notes when the code can
   answer a question directly.

`docs/INDEX.md` lists every doc, including the store and release files.

## Non-negotiable contracts

- Preserve existing browser data under `financeTrackerStateV1`.
- Never clear local storage, rename the primary key, or eagerly rewrite valid
  legacy data during page load.
- Merge additive state changes so unknown properties survive.
- Keep malformed data recoverable before an explicit replacement.
- Keep the app's own code offline and private: no telemetry, accounts, or
  network calls. The one sanctioned exception is the Google Mobile Ads SDK,
  which shows a banner after ten days of use — see `.agents/ads.md`. Financial
  data must never reach it or any other third party.
- Keep Ukrainian and English UI copy consistent and optimize for narrow touch screens.
- Maintain keyboard access, visible focus, inline errors, and WCAG AA contrast.

## Engineering agreements

- Prefer the platform: vanilla HTML, CSS, and JavaScript with no build step.
- Keep changes proportional to this small project. Add dependencies only when
  their durable value clearly exceeds their cost.
- Use small, single-purpose files when splitting code; avoid abstractions used
  only once.
- Preserve local calendar-day semantics with strict `YYYY-MM-DD` parsing and
  UTC date ordinals.
- Treat stored JSON as untrusted input and handle storage failures without
  overwriting unread data.
- Do not commit temporary task notes, screenshots, logs, or generated reports.

## Verification

- Run `node scripts/check.mjs` after every code or harness change.
- Read `.agents/checks.md` before editing `scripts/`, adding coverage, or using
  a DOM API the app does not already use.
- For UI changes, serve the repository locally and test at 320 px and a common
  375–390 px mobile width.
- Exercise initial setup, validation, balance check-in, reload persistence,
  stale data, payday rollover, and storage-error recovery as relevant.
- Report what was verified and what remains manual.

## Keep this harness healthy

- Update the smallest relevant instruction file in the same change when a
  command, durable architecture fact, or data contract changes.
- Remove stale guidance instead of appending corrections.
- Keep vendor-specific files as thin adapters only.
- Add a durable decision note only for a choice that future agents could
  reasonably undo without knowing its rationale.
- If guidance becomes specialized, move it to a focused file and link it from
  the appropriate routing section; do not load every detail by default.
