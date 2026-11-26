# Vansvriksh – UX Improvement Roadmap

Effort uses the audit scale (Small ≈ ≤1 day, Medium ≈ 2–5 days, Large ≈ >1 week, including testing). Totals are rough single-developer estimates and assume no API work unless stated. IDs refer to `UX_ISSUE_BACKLOG.md`.

## Phase 1 – High-impact, low-effort (before the controlled beta)
**Items:** UX-01, 24, 34, 03, 05, 07, 08, 22, 26, 27, 29, 36, 37, 38, 45 (copy), 14, 15, 16, 18 (sizes/contrast), 19 (focus ring only), 11 (open target on nav).
**Effort:** about 8–12 days total (one Medium: UX-01; rest Small).
**Dependencies:** none technical. UX-01 should land before any beta invitations are sent. Agree the vocabulary (UX-08) and product name (UX-05) first because copy changes touch many files.
**Exit check:** an invited tester can accept from a phone without help; the Critical items' acceptance criteria in the backlog pass.

## Phase 2 – Core navigation and workflow
**Items:** UX-12 (section structure), 13 (profile panel/sheet), 30 (single profile, single Edit), 28 (searchable pickers), 25 (retry-safe linking), 35 (claim pattern + unlink UI), 39 (invitation lifecycle), 02 (invite context), 04 (persist state/routes), 09, 10, 40, 21.
**Effort:** about 4–6 weeks.
**Dependencies:** UX-12 before UX-13 and 30 (they live inside the new structure). UX-02 needs an invitation-preview API response; UX-10 (rename) and a server-side "add person with link" operation (UX-25 long-term) need API work and should be scheduled with the backend. UX-35 unlink uses an existing API route.
**Exit check:** task-based test (add a person with a parent; find yourself; invite someone) passes with 5 users without hints.

## Phase 3 – Visual design and interaction refinement
**Items:** UX-43 (theme decision, token consolidation, remove dead blocks, retire `!important`), 44, 31 (single dialog replacing native prompts), 33, 47, 20, 23 (after testing).
**Effort:** about 3–4 weeks, dominated by UX-43.
**Dependencies:** Phase 2 structure settled first; add visual regression screenshots (none exist today) before touching CSS; UX-31 depends on the shared dialog from Phase 4's UX-32 work, so build the dialog once and use it for both.
**Risk:** highest regression risk in the plan; do after beta feedback, not before.

## Phase 4 – Mobile and accessibility
**Items:** UX-41 (phone test, then fixes), 17 (gestures, if the test confirms), 19 (roving focus, list view, AT labels), 32 (dialog semantics), 42 (type scale), 18 (remaining contrast).
**Effort:** about 3–4 weeks; start the UX-32 dialog and the phone test early, in parallel with Phase 2.
**Dependencies:** UX-13 (side panel/sheet) shapes the mobile layout; do the phone test on the Phase 1 build so that Phase 2 is informed by it.
**Exit check:** keyboard-only pass of every journey; screen-reader smoke test; 5-user phone test.

## Phase 5 – Advanced enhancements
**Items:** UX-46 (one-click copy of the sample, if testing shows demand), a light/dark toggle, in-product onboarding checklist ("Add yourself · Add a parent · Invite a relative"), list/outline alternative to the tree, photo gallery on profiles, undo for recent edits.
**Effort:** open-ended; each Medium–Large.
**Dependencies:** Phases 2–4 complete; several need API work.

## Sequencing summary

1. Phase 1 (now) → 2. start Phase 4 phone test and dialog work alongside Phase 2 → 3. beta feedback → 4. Phase 3 visual consolidation → 5. Phase 5.

Do not start Phase 3 CSS consolidation before beta: it is the largest regression risk and none of the beta-blocking items depend on it.