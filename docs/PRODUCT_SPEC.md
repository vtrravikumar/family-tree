# Product Specification

**Version:** 1.0 (focused production v1 scope)  
**Status:** Agreed scope; implementation and validation pending  
**Product name:** Vansvriksha  
**Repository:** family-tree  
**Initial market:** India, with international-ready foundations

## 1. Vision

Build a modern, collaborative family heritage platform where individuals and families can create, maintain, explore and preserve family history.

Users can create family trees, join existing family workspaces, record people and relationships, collaborate with authorized relatives, and preserve family history accurately.

## 2. Product principles

- Privacy first; family workspaces are private by default.
- Historical accuracy over fabricated information.
- Person profiles are separate from registered user accounts.
- Simple data entry for non-technical family members.
- Clear ownership, roles and server-enforced permissions.
- Preserve family history for future generations.
- A professional, intuitive and visually appealing experience is a v1 release requirement, not optional post-launch polish.

## 3. Accounts and workspaces

Google sign-in is the primary authentication method. The backend must validate Google ID tokens and establish a secure application session.

A user may create multiple family workspaces and join multiple others. Invitations may be sent by email or revocable invitation links/codes. Joining users should be able to associate their account with an existing person profile through the identity-claim workflow in section 8.

The platform has a Platform Super Admin role, distinct from family-level Owner, Admin, Editor and Viewer roles. Platform Super Admin privileges must be explicitly enforced server-side and audited.

### First-run sample family

Maintain one canonical, clearly labeled sample family made only from fictional data. Keep it compact: about eight people across four connected generations (grandparent, parent, self and child), with enough links to demonstrate biological-parent, adoptive-parent, step-parent, spouse, partner and sibling relationships. Use this same fixture in development and production.

Give every authenticated user Viewer access to the shared sample family; do not create a full duplicate for each user. Protect the canonical sample from ordinary edits, imports, membership changes and deletion, including actions by its designated platform owner. A user may remove or hide their own sample access without affecting anyone else. If they want an editable family, they can export the fictional sample workbook and import it into a family they own; that private copy can be changed or deleted normally. Do not overwrite or add sample records to existing private family workspaces.

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

## 6. Visualization and user experience

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

A professional redesign is mandatory for v1. Navigation, workspace overview, member cards, profiles, tree visualization, forms, dialogs, responsive layouts, empty/loading/error states and accessibility must be reviewed as one coherent product experience. Ease of use and visual appeal are core acceptance criteria.

## 7. Roles and collaboration

Family-level roles:
- **Owner:** full workspace administration, ownership transfer/deletion, and the ability to directly claim any person in that family.
- **Admin:** manage members, invitations and eligible family data; may approve or reject identity-claim requests.
- **Editor:** add and modify eligible people and relationships within the permissions enforced by the server; cannot import/export or approve identity claims.
- **Viewer:** view permitted family information; cannot modify data, import/export or approve identity claims.

**Platform Super Admin** is a platform-level role, not a family membership role. It has platform administration powers and is permitted to perform family data import/export operations.

All permissions must be enforced by the API for every operation. Hiding a control in the frontend is not authorization. Deceased-profile immutability overrides every role. Start with optimistic concurrency controls; add live collaboration later.

## 8. Account-to-person identity claims

A signed-in user may select an existing person record in a family and request to associate their Google account with that person.

- A claim request must identify the family, person and authenticated account.
- A pending request grants no additional access or editing permissions.
- The Family Owner and family Admin may approve or reject a pending claim.
- The Family Owner may directly claim any person in that family without an approval step.
- Editors and Viewers cannot approve claims.
- The system must enforce one account-to-person association per family and one account per person per family, except through an explicitly authorized reassignment process.
- Approval, rejection, direct claim, unlinking and reassignment must be recorded in the audit log.
- Claiming a person is an identity association only; it does not transfer family ownership or grant permissions beyond the user's existing family role.
- On approval or direct claim, the linked Google profile photo is displayed as an overlay/badge on the person's family-tree/profile image.
- The Google avatar must remain separate from the person's historical family portrait; it must never overwrite the family portrait.
- Unlinking or reassignment must be restricted to authorized roles, validated server-side and audited.

The account's Google profile image is sourced from the authenticated Google identity. If unavailable, the UI must gracefully show the normal default avatar.

## 9. Import and export permissions

Family data import and export are restricted administrative operations.

Permitted:
- Family Owner of that family.
- Family Admin of that family.
- Platform Super Admin.
- Any authenticated user may export the canonical fictional sample family; this is the only Viewer export exception.

Not permitted:
- Editor or Viewer export of private family data.
- Any import into the shared canonical sample family.
- A user who is not authorized for the target family, unless acting with an explicitly authorized Platform Super Admin capability.

These restrictions apply to every import/export API endpoint and workflow, including preview, validation, commit, download and any alternate route. Frontend control visibility is supplementary only. Attempts by unauthorized roles must be rejected server-side and covered by negative authorization tests.

Family data import/export is in v1 for administrative migration and data portability, subject to the permission rules above. Tree image/PDF/Excel presentation exports are not part of v1.

## 10. Sharing

Public/read-only sharing links are not required for the focused v1 release. Any future sharing must be opt-in, revocable and scoped. Private data must never become public merely because a URL is known.

## 11. Privacy and security

- Workspaces private by default.
- Server-side authorization on every operation.
- Secure sessions and authentication token validation.
- Restricted media access.
- Invitation expiry and revocation.
- Audit logging for administrative and identity-association actions.
- Account and workspace deletion workflows.
- Backup and recovery plan.
- Special care for living relatives and minors.
- Separate development and production environments and data stores.
- Production migration must preserve existing family data, relationships, memberships, roles and ownership; it must be backed up and validated before cutover.

## 12. Focused production v1 acceptance criteria

A v1 release is acceptable only when:
1. Users can sign in securely with Google.
2. Users can create and access family workspaces.
3. Users can add people and relationships with appropriate date precision and life status.
4. Deceased profiles cannot be edited through UI or API by any ordinary role.
5. Family invitations and Owner/Admin/Editor/Viewer permissions work correctly.
6. Family Owner and Admin can approve/reject identity claims; Owner can directly claim any person.
7. Pending identity claims grant no extra permissions.
8. Approved identity associations display the Google avatar separately from the historical portrait.
9. Only Family Owner, family Admin and Platform Super Admin can import/export family data; Editor and Viewer are denied server-side.
10. Cross-family isolation, role boundaries and identity-claim uniqueness are verified by tests.
11. The professional UI/UX redesign is complete and validated on desktop, tablet and mobile.
12. Existing family workspaces are backed up, migrated to production without data loss, and validated against source counts and relationships.
13. Production infrastructure, monitoring, backup/recovery and operational procedures are verified.
14. The three current test users can complete end-to-end acceptance testing with their intended roles.

Tree image/PDF/Excel export, public share links, photo upload, family timelines and stories, independently managed family branches and cross-family connections are not v1 release requirements.

## 13. Deferred beyond v1

- Tree image/PDF/Excel presentation exports.
- Public/read-only family sharing links.
- Photo upload and media management.
- Family timeline, stories, memories and event calendar.
- Independently managed family branches and cross-family connections, including consent-based links between separate family workspaces.
- Advanced real-time collaboration and notifications.
- AI-assisted historical research; AI must never invent or silently alter historical facts.
