# FinanceTracker agent guide

This file is the canonical instruction entry point for every coding agent.
Vendor adapters must reference it, not duplicate it.

## Product

FinanceTracker is an offline, Ukrainian-first bilingual, mobile-first web app that
answers one question: how much can the user safely spend each day until payday?

## Start here

1. Run `git status --short` and preserve unrelated work.
2. Read `.agents/project.md` before changing behavior, storage, calculations,
   accessibility, or layout.
3. Read `.agents/workflow.md` before implementing or reviewing a change.
4. Inspect the relevant code; do not rely on these notes when the code can
   answer a question directly.

## Non-negotiable contracts

- Preserve existing browser data under `financeTrackerStateV1`.
- Never clear local storage, rename the primary key, or eagerly rewrite valid
  legacy data during page load.
- Merge additive state changes so unknown properties survive.
- Keep malformed data recoverable before an explicit replacement.
- Keep the app offline and private: no telemetry, accounts, or network calls
  unless a product requirement explicitly changes that boundary.
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
