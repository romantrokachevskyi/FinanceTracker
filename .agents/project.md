# Project facts and contracts

Read this file for behavior, storage, calculation, accessibility, or layout
work. The code remains authoritative when these notes disagree with it.

## Runtime

- The app is a static site with no dependencies or build step.
- `index.html` contains the markup, styles, and application script.
- `manifest.webmanifest` and `icons/` provide the installable home-screen app metadata.
- User data stays in browser `localStorage`; the app makes no network calls.
- The interface supports Ukrainian and English, defaults to Ukrainian, and the primary viewport is mobile.

## User flow

1. Create a plan from the current balance and next salary date.
2. See the daily allowance and the planned balance for today.
3. Check in today's actual balance without resetting the original plan.
4. Start a new period explicitly on or after payday.

The latest saved balance remains the assumed current balance until the user
updates it. Its age stays visible, but it must continue to produce the daily
allowance and ahead/behind status.

The balance check-in expands within the dashboard, previews the resulting
daily allowance, and does not mutate state until the form is submitted.

## Local state contract

Primary key: `financeTrackerStateV1`.

The independent `financeTrackerLocaleV1` preference stores `uk` or `en` and
must never cause the primary financial state to be rewritten.

Legacy fields are durable:

- `balance`: starting balance for the period.
- `startDate`: local calendar date when the period began.
- `salaryDate`: future local calendar date for payday.

Additive fields currently used:

- `currentBalance`: latest actual balance.
- `currentBalanceDate`: local calendar date of the check-in.
- `schemaVersion`: currently `2`.

Compatibility rules:

- A valid legacy object must render without being rewritten on load.
- On explicit writes, spread the existing object before applying changed
  fields so unknown properties survive.
- A check-in changes only current-balance fields and additive metadata.
- A new period resets the plan only after explicit submission.
- Invalid raw data is backed up under an unused
  `financeTrackerStateV1Backup...` key before replacement.
- If storage cannot be read, block writes; unread data may still exist.

## Calculation model

- Calendar dates use strict `YYYY-MM-DD` validation.
- Day differences use UTC date ordinals to avoid DST drift.
- Planned balance is the starting balance multiplied by the fraction of the
  original period remaining.
- Daily allowance is current balance divided by remaining pre-payday days.
- On payday, show the rollover state instead of dividing by zero.

## UX constraints

- Support a 320 px viewport without horizontal scrolling.
- Touch targets are at least 44 px; current controls use 48 px.
- Keep browser zoom enabled and respect safe-area insets.
- Do not communicate financial status by color alone.
- Move focus when a focused panel is hidden and announce dynamic errors or
  results appropriately.
