# Vansvriksh – UX Design Principles and Interaction Patterns

Derived from the findings in `UX_AUDIT_REPORT.md`. These refine, and where noted correct, `docs/DESIGN_SYSTEM.md`. They are guidance for future work; nothing here has been implemented.

## Principles (with the evidence behind each)

1. **Say where I am and what I can do next.** Always show the current family; after sign-in, never ask the user to choose from a list of one (UX-03, 09). Empty states offer a button, not only a sentence (UX-22).
2. **Feedback lives next to the action.** Confirm every save, role change and delete beside the control that caused it, in words that say what changed ("Meera is now an Editor") (UX-26, 37).
3. **Use family words, not data words.** Prefer "Mother/Father/Parent", "Child", "Spouse", "Living", "Who has access". Avoid "precision", "workspace", "claim", "connections" for four things (UX-08, 27, 34, 35).
4. **Keep the honest-data model, change the wording.** Unknown/approximate/range dates stay; the questions asked of the user become plain ("How well do you know the date?") (UX-27).
5. **Progressive disclosure, but never hide the way in.** Advanced tree views and management sections may be collapsed, but their entry points must be visible and must open what they point to (UX-11, 12, 20).
6. **Predictable motion.** Selecting something must not move what the user is looking at. Zoom and position persist unless the user explicitly resets; Reset returns to the opening view (UX-13, 14, 15, 16).
7. **One way to do each thing.** One profile view, one Edit entry, one confirmation dialog, one claim pattern (UX-30, 31, 35).
8. **Protect the irreversible, plainly.** Keep typed-name confirmation and the deceased-lock explanation; show what an import or role change will do before it happens (UX-37, 45).
9. **Readable by default.** Minimum sizes: body 16px, secondary 14px, caption 12px; AA contrast for all text including SVG; never colour alone (the deceased marker already meets this) (UX-18, 42).
10. **Operable without a mouse or a precise finger.** Visible focus everywhere, labelled dialogs with Escape and focus return, 44px touch targets, gestures with button equivalents (UX-17, 19, 32).
11. **Trust is a feature.** One product name; show who invited you and what you can see; state what is shared with Google and what is private (UX-02, 05, 06, 38).

## Common interaction patterns

| Pattern | Rule | Replaces |
|---|---|---|
| **Dialog** | One component: `role="dialog"`, `aria-modal`, labelled, Esc closes, focus moves in and returns, errors shown once inside | Edit/relationship/deceased modals; native `confirm`/`prompt` (UX-31, 32) |
| **Destructive confirm** | Plain sentence of consequence; typed name only for deleting a family or person; the destructive button uses the Danger style and is never the default | 8 native calls |
| **Inline message / toast** | Success: toast + inline status near the control, `role="status"`. Error: inline at the field or action, `role="alert"`, focus moved | One page-level banner (UX-26) |
| **Person picker** | Searchable combobox: name, birth year, optional parent name; shown wherever a person is chosen | Plain selects (UX-28) |
| **Relationship entry** | Live sentence preview ("Anita will be recorded as the parent of Ravi") and a swap control | Parent/Relationship/Child selects (UX-29) |
| **Profile** | One panel/sheet: Header · Relatives (Parents, Spouse, Siblings, Children) · Details · Photo · About. Same for every entry point and role; role changes only which buttons appear | Two profile panels (UX-30, 34) |
| **"This is me"** | Single pattern in the profile for all roles; first-run prompt "Which person are you?"; owner/admin can undo | Claim variants (UX-35) |
| **Tree controls** | Fit, Zoom −/+, Reset (= Fit + clear focus). Gestures optional extras. Selecting never rescales | UX-14–17 |
| **Section navigation** | Top-level sections or tabs (Tree · People · Family circle · Settings); a nav item always lands on visible content | Anchors to closed `<details>` (UX-11, 12) |
| **Role description** | Each role has a one-line capability description wherever it can be chosen | Terse select text (UX-38) |

## Visual language (consolidation targets)

- One theme decision (dark Atlas *or* light, optionally both with a toggle) and one token file; delete the disabled `(max-width:0px)` blocks (UX-43).
- Four button variants: Primary, Secondary, Quiet (text), Danger. Everything else composes these.
- Eyebrow labels only where they carry meaning (UX-44).
- Date format: `4 Mar 1999` everywhere; years as `1999`; ranges `1940–1945`; approximate `c. 1940`.
- Vocabulary list kept in one place and reused in UI, emails, WhatsApp text and docs.