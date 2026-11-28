# Family Bridges Pilot — Raman ↔ Komal

**Status:** Design baseline for beta implementation  
**Target branch:** `preview` (feature branch: `feature/family-bridges-pilot`)  
**Pilot families:** Raman Family and Komal Family only  
**Feature name:** Connected Families / Family Bridges

## 1. Goal

Allow two independently managed family workspaces to traverse into one another through a marriage-based connection, without merging their trees or ownership.

The pilot is limited to the Raman and Komal family workspaces. The data model and authorization design should support later expansion to other families and relationship types, but no general family-network discovery is in scope.

## 2. Three separate concepts

A bridge records three distinct relationships. They must not be conflated:

1. **Marriage relationship:** the two people whose marriage connects the families (pilot example: Ravi and Pragati).
2. **Family-tree anchors:** the person in each family whose ancestral branch provides the route into the other tree (pilot example: Raman in Raman Family and Komal in Komal Family). These are independent person IDs, each constrained to its own family.
3. **Access relationship:** the bridge grants eligible members of each family read-only traversal into the other family.

The marriage pair and the ancestral anchor pair are separate fields. A person can be a bridge connector without being the ancestral anchor.

## 3. Initiation and approval

- A Family Owner may initiate a bridge from a family they own to another family only when the initiating Owner has **direct membership** in the other family.
- Eligible direct roles in the other family: Owner, Admin, Editor or Viewer.
- Inherited access through another bridge is not sufficient to initiate another bridge.
- The Owner of the destination family must approve the request.
- A bridge is not active until the destination Owner approves it.
- Approval is reciprocal: one active bridge enables traversal in both directions.
- A request must identify both family workspaces, both anchor people and both people in the marriage relationship.
- All referenced people must belong to the corresponding family. The marriage pair must be represented by a spouse relationship in the relevant family record(s), with validation rules documented during implementation.
- Duplicate active/pending bridge records for the same two family/anchor/marriage combination must be prevented. Different marriages/anchor pairs between the same two families are allowed.

## 4. Effective access

Direct membership and bridge-derived access are separate.

For a user viewing a destination family:
- If the user has direct membership, their direct role is retained.
- If the user has no direct membership but belongs to the opposite family and an active bridge exists, they receive inherited Viewer access.
- If multiple active bridges provide inherited access, the effective inherited role remains Viewer.
- Inherited access never upgrades a direct role and never grants Editor, Admin or Owner.
- Removing the user's membership from the source family immediately removes access inherited through that family.
- Revoking one bridge removes only access derived from that bridge. Another active bridge may continue to provide Viewer access.
- Direct membership remains intact when a bridge is revoked.

**Implementation guardrail:** Do not insert inherited users into `family_members`. Keep `roleFor()` as a direct-membership lookup for membership-specific and administrative routes. Add a separate effective read-access resolver returning role, provenance and bridge context.

## 5. Read scope for inherited Viewer

Inherited Viewer access permits:
- Open the connected family workspace.
- View its family tree and relationships.
- View person profiles and biography/history fields.
- View person portrait images through existing authorized media flows.
- Navigate back to the originating family and see the bridge context.

Inherited Viewer access does not permit:
- Create, update or delete people or relationships.
- Upload, replace or delete photos.
- Import or export private family data.
- View or manage invitations.
- View the collaboration member roster or manage roles.
- Manage family settings, ownership or deletion.
- Approve identity claims or manage identity links.
- Create, approve or revoke family bridges unless separately authorized as the relevant family Owner.

Existing direct Viewer permissions remain governed by current product behavior. Bridge-derived Viewer is explicitly read-only and must not broaden access to collaboration or administrative metadata.

## 6. Lifecycle

States: `pending`, `active`, `revoked`, and optionally `rejected`.

- Request creation records initiator, creation time and destination Owner.
- Approval records approving Owner and approval time.
- Rejection records rejecting Owner and decision time/reason.
- Revocation records actor, time and reason.
- When the marriage tie represented by the bridge is ended, an authorized family Owner must end/revoke the corresponding bridge. This revokes access derived from that bridge but preserves the marriage/relationship history and the bridge audit record.
- Ending one bridge must not affect another bridge between the same families.
- Family deletion must not leave an active bridge pointing to a missing family or person; foreign keys/cascade policy and explicit audit behavior must be verified.

## 7. Data model direction

Add a first-class `family_bridges` table, not a family foreign key on persons.

Proposed fields:
- `id`
- `family_a_id`, `family_b_id` (canonical ordering to avoid mirrored duplicates)
- `anchor_a_person_id`, `anchor_b_person_id`
- `connector_a_person_id`, `connector_b_person_id` (married people)
- `relationship_type` (pilot: `marriage`)
- `status` (`pending`, `active`, `rejected`, `revoked`)
- `initiated_by_user_id`, `initiating_family_id`
- `approved_by_user_id`, `approved_at`
- `revoked_by_user_id`, `revoked_at`, `revocation_reason`
- `created_at`, `updated_at`

Add a bridge audit/event table only if existing `audit_logs` cannot cleanly represent events for both family scopes. Each bridge event must be auditable from both affected family contexts without leaking private information to unauthorized users.

Foreign keys and validation must guarantee each anchor and connector person belongs to its stated family. Because ordinary SQLite foreign keys cannot express cross-row family equality, enforce this in API transactions and add integrity tests.

## 8. API direction

Expected endpoints (final naming to follow existing route conventions):
- List bridges visible/manageable from a family.
- Create a pending bridge (initiating family Owner; direct membership in other family required).
- Approve or reject a pending bridge (destination family Owner only).
- Revoke an active bridge (authorized Owner on either connected family; require confirmation/reason).
- Read-only access resolver used by all family tree/profile read endpoints.
- A family listing response that distinguishes direct memberships from connected-family access and reports `accessSource`, `effectiveRole` and bridge IDs.

Never rely on frontend visibility for authorization. Every read and write endpoint must enforce the correct direct/effective access class.

## 9. UI direction

- On the relevant anchor person's profile, show a compact connected-family bubble (for example, “Komal Family ↗” on Raman's profile).
- Show the marriage connector people and the anchor person clearly in the bridge details.
- Clicking the bubble opens the connected family in read-only mode, with an obvious “Connected via Raman ↔ Komal” context and a return-to-origin action.
- The connected family appears separately from direct memberships in the family switcher; do not label it as a direct membership.
- Show pending approval state and bridge management controls only to authorized Owners.
- No automatic scrolling or forced centering on person selection.

## 10. Pilot acceptance and security tests

1. Raman Owner with direct Viewer access to Komal can initiate a bridge.
2. Raman Owner without direct Komal membership cannot initiate one, even if they can view Komal through another bridge.
3. Komal Owner can approve/reject; a non-Owner cannot.
4. On approval, Raman members without direct Komal membership get read-only Viewer access to Komal, and Komal members without direct Raman membership get read-only Viewer access to Raman.
5. Users with direct destination memberships retain their direct roles.
6. Inherited Viewer cannot write, invite, manage roles, import/export, view member roster, manage settings, or approve identity claims.
7. Removing a source-family membership removes that user's inherited access.
8. Revoking one bridge removes only access from that bridge; a second active bridge continues to provide access.
9. Revoking a bridge does not remove direct memberships or erase marriage/ancestral records.
10. Deleting a family cannot leave orphaned active bridges.
11. Anchor and connector person IDs are validated against the correct family.
12. Existing direct-member authorization and all current API behavior remain unchanged.

## 11. Delivery sequence

1. Finalize and review this design against all read/write API routes.
2. Add migration and backend access-resolution unit tests.
3. Implement bridge lifecycle API and audit events.
4. Apply migration only to the isolated development D1 database.
5. Implement frontend bridge management, anchor bubbles and connected-family navigation.
6. Run CI and negative authorization tests; verify manually with Raman/Komal pilot accounts on development.
7. Only after explicit beta approval, plan a guarded production migration and deployment. Do not deploy this feature to production as part of the pilot implementation PR.
