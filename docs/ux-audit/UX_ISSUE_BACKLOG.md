# Vansvriksh – UX Issue Backlog

Source: `UX_AUDIT_REPORT.md` (details, evidence and reasoning live there). Sorted by priority, then ID. Kind: **Confirmed** (code-verified), **Risk** (needs testing before committing), **Subjective** (preference). Phase refers to `UX_IMPROVEMENT_ROADMAP.md`. "API?" marks items whose best fix needs an API change, which this audit does not make.

| ID | Priority | Size | Kind | Phase | Screen | Action | API? |
|---|---|---|---|---|---|---|---|
| UX-01 | Critical | Medium | Confirmed | 1 | Invitation landing (`/invite/:code`) | Render the Google button on the landing page itself and accept (or offer a single "Accept" step) straight after sign-in. As a fallback, keep the code in `sessionStorage` and resume after sign-in at `/`. |  |
| UX-24 | Critical | Small | Confirmed | 1 | Edit person → "Estimated range" birth date | Fix the regex (`\d`, `\s`), and accept en dash/space variants in both add and edit forms (add form uses `split("-")` and would send NaN for an en dash). |  |
| UX-34 | Critical | Small | Confirmed | 1 | Profile → "Family connections" list | Compute the label from the viewer's point of view ("Father/Mother/Parent", "Child", "Spouse", "Sibling"), grouped under Parents · Spouse · Siblings · Children. |  |
| UX-02 | High | Medium | Confirmed | 2 | Invitation landing | Show "Anita invited you to join the Sharma family as an Editor (can add and edit people)". Needs a read-only invitation-preview response from the API; coordinate separately (this audit changes no API). | Yes |
| UX-03 | High | Small | Confirmed | 1 | Workspace home after sign-in | Auto-select the only family (or the last used family). Keep the empty state only for users with zero families. |  |
| UX-12 | High | Large | Confirmed | 2 | Workspace page structure | Use top-level sections or tabs (Tree · People · Family circle · Settings), always show "Add person" in People, move "Create a family" to the family switcher menu. Do this once, deliberately, not piecemeal. |  |
| UX-13 | High | Medium | Confirmed | 1 | Tree → select a person | Show the profile in a side panel (desktop) or bottom sheet (mobile) that does not move the tree, or scroll/focus it into view. Do not auto-centre when the node is already visible. |  |
| UX-18 | High | Small | Confirmed | 1 | Tree node text and contrast | Raise date text to ≥12 and AA contrast; set a minimum readable scale (e.g. do not Fit below ~50%; scroll instead); lighten neutral initial colour. |  |
| UX-19 | High | Medium | Confirmed | 4 | Tree → keyboard and assistive tech | Add a visible focus ring on the node circle; roving tabindex with arrow keys; drop `role="img"` on the svg (use `role="group"`); offer a list view of the same tree. |  |
| UX-25 | High | Medium | Confirmed | 1 | Add person with a link | Client-side: after person creation, show "Anita was added but the link failed — retry link" and never resubmit the create. Longer term a single server-side operation (API change, out of scope). | Yes |
| UX-26 | High | Small | Confirmed | 1 | Page-level messages | Render feedback beside the action (inline) and as a toast with `role="status"`/`alert`; scroll/focus errors into view. |  |
| UX-28 | High | Medium | Confirmed | 2 | Person pickers (add link, relationships, edit relationship) | Use a searchable combobox showing name + birth year (+ parent name when ambiguous). |  |
| UX-32 | High | Medium | Confirmed | 4 | Edit, relationship-edit and deceased dialogs | Shared `<Dialog>` with labelling, Esc, focus management; show errors once, inside the dialog. |  |
| UX-35 | High | Medium | Confirmed | 2 | Claiming a profile ("Is this you?") | One "This is me" pattern in the profile for all roles, a first-run prompt ("Which person are you?"), and unlink/"not me" for owners/admins. |  |
| UX-37 | High | Small | Confirmed | 1 | Family circle → role select and Remove | Confirm role changes ("Make Meera an Editor?") and show a confirmation message. |  |
| UX-41 | High | Medium | Risk | 4 | Mobile (whole app) | Run a 5-user phone test (invite → accept → explore tree → open profile → add a person) before beta. |  |
| UX-04 | Medium | Medium | Confirmed | 2 | Whole app (state and URLs) | Persist last family (localStorage) now; consider `/f/:familyId` and `?person=` routes later. |  |
| UX-05 | Medium | Small | Confirmed | 1 | Branding (title, header, footer, invite, WhatsApp text) | Pick one spelling and use it in UI, emails, WhatsApp text and metadata. |  |
| UX-06 | Medium | Small | Risk | 1 | Sign-in panel | Do not add auth methods yet. Add one line explaining why Google, what is shared (name/email/photo) and what is not, and test with 3–5 older relatives. |  |
| UX-07 | Medium | Small | Confirmed | 1 | App-wide (account menu, footer) | Add "Help & feedback" and "Privacy" entries to the account menu linking to the existing beta support/privacy pages. |  |
| UX-08 | Medium | Small | Confirmed | 1 | Family switcher, family circle, relationships, profile | Fix the vocabulary: "Your families" (switcher), "Relatives and relationships" (tree data), "Who has access" (members), "Profile requests" (claims). Apply across UI and docs. |  |
| UX-10 | Medium | Medium | Confirmed | 3 | Family settings | Rename the link to "Export & import" or create a small Settings section: name, export/import, then a separated "Danger zone". Rename needs an API change (out of scope). | Yes |
| UX-11 | Medium | Small | Confirmed | 1 | Workspace nav (`Overview · Family tree · People · Members · Settings`) | Open the target `<details>` on navigation (hashchange handler) or replace with tabs (UX-12). Confirm in a browser. |  |
| UX-14 | Medium | Small | Confirmed | 1 | Tree → click selected person again | Make deselect explicit (Close / Clear focus) and leave zoom and mode alone. |  |
| UX-15 | Medium | Small | Confirmed | 1 | Tree → Reset, Fit, view modes | Make Reset = Fit + clear focus + default mode. Preserve zoom across mode changes. |  |
| UX-16 | Medium | Small | Confirmed | 1 | Tree → zoom buttons | Use the same min (20) for buttons and Fit. |  |
| UX-17 | Medium | Medium | Risk | 4 | Tree → panning/zooming | Test first. If confirmed, add drag-pan and pinch/ctrl-wheel zoom with a visible "Fit" control. |  |
| UX-20 | Medium | Small | Confirmed | 3 | Tree → view modes | Show modes disabled with "Select a person first", rename to "Close family / Ancestors / Descendants". |  |
| UX-27 | Medium | Small | Confirmed | 1 | Add/Edit person → dates | Keep the values; relabel: "How well do you know the birth date?" – "I don't know / Exact date / Just the year / About this year / Between two years", with matching placeholders. |  |
| UX-29 | Medium | Small | Confirmed | 1 | Relationships form and list | Add a live sentence ("Anita will be recorded as the parent of Ravi") and swap-people control. |  |
| UX-30 | Medium | Medium | Confirmed | 2 | Profile and edit paths | One profile component, one Edit entry ("Edit profile" with tabs: Details · Photo), remove redundant "View". |  |
| UX-31 | Medium | Medium | Confirmed | 3 | Destructive confirmations | One reusable accessible confirm dialog; keep typed-name confirmation for delete family/person. |  |
| UX-38 | Medium | Small | Confirmed | 1 | Invite form (roles) | Short role cards/help text with concrete examples ("Editor: add and edit people, upload photos; cannot invite or delete"). |  |
| UX-39 | Medium | Medium | Confirmed | 2 | Invitation lifecycle | Add copy/resend, status chips (Pending/Expired/Accepted), rename button "Send invitation", plain failure copy. |  |
| UX-40 | Medium | Small | Risk | 2 | Accepting while signed in as the wrong account | Show "This invitation was sent to a***@gmail.com" and a switch-account action. Validate in testing. |  |
| UX-42 | Medium | Medium | Confirmed | 4 | Type scale | Set minimums (body 16, secondary 14, caption 12) and apply by token. |  |
| UX-43 | Medium | Large | Confirmed | 3 | Design system / theme | Decide the theme, delete dead blocks, move tokens into one file, then retire `!important` incrementally behind visual regression checks. Do not start before beta. |  |
| UX-45 | Medium | Small | Confirmed | 1 | Excel export/import | Update copy; show an import summary dialog (N people, N relationships, N marked deceased) before confirming; plain-language skip reasons. |  |
| UX-46 | Medium | Medium | Risk | 5 | Sample family → "make your own copy" | Test whether users want this at all; if so add a one-click "Copy to my family" (API work) or let them add people to a new empty family with guidance. | Yes |
| UX-09 | Low | Small | Confirmed | 2 | Workspace heading and switcher | Keep one heading; show the current family name in the header (sticky) with a switcher dropdown. |  |
| UX-21 | Low | Small | Confirmed | 3 | Tree search | Show birth year in results, show "+N more", unify search copy. |  |
| UX-22 | Low | Small | Confirmed | 1 | Tree empty state | Add an "Add the first person" button that jumps to the form. |  |
| UX-23 | Low | Small | Subjective | 3 | Avatars (tree and directory) | Test; consider initials for everyone with gender via subtle colour only. |  |
| UX-33 | Low | Small | Confirmed | 3 | Person actions menu | Add a tooltip/explanation ("Only owners and admins can delete"), separate destructive items visually. |  |
| UX-36 | Low | Small | Confirmed | 1 | Profile and directory wording | Share one date formatter and one vocabulary (Living/Deceased, Non-binary). |  |
| UX-44 | Low | Medium | Subjective | 3 | Labels and buttons | Reduce eyebrows to where they add meaning; define Primary / Secondary / Quiet / Danger button variants. |  |
| UX-47 | Low | Small | Confirmed | 3 | Account menu | Close on outside click/Escape. |  |

## Acceptance criteria for the Critical items

**UX-01** A signed-out visitor opening `/invite/<code>` can sign in with Google on that page and reach an accepted state without re-opening the link; refreshing mid-flow does not lose the code.

**UX-24** In Edit, entering `1940-1945` (and `1940 – 1945`) with "Estimated range" saves and re-opens with the same values; invalid input gives a message that names the problem. The Add form behaves the same.

**UX-34** For a person with a parent and a child, the profile shows them under distinct headings or distinct labels ("Parent" vs "Child"), for biological, adoptive and step relationships, spouse and sibling.