# Change workflow

Use the smallest workflow that gives evidence proportional to the change.

## Before editing

- Confirm the requested outcome and inspect the relevant code.
- Check the working tree and avoid unrelated edits.
- Identify affected contracts in `.agents/project.md`.
- For non-trivial work, state acceptance criteria before implementation.

## While editing

- Prefer focused patches and existing browser APIs.
- Keep display, storage, and date logic independently understandable.
- Preserve unknown stored fields and all failure paths.
- Use `textContent` for user-derived output; do not add HTML injection sinks.
- Keep temporary investigation artifacts outside the repository.

## Release checks

Always:

```sh
node scripts/check.mjs
git diff --check
```

When behavior changes:

- Test absent, valid legacy, current, malformed, and unreadable storage.
- Test empty and invalid inputs without state mutation.
- Test day-before-payday, payday, month/year boundaries, and a DST boundary.
- Reload after writes and confirm the original plan still has its meaning.

When UI changes:

- Check 320 px and 375–390 px widths with no horizontal overflow.
- Test keyboard submission, focus movement, error announcements, touch size,
  contrast, zoom, and reduced motion.

## Handoff

Summarize the user-visible outcome, data-compatibility impact, checks run, and
remaining manual risks. Do not claim checks that were not run.

## Maintenance trigger

Update this harness only when a durable fact, command, contract, or repeated
failure mode changes. Ordinary implementation details belong in code and tests,
not permanent agent context.
