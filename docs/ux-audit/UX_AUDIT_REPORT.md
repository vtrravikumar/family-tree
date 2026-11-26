# Vansvriksh – UX Audit Report

Date: 26 November 2026 · Scope: repository `vtrravikumar/family-tree` (commit `9037477`, branch as cloned) and the public production shell at https://vansvriksh.vtrrk.in

## 1. Read this first: what this audit is and is not

**This is a source-code and documentation audit. I did not run the application and I did not observe a real user.**

- The sandbox has no browser, and production sits behind Google sign-in with no credentials available to me. The only live check was fetching the public page, which returned the app shell (title, `color-scheme: dark`, theme colour) and nothing rendered.
- There are **no screenshots**. Evidence is `file:line` references into the cloned repository (line numbers refer to that commit; `App.tsx` and the main CSS use very long lines, so the token in brackets is the reliable anchor).
- Every "Confirmed" finding is a behaviour verified by reading the code (and in two cases by running the relevant snippet in Node: the range regex in UX-24, and contrast ratios in UX-18). "Confirmed" therefore means *the code does this and it fails a standard usability or accessibility heuristic*, not *users were observed struggling*. Nothing here has been validated with users.
- Findings that depend on rendering, device behaviour or human comprehension are marked **Risk** and listed again in section 7 as needing user testing. Personal design opinions are marked **Subjective**.
- No code, schema, API or data was changed. The recommendations that would need API work say so.

## 2. Summary

Vansvriksh has a thoughtful product core: the date-precision model, the deceased/memorial treatment, role-aware controls, portrait cropping and a clear privacy stance are all above what most early products ship. The weaknesses are in *wayfinding and feedback*: one long page whose sections are hidden or out of order, feedback that appears away from the action, relationship wording that cannot tell parent from child, and a first-contact invitation flow that dead-ends.

Total findings: **47** (Critical 3 · High 13 · Medium 23 · Low 8). Kinds: Confirmed 40 · Risk 5 · Subjective 2.

**Three Critical items, all small-to-medium fixes:** the invitation page dead end (UX-01), the broken estimated-range edit (UX-24) and the profile relationship list that labels parents and children identically (UX-34).

## 3. Methodology

Reviewed: `apps/web/src/{App,FamilyTree,FamilyMembers,PersonPhotoManager,PlatformAdmin,VersionHistory}.tsx`, `styles.css`, `design-system.css` (2,728 lines), `index.html`, the API routes that affect UI behaviour (`workers/api/src/index.ts`: sample access, identity unlink, role/rename routes), and `docs/` (design system, UAT guide, roadmap, readiness). Journeys A–G were traced through the component code for each role (owner, admin, editor, viewer, sample viewer, signed-out invitee). Contrast ratios were computed from literal colours in source against an approximated composite of the tree backdrop.

Not reviewed at runtime: layout, wrapping, overflow, animation, real touch behaviour, screen-reader output, email content, the Google sign-in popup, and anything dependent on production data.

## 4. Journey assessments

- **A. First-time user experience** — Judgement score 52/100. Welcome screen is clear; post-sign-in and invitation paths are weak.
- **B. Family creation and management** — Judgement score 55/100. Works, but vocabulary, switching and settings need clarity.
- **C. Family-tree exploration** — Judgement score 58/100. Rich tree with real thought; interaction predictability and legibility need work.
- **D. Adding and editing family members** — Judgement score 55/100. Capable forms; feedback, pickers, a broken range edit and duplicated paths hold it back.
- **E. Profile experience** — Judgement score 60/100. Good content; relationship labels and claim flow undermine it.
- **F. Invitations and collaboration** — Judgement score 55/100. Safe model; roles and lifecycle are under-explained.
- **G. Mobile experience** — Not scored. Cannot be scored from code; test on devices.

## 5. Findings by journey

Each finding lists: ID · screen · current behaviour · why it is a problem · user impact · recommendation · priority · complexity · kind · evidence. Priority: Critical = blocks a core journey or misleads users about their data; High = frequent or severe confusion/accessibility failure; Medium = noticeable friction; Low = polish. Complexity: Small ≈ ≤1 day, Medium ≈ 2–5 days, Large ≈ >1 week, including testing.

### A. First-time user experience

#### UX-01 — Invitation landing (`/invite/:code`)
- **Current behaviour:** A signed-out invitee sees "Sign in with the Google account that received this invitation, then reopen this link to accept it" and a link to `/`. The landing page has no sign-in button, and the invite code is not remembered after sign-in at `/`.
- **Why it is a UX problem:** The most important first-contact flow for a relative asks them to leave, sign in elsewhere, find the original message and click again. Non-technical and older users will stall or give up.
- **User impact:** Blocks the invited-relative journey that the beta depends on.
- **Recommendation:** Render the Google button on the landing page itself and accept (or offer a single "Accept" step) straight after sign-in. As a fallback, keep the code in `sessionStorage` and resume after sign-in at `/`.
- **Priority / complexity / kind:** Critical / Medium / Confirmed
- **Evidence:** `FamilyMembers.tsx:L27` (Sign in with the Google account that received)

#### UX-02 — Invitation landing
- **Current behaviour:** Heading is generic ("You're invited to join a family"). It never shows the family name, who invited you, or the role you will receive.
- **Why it is a UX problem:** People are cautious about accepting access to personal data from an unnamed sender; trust cues are missing.
- **User impact:** Lower acceptance and more "is this phishing?" support questions.
- **Recommendation:** Show "Anita invited you to join the Sharma family as an Editor (can add and edit people)". Needs a read-only invitation-preview response from the API; coordinate separately (this audit changes no API).
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `FamilyMembers.tsx:L27` (You're invited to)

#### UX-03 — Workspace home after sign-in
- **Current behaviour:** `familyId` starts empty and is only set by clicking a family in the "Your family connections" strip or by creating one. A user with exactly one family still lands on "Your families / Your family story starts here — Create a family workspace or choose one to begin."
- **Why it is a UX problem:** The first screen after sign-in tells the user to do something the app could do for them, and the empty state contradicts the fact that they already belong to a family.
- **User impact:** Every new beta user pays an extra step and some will read it as "nothing is here".
- **Recommendation:** Auto-select the only family (or the last used family). Keep the empty state only for users with zero families.
- **Priority / complexity / kind:** High / Small / Confirmed
- **Evidence:** `App.tsx:L91` ([familyId,setFamilyId]); `App.tsx:L136` (Your family story starts here)

#### UX-04 — Whole app (state and URLs)
- **Current behaviour:** The selected family, selected person and tree mode live only in React state. Navigation is by `#anchors`; there are no URLs for a family or a person. A refresh returns to the "choose a family" state.
- **Why it is a UX problem:** Browser refresh/back, bookmarks and sharing "look at Grandpa's profile" all fail. Accidental refresh on mobile loses place.
- **User impact:** Medium frustration, higher for people who navigate with the back button.
- **Recommendation:** Persist last family (localStorage) now; consider `/f/:familyId` and `?person=` routes later.
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `App.tsx:L91` ([familyId,setFamilyId]); `App.tsx:L127` (window.location.pathname === "/admin")

#### UX-05 — Branding (title, header, footer, invite, WhatsApp text)
- **Current behaviour:** UI, page title and footer say "Vansvriksha"; the domain, repository, docs and the WhatsApp invite text say "Vansvriksh".
- **Why it is a UX problem:** Two spellings of the product name in the same flow undermine trust in a product that holds family data. (README notes the name is provisional.)
- **User impact:** Invitees may not recognise the message they received.
- **Recommendation:** Pick one spelling and use it in UI, emails, WhatsApp text and metadata.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L131` (Vansvriksha</a>); `FamilyMembers.tsx:L20` (on Vansvriksh:); `index.html:L12` (<title>)

#### UX-06 — Sign-in panel
- **Current behaviour:** Google is the only sign-in method and the panel says only "Use your Google account to securely access your private family workspaces."
- **Why it is a UX problem:** Relatives without a Google account (or who do not know which Google account they use) have no alternative or explanation.
- **User impact:** Unknown; could exclude some older relatives.
- **Recommendation:** Do not add auth methods yet. Add one line explaining why Google, what is shared (name/email/photo) and what is not, and test with 3–5 older relatives.
- **Priority / complexity / kind:** Medium / Small / Risk
- **Evidence:** `App.tsx:L133` (Use your Google account to securely access)

#### UX-07 — App-wide (account menu, footer)
- **Current behaviour:** The account menu offers only "Sign out" (plus Platform administration for super-admins). No Help, Send feedback, Privacy or Contact link exists in the app, although beta documents for these exist.
- **Why it is a UX problem:** Testers who get stuck have no in-app route to help; privacy reassurance is limited to a line on the sign-in page.
- **User impact:** Lower-quality beta feedback; lost testers.
- **Recommendation:** Add "Help & feedback" and "Privacy" entries to the account menu linking to the existing beta support/privacy pages.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L131` (Sign out</button>); `App.tsx:L133` (Private by default)

### B. Family creation and management

#### UX-08 — Family switcher, family circle, relationships, profile
- **Current behaviour:** "Connections" is used for: the family switcher ("YOUR FAMILY CONNECTIONS"), a person's relationships ("Family connections"), pending identity claims ("FAMILY CONNECTIONS") and the relationships section ("CONNECT THE GENERATIONS"). "Family circle" means members with access.
- **Why it is a UX problem:** One word with three meanings; a first-time user cannot tell "families I belong to", "people in the tree" and "accounts with access" apart.
- **User impact:** Misreading permissions (who can see my family) is a trust risk.
- **Recommendation:** Fix the vocabulary: "Your families" (switcher), "Relatives and relationships" (tree data), "Who has access" (members), "Profile requests" (claims). Apply across UI and docs.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L131` (YOUR FAMILY CONNECTIONS); `App.tsx:L134` (Family connections <span>); `FamilyMembers.tsx:L15` (YOUR FAMILY CIRCLE)

#### UX-09 — Workspace heading and switcher
- **Current behaviour:** The current family name appears as the page `h1` and again as the `h2` of the main panel; the switcher shows the role as raw text; the active family is indicated only by styling inside a strip that scrolls away.
- **Why it is a UX problem:** Duplicate headings add noise while there is no persistent "you are in: <family>" cue once the user scrolls down a long page.
- **User impact:** Users with several families may edit the wrong one.
- **Recommendation:** Keep one heading; show the current family name in the header (sticky) with a switcher dropdown.
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `App.tsx:L134` (<h1>{selected?.name); `App.tsx:L137` (<h2>{selected.name}</h2>)

#### UX-10 — Family settings
- **Current behaviour:** The "Settings" nav link scrolls to a row of buttons (Export Excel, Import Excel, Delete family, PRIVATE tag). There is no family rename or settings screen, and I found no rename endpoint in the API.
- **Why it is a UX problem:** "Settings" promises a place that does not exist; the destructive Delete family sits beside routine export/import.
- **User impact:** Users cannot fix a typo in a family name; accidental clicks are possible (typed confirmation mitigates).
- **Recommendation:** Rename the link to "Export & import" or create a small Settings section: name, export/import, then a separated "Danger zone". Rename needs an API change (out of scope).
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `App.tsx:L137` (id="settings"); `App.tsx:L137` (Delete family</button>)

#### UX-11 — Workspace nav (`Overview · Family tree · People · Members · Settings`)
- **Current behaviour:** Links are plain `#anchors`. `#people` and `#members` are on collapsed `<details>` elements, so the link scrolls to a closed heading and does not open it. Viewers see only Overview and Family tree.
- **Why it is a UX problem:** A nav item that lands on a collapsed section looks like it did nothing.
- **User impact:** Editors and admins cannot reach People/Members reliably in one click.
- **Recommendation:** Open the target `<details>` on navigation (hashchange handler) or replace with tabs (UX-12). Confirm in a browser.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L131` (<nav className="workspace-nav"); `App.tsx:L145` (id="people"); `FamilyMembers.tsx:L15` (<details className="family-members-panel)

#### UX-12 — Workspace page structure
- **Current behaviour:** One long scroll: family circle (collapsed) → pending claims → tree (≈70–80vh) → profile → summary → "Create a family workspace" strip → Add a person form → People directory (collapsed) → Relationships (collapsed). For viewers, "Create a family workspace" is the very first element above the read-only family.
- **Why it is a UX problem:** An editor must scroll past a tall tree to add anyone; the order of sections differs by role; the primary action for a viewer (explore) is displaced by an unrelated one (create a family).
- **User impact:** High cognitive load and scrolling; discoverability of the two collapsed management sections is low.
- **Recommendation:** Use top-level sections or tabs (Tree · People · Family circle · Settings), always show "Add person" in People, move "Create a family" to the family switcher menu. Do this once, deliberately, not piecemeal.
- **Priority / complexity / kind:** High / Large / Confirmed
- **Evidence:** `App.tsx:L134` (viewerMode?<>{createFamilyWorkspace}); `App.tsx:L138` (GROW YOUR TREE); `App.tsx:L145` (people-directory-disclosure)

### C. Family-tree exploration

#### UX-13 — Tree → select a person
- **Current behaviour:** Selecting a node smooth-scrolls the tree viewport to centre the person and opens the profile as a panel rendered below the tree. Nothing scrolls the panel into view, moves focus or announces it (no `scrollIntoView`/`focus()` anywhere in the app).
- **Why it is a UX problem:** The user clicks, sees the tree shift, and the result of the click is below the fold. This is exactly the "selecting a person causes unexpected movement" concern in the brief.
- **User impact:** On phones the profile is several screens away; users will think the click failed or lose their place.
- **Recommendation:** Show the profile in a side panel (desktop) or bottom sheet (mobile) that does not move the tree, or scroll/focus it into view. Do not auto-centre when the node is already visible.
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `FamilyTree.tsx:L237` (const choosePerson); `FamilyTree.tsx:L206` (viewport.scrollTo({left:Math.max); `App.tsx:L134` (id="tree-person-profile")

#### UX-14 — Tree → click selected person again
- **Current behaviour:** Clicking the already-selected node deselects it and also resets view mode, search text and zoom to 100%.
- **Why it is a UX problem:** A repeated click is a common accident; the reset is large, silent and has no affordance.
- **User impact:** Lost position and context.
- **Recommendation:** Make deselect explicit (Close / Clear focus) and leave zoom and mode alone.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L237` (if(selected===id){setSelected(null))

#### UX-15 — Tree → Reset, Fit, view modes
- **Current behaviour:** "Reset view" sets zoom to 100% and clears focus, but the initial view is Fit. Switching view mode also resets zoom to 100%. There is no way to return to the opening position in one step.
- **Why it is a UX problem:** "Reset" does not reset to what the user first saw; every mode switch changes scale.
- **User impact:** Users cannot return to a familiar position (brief, section C).
- **Recommendation:** Make Reset = Fit + clear focus + default mode. Preserve zoom across mode changes.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L241` (Reset view); `FamilyTree.tsx:L208` (const fitTree); `FamilyTree.tsx:L243` (setMode(v);setZoom(100))

#### UX-16 — Tree → zoom buttons
- **Current behaviour:** Fit may set zoom anywhere from 20% to 150%, but "−" clamps at 60 (`Math.max(60,v-10)`). From a fitted 35%, pressing "−" jumps to 60% (zooms in).
- **Why it is a UX problem:** The "zoom out" button zooms in.
- **User impact:** Direct contradiction on large trees, the case where users need it most.
- **Recommendation:** Use the same min (20) for buttons and Fit.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L241` (Math.max(60,v-10)); `FamilyTree.tsx:L215` (Math.max(20,Math.min(150)

#### UX-17 — Tree → panning/zooming
- **Current behaviour:** Navigation relies on native scrolling inside a bordered region and +/− buttons. There is no drag-to-pan, mouse-wheel/trackpad zoom or pinch zoom.
- **Why it is a UX problem:** Most people expect map-like gestures from a "tree explorer". Native scroll inside a page that also scrolls is a known trap on touch devices.
- **User impact:** Unknown until tested; likely the largest friction on mobile.
- **Recommendation:** Test first. If confirmed, add drag-pan and pinch/ctrl-wheel zoom with a visible "Fit" control.
- **Priority / complexity / kind:** Medium / Medium / Risk
- **Evidence:** `FamilyTree.tsx:L248` (className="tree-viewport"); `FamilyTree.tsx:L241` (aria-label="Zoom in")

#### UX-18 — Tree node text and contrast
- **Current behaviour:** Name text is 12px, dates 10px in SVG user units, scaled by zoom (down to 20%). Date text `#7c8069` on the dark canvas is about 4.45:1 (just under AA), and neutral-avatar initials `#e4d5ad` on `#68704e` are about 3.6:1.
- **Why it is a UX problem:** Small, low-contrast text is the first thing older users hit. Contrast numbers computed from the colours in source against an approximated backdrop.
- **User impact:** Names/dates unreadable at fitted zoom on large trees and on phones.
- **Recommendation:** Raise date text to ≥12 and AA contrast; set a minimum readable scale (e.g. do not Fit below ~50%; scroll instead); lighten neutral initial colour.
- **Priority / complexity / kind:** High / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L266` (fontSize="10"); `FamilyTree.tsx:L265` (fontSize="12" fontWeight="650"); `design-system.css:L1078` (.atlas-tree .tree-help)

#### UX-19 — Tree → keyboard and assistive tech
- **Current behaviour:** Nodes are `tabIndex=0` with `role="button"`, but the only focus style targets `rect` (`g[role=button]:focus rect`) while nodes are drawn with circles, and `outline:none` is set, so a focused node has no visible focus indicator. Every node is a tab stop (no roving focus or arrow keys). The `<svg>` has `role="img"`, which can hide the buttons inside it from screen readers.
- **Why it is a UX problem:** Keyboard users cannot see where they are; large trees mean dozens of tab stops.
- **User impact:** Excludes keyboard-only and some screen-reader users; fails WCAG 2.4.7.
- **Recommendation:** Add a visible focus ring on the node circle; roving tabindex with arrow keys; drop `role="img"` on the svg (use `role="group"`); offer a list view of the same tree.
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `design-system.css:L440` (g[role="button"]:focus rect); `FamilyTree.tsx:L252` (tabIndex={0} role="button"); `FamilyTree.tsx:L248` (role="img" aria-label="Interactive family t…)

#### UX-20 — Tree → view modes
- **Current behaviour:** Focus, Ancestors and Descendants buttons appear only after a person is selected and use unexplained words ("Focus"). Nothing tells a new user they exist.
- **Why it is a UX problem:** Powerful features are hidden until an action the user may not take.
- **User impact:** Low adoption of the best exploration tools.
- **Recommendation:** Show modes disabled with "Select a person first", rename to "Close family / Ancestors / Descendants".
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L243` (className="tree-modes")

#### UX-21 — Tree search
- **Current behaviour:** Dropdown shows at most 6 matches with no "more" hint and names only (no dates). A separate, differently labelled search exists in the People directory.
- **Why it is a UX problem:** Common names are indistinguishable; two search boxes teach two behaviours.
- **User impact:** Wrong person chosen; extra effort.
- **Recommendation:** Show birth year in results, show "+N more", unify search copy.
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L36` (.slice(0,6)); `App.tsx:L145` (Find someone in your family)

#### UX-22 — Tree empty state
- **Current behaviour:** "Add family members and connect their parent-child relationships…" with no button.
- **Why it is a UX problem:** Instruction without a path.
- **User impact:** Dead end for a new editor.
- **Recommendation:** Add an "Add the first person" button that jumps to the form.
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `FamilyTree.tsx:L238` (className="tree-empty")

#### UX-23 — Avatars (tree and directory)
- **Current behaviour:** People without photos show ♀ or ♂ instead of initials; other genders show an initial.
- **Why it is a UX problem:** Symbols convey gender, not identity, and mix with initials. Preference, not a proven problem.
- **User impact:** Possibly alienating; not tested.
- **Recommendation:** Test; consider initials for everyone with gender via subtle colour only.
- **Priority / complexity / kind:** Low / Small / Subjective
- **Evidence:** `FamilyTree.tsx:L257` (node.person.gender==="female"?"♀")

### D. Adding and editing family members

#### UX-24 — Edit person → "Estimated range" birth date
- **Current behaviour:** The validation regex in the edit form is written with doubled backslashes (`\\d`, `\\s`) so it can only match a literal backslash. Entering `1940-1945` always fails with "Enter the estimated birth-year range as YYYY-YYYY". (Static analysis; I could not exercise the running app.)
- **Why it is a UX problem:** A documented feature cannot be saved through editing; the error message tells the user to enter what they entered.
- **User impact:** Anyone editing a person with an estimated range, or switching to range, is blocked.
- **Recommendation:** Fix the regex (`\d`, `\s`), and accept en dash/space variants in both add and edit forms (add form uses `split("-")` and would send NaN for an en dash).
- **Priority / complexity / kind:** Critical / Small / Confirmed
- **Evidence:** `App.tsx:L150` (const match=editDateValue); `App.tsx:L139` (const v=dateValue.split("-"))

#### UX-25 — Add person with a link
- **Current behaviour:** The person is created first, then one or more relationship calls follow (sibling links issue N sequential calls). If a later call fails, the form is not cleared and shows an error, but the person already exists, so clicking Add again creates a duplicate.
- **Why it is a UX problem:** Partial success is presented as total failure; retry makes it worse.
- **User impact:** Duplicate people and missing links in beta data.
- **Recommendation:** Client-side: after person creation, show "Anita was added but the link failed — retry link" and never resubmit the create. Longer term a single server-side operation (API change, out of scope).
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `App.tsx:L139` (const siblingIds); `App.tsx:L139` (setGiven("");setMiddle(""))

#### UX-26 — Page-level messages
- **Current behaviour:** Success/error banners render once, after the summary section and before the Create-family strip and Add-person form. The Add form is below that, so "Person added." or a server error can appear above the viewport. Only two elements have `role="alert"` and one `aria-live`; the page-level messages are not announced.
- **Why it is a UX problem:** Feedback is separated from the action that caused it; users repeat actions or assume failure.
- **User impact:** Violates "helpful feedback after every important action" for the most common flows.
- **Recommendation:** Render feedback beside the action (inline) and as a toast with `role="status"`/`alert`; scroll/focus errors into view.
- **Priority / complexity / kind:** High / Small / Confirmed
- **Evidence:** `App.tsx:L133` (message error); `App.tsx:L133` (role="alert")

#### UX-27 — Add/Edit person → dates
- **Current behaviour:** Labelled "Birth date precision" with options Unknown / Exact date / Year only / Approximate year / Estimated range; the value box uses placeholder `YYYY` for every type, including ranges.
- **Why it is a UX problem:** "Precision" is technical; the placeholder contradicts the label for ranges. The underlying model is good (it honours the no-fabricated-dates rule).
- **User impact:** Hesitation and wrong input from non-technical users.
- **Recommendation:** Keep the values; relabel: "How well do you know the birth date?" – "I don't know / Exact date / Just the year / About this year / Between two years", with matching placeholders.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L141` (Birth date precision); `App.tsx:L141` (placeholder="YYYY")

#### UX-28 — Person pickers (add link, relationships, edit relationship)
- **Current behaviour:** Every picker is a plain `<select>` listing all `display_name`s with no search, birth year or photo.
- **Why it is a UX problem:** Does not scale beyond ~30 people, and two relatives with the same name are indistinguishable.
- **User impact:** Wrong relationships on common names (very common in Indian family trees).
- **Recommendation:** Use a searchable combobox showing name + birth year (+ parent name when ambiguous).
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `App.tsx:L142` (Add without a connection for now); `App.tsx:L177` (Select person)

#### UX-29 — Relationships form and list
- **Current behaviour:** Users choose "Parent → Relationship → Child" as raw direction; labels switch between "Parent/Child" and "Person/Related person" depending on the type. No sentence preview confirms the result.
- **Why it is a UX problem:** Direction errors are easy and silent; "Spouse of" etc. are ordered arbitrarily.
- **User impact:** Incorrect trees that look plausible.
- **Recommendation:** Add a live sentence ("Anita will be recorded as the parent of Ravi") and swap-people control.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L178` (Relationship</label>); `App.tsx:L177` (relType.includes("parent"))

#### UX-30 — Profile and edit paths
- **Current behaviour:** Two near-identical profile panels exist (tree-selected and directory-selected). Edit is reachable via tree profile, directory profile, and the ••• menu; "View" in the menu duplicates clicking the name. Portrait editing is not in the Edit dialog, which tells users to "close this form and open their profile" to change it. Biography exists in Edit but not in Add.
- **Why it is a UX problem:** Unnecessary duplication (brief, section D); inconsistent capabilities between entry points.
- **User impact:** Users cannot form a mental model of where to edit what.
- **Recommendation:** One profile component, one Edit entry ("Edit profile" with tabs: Details · Photo), remove redundant "View".
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `App.tsx:L134` (id="tree-person-profile"); `App.tsx:L145` (className="person-actions-menu"); `App.tsx:L160` (To manage this person’s portrait)

#### UX-31 — Destructive confirmations
- **Current behaviour:** Eight native `window.confirm`/`window.prompt` calls (delete family, delete person, delete relationship, restore to living, import, revoke invitation, remove member, remove portrait) alongside custom modals for edit and deceased.
- **Why it is a UX problem:** Unstyled, inconsistent and awkward on mobile; the protective typed-name step is good but the container is not.
- **User impact:** Mixed patterns lower trust and are hard to use on phones.
- **Recommendation:** One reusable accessible confirm dialog; keep typed-name confirmation for delete family/person.
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `App.tsx:L137` (window.prompt); `FamilyMembers.tsx:L12` (window.confirm)

#### UX-32 — Edit, relationship-edit and deceased dialogs
- **Current behaviour:** The modals are plain `div.modal-backdrop` with no `role="dialog"`, `aria-modal`, accessible name, Escape-to-close, focus trap or focus return. (Only Platform Admin dialogs set `role="dialog"`.) The Edit dialog also shows the page error inside the dialog while the page-level banner shows it again.
- **Why it is a UX problem:** Screen-reader and keyboard users can fall behind the dialog; duplicated errors confuse.
- **User impact:** Accessibility failure on the main edit flow.
- **Recommendation:** Shared `<Dialog>` with labelling, Esc, focus management; show errors once, inside the dialog.
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `App.tsx:L146` (className="modal-backdrop"); `PlatformAdmin.tsx:L26` (role="dialog")

#### UX-33 — Person actions menu
- **Current behaviour:** "Mark deceased" and "Delete person" sit together in the ••• menu. For editors, Delete is disabled with no explanation.
- **Why it is a UX problem:** A disabled control with no reason invites "is it broken?"; irreversible actions are adjacent.
- **User impact:** Confusion for editors; low accident risk thanks to confirmations.
- **Recommendation:** Add a tooltip/explanation ("Only owners and admins can delete"), separate destructive items visually.
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `App.tsx:L145` (Mark deceased); `App.tsx:L145` (Delete person)

### E. Profile experience

#### UX-34 — Profile → "Family connections" list
- **Current behaviour:** Each row shows the other person's name and the label for the stored type ("Parent of"), regardless of direction. Parents and children therefore both appear as "<name> · Parent of".
- **Why it is a UX problem:** Users cannot tell whether the listed person is the parent or the child, the core information of a family-tree profile.
- **User impact:** Misreading family relationships.
- **Recommendation:** Compute the label from the viewer's point of view ("Father/Mother/Parent", "Child", "Spouse", "Sibling"), grouped under Parents · Spouse · Siblings · Children.
- **Priority / complexity / kind:** Critical / Small / Confirmed
- **Evidence:** `App.tsx:L134` (profile-connections); `App.tsx:L44` (const labels:Record)

#### UX-35 — Claiming a profile ("Is this you?")
- **Current behaviour:** Viewers claim inside the profile ("Claim this profile"); owners/admins/editors get a separate card below the tree labelled "Claim as you" (owners link directly). Claim appears only after selecting a person in the tree (not from the directory profile). No UI exists to unlink although the API supports it. Nothing prompts a new member to find themselves.
- **Why it is a UX problem:** Same concept, three treatments; the account-versus-profile distinction is explained only in small print; claims are hard to discover.
- **User impact:** Few members will link accounts; mistaken links cannot be undone by owners without developer help.
- **Recommendation:** One "This is me" pattern in the profile for all roles, a first-run prompt ("Which person are you?"), and unlink/"not me" for owners/admins.
- **Priority / complexity / kind:** High / Medium / Confirmed
- **Evidence:** `App.tsx:L134` (Claim this profile); `App.tsx:L134` (Claim as you); `index.ts:L573` (identityUnlink=)

#### UX-36 — Profile and directory wording
- **Current behaviour:** Death shows raw ISO (`1999-03-04`) while birth is formatted ("4 Mar 1999"); directory pill says "alive" while the profile says "Living"; gender prints "non binary".
- **Why it is a UX problem:** Small inconsistencies read as unpolished in a trust-sensitive product.
- **User impact:** Cosmetic but visible.
- **Recommendation:** Share one date formatter and one vocabulary (Living/Deceased, Non-binary).
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `App.tsx:L134` (treeProfilePerson.death_exact_date); `App.tsx:L145` ({p.life_status}</span>)

### F. Invitations and collaboration

#### UX-37 — Family circle → role select and Remove
- **Current behaviour:** Changing a member's role applies immediately on selection, with no confirmation and no success message (`updateMember` sets no notice); Remove has a confirm but no success message.
- **Why it is a UX problem:** Permission changes are high-stakes and silent; a slip on a select promotes or demotes someone.
- **User impact:** Trust and access-control mistakes.
- **Recommendation:** Confirm role changes ("Make Meera an Editor?") and show a confirmation message.
- **Priority / complexity / kind:** High / Small / Confirmed
- **Evidence:** `FamilyMembers.tsx:L13` (async function updateMember); `FamilyMembers.tsx:L14` (async function removeMember)

#### UX-38 — Invite form (roles)
- **Current behaviour:** Roles are explained only in the select text "Viewer — can view / Editor — can contribute / Admin — can manage". Owner is not explained anywhere; nothing says who can see living people's details or photos.
- **Why it is a UX problem:** Role names are generic software terms; people guess.
- **User impact:** Over-granting access to private data.
- **Recommendation:** Short role cards/help text with concrete examples ("Editor: add and edit people, upload photos; cannot invite or delete").
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `FamilyMembers.tsx:L18` (Viewer — can view)

#### UX-39 — Invitation lifecycle
- **Current behaviour:** After creation, the link is shown once. The pending list shows email, role and expiry with only "Revoke" (no copy link, resend, or "invited by"). Expired/accepted/revoked states are not shown. The button says "Create invitation" while the email is sent automatically; failure copy is "email delivery is not configured or unavailable".
- **Why it is a UX problem:** Owners cannot tell what happened to an invitation or re-share a link; developer wording leaks into the UI.
- **User impact:** Support requests like "my cousin says the link doesn't work".
- **Recommendation:** Add copy/resend, status chips (Pending/Expired/Accepted), rename button "Send invitation", plain failure copy.
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `FamilyMembers.tsx:L19` (Pending invitations); `FamilyMembers.tsx:L11` (email delivery is not configured)

#### UX-40 — Accepting while signed in as the wrong account
- **Current behaviour:** Landing shows the signed-in email, but acceptance with a different Google account only yields the server error; there is no "use a different account" action.
- **Why it is a UX problem:** Common real-world case (several Google accounts on one phone).
- **User impact:** Failed acceptance with no recovery.
- **Recommendation:** Show "This invitation was sent to a***@gmail.com" and a switch-account action. Validate in testing.
- **Priority / complexity / kind:** Medium / Small / Risk
- **Evidence:** `FamilyMembers.tsx:L27` (Signed in as)

### G. Mobile experience

#### UX-41 — Mobile (whole app)
- **Current behaviour:** I could not run the app on a device. In code: breakpoints exist (600/760px etc.) and buttons get a 44px minimum below 767px, but the tree has no touch gestures (UX-17), the profile opens below the tree (UX-13), rows use a ••• menu, and the nav plus profile menu share the header.
- **Why it is a UX problem:** The brief asks whether the app is "genuinely usable" on mobile; static review cannot answer that.
- **User impact:** Potentially severe: most relatives will open WhatsApp links on phones.
- **Recommendation:** Run a 5-user phone test (invite → accept → explore tree → open profile → add a person) before beta.
- **Priority / complexity / kind:** High / Medium / Risk
- **Evidence:** `design-system.css:L184` (@media (max-width: 767px)); `FamilyTree.tsx:L248` (className="tree-viewport")

#### UX-42 — Type scale
- **Current behaviour:** About 128 font-size declarations are 12px or smaller (49×12px, 42×11px, 32×10px, plus 9px and 8px) including eyebrows, row metadata, tree labels and legend. DESIGN_SYSTEM.md itself says labels should be 12–13px and warns against tiny all-caps text.
- **Why it is a UX problem:** Small secondary text is hard for older readers and on phones; the product does not follow its own guidance.
- **User impact:** Reduced legibility for the stated audience.
- **Recommendation:** Set minimums (body 16, secondary 14, caption 12) and apply by token.
- **Priority / complexity / kind:** Medium / Medium / Confirmed
- **Evidence:** `design-system.css:L465` (font-size: 10px); `DESIGN_SYSTEM.md:L55` (avoid tiny all-caps)

_Mobile is also affected by UX-13, UX-17, UX-18, UX-19 and UX-42 above._

### Visual consistency and design system

#### UX-43 — Design system / theme
- **Current behaviour:** The shipped UI is a dark "Atlas" theme (`color-scheme: dark`, body `#070d18`); DESIGN_SYSTEM.md specifies a light warm-neutral palette. Five light-theme override blocks are disabled by `@media (prefers-color-scheme: light) and (max-width: 0px)` (never matches). Roughly 770 `!important` declarations across two stylesheets, layered by era (base → "UI-5" → atlas).
- **Why it is a UX problem:** The documented system and the product disagree; any change risks regressions through specificity wars; no light mode for bright-light/older users.
- **User impact:** Slows every UX fix; raises regression risk (brief §8).
- **Recommendation:** Decide the theme, delete dead blocks, move tokens into one file, then retire `!important` incrementally behind visual regression checks. Do not start before beta.
- **Priority / complexity / kind:** Medium / Large / Confirmed
- **Evidence:** `design-system.css:L1339` (@media (prefers-color-scheme: light) and (m…); `index.html:L6` (color-scheme)

#### UX-44 — Labels and buttons
- **Current behaviour:** Most sections carry a tiny uppercase "eyebrow" (GROW YOUR TREE, THE PEOPLE, FAMILY ARCHIVE…). Button treatments use many bespoke classes (`button-secondary`, `edit-person`, `relationship-delete`, `member-remove`, `profile-edit-action`, `identity-reject`, `tree-mode`…).
- **Why it is a UX problem:** Eyebrows add decoration rather than information; many one-off button classes make consistent states hard. Aesthetic judgement, not a proven problem.
- **User impact:** Visual noise; inconsistent states.
- **Recommendation:** Reduce eyebrows to where they add meaning; define Primary / Secondary / Quiet / Danger button variants.
- **Priority / complexity / kind:** Low / Medium / Subjective
- **Evidence:** `App.tsx:L125` (className="eyebrow"); `App.tsx:L137` (className="button-danger")

#### UX-45 — Excel export/import
- **Current behaviour:** The exported workbook's Instructions sheet still says it is "to review and correct the family data before we revise the visual layout" and that corrections will be used "to plan a safe correction/import", though import is live. The import confirm is a native dialog, the result message lists raw reason keys, and `confirmDeceasedRecords:true` is always sent without telling the user that deceased rows lock profiles.
- **Why it is a UX problem:** Stale developer wording; users are not warned of the one irreversible-looking effect of importing.
- **User impact:** Surprise locked profiles after import (owner/admin can restore, but they may not know).
- **Recommendation:** Update copy; show an import summary dialog (N people, N relationships, N marked deceased) before confirming; plain-language skip reasons.
- **Priority / complexity / kind:** Medium / Small / Confirmed
- **Evidence:** `App.tsx:L37` (before we revise the visual layout); `App.tsx:L137` (confirmDeceasedRecords:true); `App.tsx:L137` (Excel import complete)

#### UX-46 — Sample family → "make your own copy"
- **Current behaviour:** The shared sample is read-only; the way to get an editable copy is "Export its workbook and import it into a family you own".
- **Why it is a UX problem:** A multi-step file round trip for a first-time user who just wants to try editing.
- **User impact:** Many testers will not complete it.
- **Recommendation:** Test whether users want this at all; if so add a one-click "Copy to my family" (API work) or let them add people to a new empty family with guidance.
- **Priority / complexity / kind:** Medium / Medium / Risk
- **Evidence:** `App.tsx:L134` (Export sample workbook)

#### UX-47 — Account menu
- **Current behaviour:** The profile menu is a native `<details>` with no click-outside or Escape handling.
- **Why it is a UX problem:** Menus that stay open feel broken.
- **User impact:** Minor.
- **Recommendation:** Close on outside click/Escape.
- **Priority / complexity / kind:** Low / Small / Confirmed
- **Evidence:** `App.tsx:L131` (details className="profile-menu")

## 6. Visual consistency and design system

The repository has a written design system (`docs/DESIGN_SYSTEM.md`) with tokens, principles and a light palette, and `design-system.css` defines tokens in `:root`. In practice the live theme is dark and defined by later override layers, with many hard-coded colours (the tree SVG alone hard-codes about two dozen). Dates, labels, empty states and button treatments are individually reasonable but not systematically consistent (see UX-36, UX-43, UX-44). Recommended direction is in `UX_DESIGN_PRINCIPLES.md`; the sequencing risk is in UX-43: do not refactor the CSS before beta.

## 7. Needs real user testing (not more developer analysis)

1. Phone test of the full invitation path from a WhatsApp message (UX-01, 02, 40, 41).
2. Tree comprehension and navigation with a 40+ person family on phone and desktop, including drag/pinch expectations (UX-13, 17, 18).
3. Date-entry wording ("How well do you know the date?") with older users (UX-27).
4. Whether people understand "Claim this profile" and account-vs-person (UX-35).
5. Role vocabulary: can an owner predict what Editor vs Admin can do (UX-38).
6. Legibility of the dark theme at 10–12px for users over 55 (UX-18, 42, 43).
7. Whether collapsed People/Members/Relationships sections are found (UX-11, 12).
8. Google-only sign-in acceptability (UX-06).
9. Whether the sample family is understood and the export/import copy step is acceptable (UX-46).

## 8. Final assessment

**1. Overall UX maturity: 56/100.** Strong domain modelling and care in sensitive moments; held down by wayfinding, feedback, accessibility basics and an untested mobile story. This is a judgement, not a measurement.

**2. Confidence: low-to-moderate (about 40%).** High confidence in the code-verified defects (UX-24, 26, 32, 34, 37), low confidence in anything about mobile, rendering or comprehension.

**3. Top 10 to address before beta**
1. UX-01 Invitation page dead end
2. UX-24 Estimated-range edit always fails
3. UX-34 Profile relationship labels
4. UX-03 Auto-select the family after sign-in
5. UX-13 Profile opens off-screen after selecting a person
6. UX-26 Feedback near the action and announced
7. UX-25 Duplicate-on-retry when linking a new person
8. UX-37 Silent role changes
9. UX-35 Claim flow consistency and first-run prompt
10. UX-19 Visible keyboard focus on tree nodes (the Small part of that item)

Close behind: UX-28 (searchable person pickers), UX-32 (dialog semantics), UX-18 (tree text and contrast).

**4. Five improvements with the biggest perceived-quality gain**
1. A one-step invitation experience: sign in and accept on the landing page, with family, inviter and role shown.
2. Consistent feedback: inline messages and toasts beside the action, one accessible dialog replacing native prompts.
3. A stable tree: profile in a side panel/sheet, Reset = Fit, no surprise zoom resets.
4. Plain relationship language: directional labels in profiles, sentence previews and searchable pickers.
5. Plain date language and one vocabulary ("Living", "Relatives", "Who has access") throughout.

**5. Already well designed — do not disturb**
- Sign-in welcome copy and privacy line.
- Date-precision model and the "Insufficient dates" honesty in the family summary.
- Deceased/memorial treatment: † plus floral ring (not colour alone), clear read-only explanation, and an owner/admin restore path.
- Portrait flow: client-side crop, specific error messages, size guidance, clear replace/remove.
- Typed-name confirmation for deleting a family or person (change the container, keep the protection).
- Role-aware hiding of controls and the pending-claims review panel for owners/admins.
- WhatsApp share for invitations; note that the link only works for the invited Google account.
- Tree first-degree highlighting and Ancestors/Descendants views as capabilities.
- Directory empty-state wording ("Start with yourself, a parent, or an ancestor").
- Sample-family explanation card (the concept is good; see UX-46 for the mechanism).

**6. Needs user testing:** section 7.

**7. Recommended order:** Phase 1 quick wins → Phase 2 navigation/workflow → Phase 4 accessibility basics in parallel with Phase 2 → test on phones → Phase 3 visual consolidation → Phase 5. See `UX_IMPROVEMENT_ROADMAP.md`.