# Classroom CBT changes and review

Reviewed against main commit `43699c63123b31d5c3e0e3c36d9891c554bc6c24` on 16 September 2026.

## Changes

- Answer option labels override the global uppercase form-label style. JSON text keeps its original case.
- Answer parsing matches intact text before legacy option labels. This fixes Biology Q56 (a final `]` was stripped from its correct answer), preserves punctuation and distinguishes `x` from `X`. All 170 bundled questions now have resolvable answer keys; this is a structural check, not an independent academic re-solve.
- Admin > Exam Controls > **Show performance report to students after submission**. Use **Apply Report Visibility** for an immediate change, or save the complete exam settings. The stored field is `exam_config/current_test.showStudentReport`. Older configurations without this field keep the existing ON behavior.
- OFF hides the student's scores, answer ledger, security summary and report download. Completion, save status and feedback remain available; failed saves retry automatically. The result still saves automatically. Open student report pages react to changes in the setting. Policy-read failure hides the report; downloading checks the setting again.
- Existing leaderboard View now uses the same question renderer as the student report. View is also available in Security Analysis. Stored questions, options, tables, passages, images, answers, correctness and security event details are displayed. Question replacements are shown as events, not counted as additional tab violations.
- Admin View adds **Print / Save PDF** and **Download Full JSON**. Existing results CSV and student PDF export remain available. The report setting does not restrict admin exports.
- Embedded figures are preserved in new report snapshots. Reports up to 250 KB stay inline; larger reports use bounded parts under reserved `results/~report~<attempt-id>~<index>` IDs. Student lists exclude that reserved range, and View loads parts only when needed. Retries reuse the same IDs. Deleting a report cleans up its parts. No new collection permissions are introduced.
- Image options expressed as objects are preserved. Both portals load MathJax `mhchem` for chemical reactions, and multiline TeX blocks remain intact. `examples/supported-questions.json` demonstrates the supported schema; `tests/rendering.html` is a Firebase-free rendering fixture.
- `screen-awake.js` requests a screen wake lock when starting the exam, reacquires after returning to the page and releases on submission, admin force submission, start failure and page exit. Unsupported or denied requests produce a status message rather than a penalty.

## Important limits found in the existing repository

1. **Report visibility is a UI control, not secure authorization.** `admin.html` checks a hardcoded credential in the browser and a sessionStorage flag. `firestore.rules` permits public reads/writes to both exam configuration and results. A modified client can bypass the UI or directly read/modify those records. Firebase Authentication, verified admin roles and restrictive deployed Firestore rules are required for genuine admin-only access. No Firebase deployment/admin-account access was available for this review; deployed rules were not inspected or changed.
2. **The checked-in rules omit `exam_sessions`.** Its live behavior depends on the actual deployed rules. Uploaded question banks are stored under the publicly writable `exam_config` collection. Do not assume repository changes deploy Firebase rules automatically.
3. **Historical embedded figures are not recoverable from result records.** Older code replaced data-image strings with a placeholder. New snapshots retain embedded images without that replacement. External image URLs still require stable accessible assets; replacing or deleting the externally hosted file can affect old reports. The admin view identifies historical missing figures.
4. **Force submit currently finalizes the most recent saved session summary.** Live sessions do not contain the full question ledger. Full question-by-question recovery for a disconnected or force-submitted student requires durable answer snapshots and a server-side finalization workflow.
5. **Phone OS restrictions still apply.** A website cannot override the power button, all battery-saver policies or every browser's wake-lock restrictions. Test on actual classroom phones. See the [Screen Wake Lock API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API).

## Next improvements, in priority order

1. Secure admin authentication, per-attempt ownership, server-side scoring and server-enforced one-attempt limits. Rotate the exposed admin credential during that migration.
2. Save each answer locally and sync it with a durable attempt ID. Resume after accidental refresh/network loss with the original end time. Show Saved / Sync pending clearly.
3. Add CBT question palette states: not visited, unanswered, answered, marked for review, answered and marked for review; add Clear Response and an attempted/unattempted summary before final submission.
4. Add configurable exam presets for marking, negative marks, duration, sections and navigation. Use the exact target exam's current official pattern when defining JEE or government-exam presets.
5. Add a short, unscored practice round before the real classroom test, including phone readiness checks. Provide desktop/laptop practice too for mouse and keyboard familiarity.
6. Add subject/topic accuracy, per-question time, weak-topic practice and admin-controlled result release. Capture timings and topic metadata first so reports do not invent these measurements.

## Validation

- `node tests/archive.cjs`: multi-megabyte snapshots, embedded-image and Unicode round trips, bounded writes, missing/corrupt parts, retries and legacy records.
- `node tests/regression.cjs`: isolated mocked DOM/database tests for report visibility (including live updates and failure), saved scores and answer details, duplicate-submission protection, admin setting save, old records, event timelines, and wake-lock lifecycle/rejection/races. These tests make no live Firebase calls.
- Both HTML module scripts and the added JavaScript files pass syntax checks. Local script references and duplicate HTML IDs were checked. `git diff --check` passes; the existing CSV export code is unchanged.
- The published student and admin entry pages and Firebase-free rendering fixture were checked in remote Chrome. Eight rich question formats rendered successfully. No actual PDF download, physical phone screen-timeout test or live Firestore submission test is claimed.

For final classroom acceptance, use a staging/test Firebase project to submit one small paper with report ON, one with report OFF, verify both in admin View, export CSV/PDF/JSON, change visibility while a student report is open, and check screen-on/release behavior on the phones used in class. Never use real student submissions for destructive tests.

## Storage compatibility

The `~report~` result document-ID range is reserved for archive parts. Auto-generated student attempt IDs and legacy result IDs remain outside it. The new admin lists use document-ID range queries and do not download every archived image when refreshing the leaderboard. Other external tools that directly scan the results collection should exclude `recordType == "report_chunk"`. Keep all updated HTML and JavaScript files together when publishing; do not mix the old admin with the new student portal.

The primary result is authoritative. A failed optional live-session mirror no longer labels a durable primary result as lost. If live-session reads are denied, admin still displays saved results and reports the session-access limitation.

## Completion and navigation update

- Removed the manual Retry Result Save button. Failed saves retry after 2 seconds, backing off up to 30 seconds, and immediately on connectivity restoration. In-flight requests remain deduplicated. Keep the page open until success; durable offline answer recovery is still a separate future improvement.
- Completion starts with a professional thank-you message. Success is shown only after saving.
- Back (including visible fullscreen exit) shows an English Yes/No dialog. No resumes fullscreen where supported; Yes submits current answers and shows completion/save status. Timer expiry still submits while a dialog is open.
- F5/Ctrl/Cmd+R shows an English refresh dialog. Browser toolbar refresh and page close use the browser's native warning. Its text/buttons/language cannot be customized, and mobile browsers may omit it: [beforeunload limitations](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event). Canceling refresh does not increment the page-exit counter.
- Wake lock is checked every 10 seconds while the timer runs, with cooldown after rejection. Existing visibility/focus/fullscreen recovery and submit cleanup remain in place. Expired stored deadlines cannot grant a fresh full timer.
- `node tests/navigation.cjs` checks Back, No/Yes, fullscreen exit, Escape, keyboard/native refresh, unsaved-result protection and cleanup. Regression coverage includes automatic retry and expired timers.
- `tests/exam-safety.html` is a Firebase-free 3-minute physical-phone acceptance check using the production wake-lock/navigation modules. Real phone timeout verification requires physical device access; remote browser API success is not proof of a phone screen remaining lit.
