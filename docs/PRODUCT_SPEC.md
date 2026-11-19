# Product Specification

**Version:** 0.1  
**Status:** Initial baseline  
**Product name:** Undecided  
**Repository:** family-tree  
**Initial market:** India, with international-ready foundations

## 1. Vision

Build a modern, collaborative family heritage platform where individuals and families can create, maintain, explore and preserve family history.

Users can create family trees, join existing family workspaces, record people and relationships, collaborate with authorized relatives, and export attractive family-tree images.

## 2. Product principles

- Privacy first; family workspaces are private by default.
- Historical accuracy over fabricated information.
- Person profiles are separate from registered user accounts.
- Simple data entry for non-technical family members.
- Clear ownership, roles and server-enforced permissions.
- Preserve family history for future generations.

## 3. Accounts and workspaces

Google sign-in is the primary authentication method. The backend must validate Google ID tokens and establish a secure application session.

A user may create multiple family workspaces and join multiple others. Invitations may be sent by email or revocable invitation links/codes. Joining users should be able to link their account to an existing person profile rather than creating duplicates.

## 4. Person profiles

Profiles may contain full name, alternative names, birth/maiden surname, optional gender, photograph, life status, birth/death date information, places, biography, notes and historical sources.

Support Unicode names and Indian scripts including Tamil, Hindi, Telugu, Kannada and Malayalam.

### Life status and deceased-profile lock

Every person has an explicit `alive` or `deceased` status; new profiles default to `alive`.

Only an owner or authorized admin may perform the transition from alive to deceased, with explicit confirmation and an audit event. Once deceased, the person's profile becomes immutable through normal application operations. This restriction applies to owners, admins and editors alike.

The lock applies to profile fields; it must not prevent authorized users from adding descendants or other relationships involving that person. Any exceptional correction process, if introduced later, must be separately designed, audited and explicitly authorized. It must not be an ordinary edit path.

### Historical dates

Birth and death dates support:
- Exact date.
- Year only.
- Approximate year (for example, circa 1880).
- Estimated range (for example, 1880–1890).
- Unknown.

Store date precision/type separately from the date values. Preserve original wording when useful. Never invent a date to complete a profile.

### Historical evidence

Optional sources include family oral history, recollections, photographs, family documents, government records, temple records and other references. Distinguish documented facts from recollections and estimates.

## 5. Relationships

Store relationships independently from person profiles. Initial types include biological parent/child, spouse/partner, sibling, adoptive parent/child and step-parent/child.

Support multiple marriages, remarriage, half-siblings, adoption, step-family relationships, unknown parents and incomplete ancestry. Prevent circular parent-child relationships and contradictory records. Do not assume every person has exactly two known parents.

## 6. Visualization

Initial views:
- Traditional generation-based tree.
- Ancestor view.
- Descendant view.

Interactions:
- Zoom and pan.
- Search people.
- Open profiles.
- Expand/collapse branches.
- Add relationships.
- Fit tree to viewport.
- Highlight relationship path between two people.

Rearranging a visualization must not mutate the underlying family relationships.

Living and deceased people must be distinguishable with clear, accessible status labels. Unknown dates must be shown honestly or omitted.

## 7. Roles and collaboration

Roles:
- Owner: full workspace administration and ownership transfer/deletion.
- Admin: manage members, invitations and eligible family data.
- Editor: add and modify eligible people and relationships.
- Viewer: view permitted family information.

Deceased-profile immutability overrides every role. Enforce permissions on the server for every operation. Start with optimistic concurrency controls; add live collaboration later.

## 8. Sharing and export

PNG is the primary export format. Support full-tree and selected-branch export, high resolution, background/theme choices, and optional photos/dates/details. Layout must avoid overlapping cards and connectors and must be independent of the current viewport zoom.

Read-only sharing links must be opt-in, revocable and scoped. Private data must never become public merely because a URL is known.

## 9. Privacy and security

- Workspaces private by default.
- Server-side authorization on every operation.
- Secure sessions and authentication token validation.
- Restricted media access.
- Invitation expiry and revocation.
- Audit logging.
- Account and workspace deletion workflows.
- Backup and recovery plan.
- Special care for living relatives and minors.

## 10. Initial release acceptance criteria

A user can:
1. Sign in with Google.
2. Create a family workspace.
3. Add people and relationships.
4. Record living/deceased status.
5. Enter exact, approximate, range or unknown dates.
6. Invite relatives and assign roles.
7. Explore a family tree interactively.
8. Export the tree as a PNG.
9. Share a revocable read-only link.
10. Trust that deceased profiles cannot be edited through UI or API.

## 11. Future opportunities

Family timeline, stories and memories, audio recordings, family event calendar, family-history book generation, printable posters, duplicate detection, relationship explanations and multilingual UI. AI must never invent or silently alter historical facts.
