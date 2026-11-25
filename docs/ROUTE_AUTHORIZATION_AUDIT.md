# Route-by-Route Authorization Audit

**Reviewed baseline:** `main` after PR #78 (2026-11-25).  
**Runtime scope:** `workers/api/src/index.ts`; unit tests in `workers/api/src/index.test.ts`; local-D1 integration tests in `workers/api/test/identity-claims.integration.test.ts`.  
**Purpose:** Record source/test evidence and remaining acceptance work. This document is not a production security certification.

## Audit method and evidence standard

For each route family, review authentication, role policy, family/resource scoping, platform Super Admin separation, state transitions, concurrency and audit behavior. A source-level conditional is not sufficient by itself for a complete pass: mutation behavior should be covered by regression tests, and environment-dependent behavior still requires acceptance against the intended beta environment.

## Current route inventory

| Route | Methods | Authorization and scope observed in current Worker |
|---|---|---|
| `/health` | GET | Public health response; reports environment and D1 connectivity, no family data |
| `/v1/auth/google` | POST | Public entry; verifies Google credential, rate limits sign-in, creates/loads account and session |
| `/v1/auth/me` | GET | Valid session required |
| `/v1/auth/logout` | POST | Revokes only the presented session, then clears its cookie |
| `/v1/onboarding/sample-access` | POST, DELETE | Authenticated caller; attaches/removes only caller's sample membership/dismissal |
| `/v1/platform/me` | GET | Authenticated; returns caller's platform-admin status |
| `/v1/platform/overview` | GET | Platform Super Admin only |
| `/v1/platform/users` | GET | Platform Super Admin only |
| `/v1/platform/families` | GET | Platform Super Admin only |
| `/v1/platform/audit-logs` | GET | Platform Super Admin only |
| `/v1/platform/families/:familyId/support-access` | POST | Platform Super Admin; reason required; family-scoped support read and platform audit |
| `/v1/platform/families/:familyId/export` | POST | Platform Super Admin; reason required; one-family export and platform audit |
| `/v1/families` | GET | Authenticated; returns only caller's family memberships |
| `/v1/families` | POST | Authenticated; creator becomes Owner |
| `/v1/families/:familyId` | DELETE | Current Owner; conditional Owner predicate in delete |
| `/v1/families/:familyId/members` | GET | Owner/Admin/Editor; Viewer denied |
| `/v1/families/:familyId/members/:userId` | PUT, DELETE | Owner/Admin; target and actor role restrictions rechecked in write |
| `/v1/families/:familyId/invitations` | GET | Owner/Admin |
| `/v1/families/:familyId/invitations` | POST | Owner/Admin; allowed invite role and current authority checked in insert; rate limited |
| `/v1/families/:familyId/invitations/:invitationId` | DELETE | Owner/Admin; conditional pending invitation revoke |
| `/v1/invitations/:code/accept` | POST | Signed-in Google account; email match, pending/unexpired transition and single-use behavior |
| `/v1/families/:familyId/identity` | GET | Family member; own identity/claim data, with pending requester details restricted to Owner/Admin |
| `/v1/families/:familyId/identity` | DELETE | Owner/Admin; current authority rechecked for unlink; dependent writes gated |
| `/v1/families/:familyId/identity-claims` | POST | Family member may request; direct claim requires Owner; family membership/person scope checked in write |
| `/v1/families/:familyId/identity-claims/:claimId/review` | POST | Owner/Admin; self-review denied; pending-state transition gates link/audit writes |
| `/v1/families/:familyId/people` | GET | Any family member; family-scoped |
| `/v1/families/:familyId/people` | POST | Owner/Admin/Editor; current membership and role checked in insert |
| `/v1/families/:familyId/import` | POST | Owner/Admin; platform Super Admin path is reason-gated and audited; staged import applied as one D1 batch |
| `/v1/families/:familyId/people/:personId` | PUT | Owner/Admin/Editor; living profile and current role checked in update |
| `/v1/families/:familyId/people/:personId` | DELETE | Owner/Admin; conditional role check and audit |
| `/v1/families/:familyId/people/:personId/restore` | POST | Owner/Admin; conditional role check and audit |
| `/v1/families/:familyId/people/:personId/deceased` | POST | Owner/Admin; conditional role check and audit |
| `/v1/families/:familyId/relationships` | GET | Any family member; family-scoped endpoints joined within family |
| `/v1/families/:familyId/relationships` | POST | Owner/Admin/Editor; write-time membership, person scope, duplicate and ancestry-cycle constraints |
| `/v1/families/:familyId/relationships/:relationshipId` | PUT, DELETE | Owner/Admin/Editor; write-time membership, relationship/person family scope, duplicate/cycle constraints |

All family mutation methods are guarded against writes to the canonical shared sample family. The current Worker exposes no `PATCH` family mutation route.

## Merged implementation evidence

The following PRs are merged to `main`. This list records implementation scope; it does not assert production promotion or completion of live acceptance.

- **#59:** identity-claim review pending-state/race and uniqueness handling, with local-D1 competing-decision and uniqueness rollback tests.
- **#60:** member roster Viewer denial and member role/membership write-time authorization.
- **#61:** identity unlink rechecks current Owner/Admin authority; dependent audit/claim writes are gated.
- **#62:** invitation creation rechecks authority and permitted invite role in the insert.
- **#64:** invitation revocation rechecks current Owner/Admin authority in the conditional update.
- **#65:** person profile update rechecks current editable role in the write.
- **#66:** person lifecycle mutations recheck Owner/Admin authority and gate audit writes.
- **#67:** relationship writes recheck role, family/person scope, duplicate and ancestry-cycle constraints.
- **#68:** workbook import prevalidates and stages records, then applies people, relationships and audit records in one authorized D1 batch; local-D1 rollback tests are present.
- **#69:** family deletion rechecks Owner membership in the delete statement.
- **#70:** identity claim creation/direct linking rechecks membership, person scope and Owner authority in the write.
- **#73:** person creation rechecks current role in the insert and gates its audit row.
- **#76:** refreshed this route inventory and recorded the remaining live-acceptance boundaries.
- **#77:** refreshed production-readiness evidence after the merged security changes.
- **#78:** identity-claim approval and rejection recheck current Owner/Admin membership inside the conditional state-transition writes; unit regressions assert the predicate and family/actor bindings.
- **#71:** follow-up audit findings documentation.
- **#72:** beta acceptance checklist.
- **#75:** beta readiness evidence refreshed after the security merges.

## Test evidence currently present on main

The Worker unit suite includes tests for:
- Production identity isolation, session expiry/logout behavior, browser-origin restrictions and Google sign-in rate limiting.
- Owner-only family deletion, shared-sample immutability and Viewer roster denial.
- Family access, person role boundaries, lifecycle actions and write-time role rechecks.
- Relationship role boundaries, cross-family person-ID substitution, family-scoped endpoints, duplicate and ancestry-cycle checks.
- Invitation creation/revocation/acceptance, email mismatch, expiry, single-use behavior, competing acceptance and rate limiting.
- Member role changes/removals and Owner/peer-Admin protections.
- Identity claim request/review/unlink, self-review denial, stale pending state and gated audit/link writes.
- Platform Super Admin separation, reason-gated support/export/import paths.
- Person creation and workbook import validation.

Local-D1 integration tests include:
- Person update/create and corresponding audit records.
- Invitation create/revoke and identity unlink.
- Family deletion with current Owner enforcement.
- Workbook import prevalidation, relationship/cycle behavior, atomic batch writes and forced rollback.
- Relationship write-time duplicate/cycle guards.
- Person lifecycle transitions.
- Identity claim approval/rejection races and uniqueness-constraint rollback.
- A dedicated foreign-family resource-ID integration test that seeds a second family and attempts member, invitation, identity-claim, person and relationship mutations using those foreign IDs; it asserts the expected denials and verifies the foreign rows and audit history remain unchanged.

These tests provide meaningful repository evidence. Mock-based unit tests are not equivalent to exhaustive live route testing, and the local-D1 suite does not prove production D1 behavior.

## Remaining review and acceptance work

1. **Complete a formal role matrix for every route/method.** The route inventory above is a source review. Add or record explicit allow/deny cases for each role, especially read routes and each platform-only endpoint; do not infer a negative case solely from a UI-hidden control.
2. **Cross-family/resource-ID regression coverage is present in local D1.** The integration test `rejects foreign-family resource IDs across member, invitation, identity, person and relationship mutations` exercises foreign member, invitation, identity-claim, person and relationship IDs and verifies no foreign-row mutation or audit write. This closes the identified automated-test coverage gap for those mutation handlers. The separate live beta-environment acceptance remains outstanding; automated local D1 evidence is not production/live acceptance.
3. **Run live beta-environment acceptance.** Verify intended Owner/Admin/Editor/Viewer accounts, family isolation, invitation email mismatch/expiry/revocation/single-use, identity-claim requester visibility/self-review/competing actions, and platform Super Admin boundaries. Use approved test accounts and non-sensitive test families.
4. **Verify deployed import/export outcomes.** Reconcile representative import counts, memberships, roles, relationships, audit rows and rendered tree behavior. Existing local-D1 transaction tests are not a substitute.
5. **Capture edge/security evidence.** Record CORS preflight and allowed/disallowed origin behavior, cookie attributes, TLS/security headers, and deployed safe-error/logging review. The Worker currently sets HttpOnly, Secure, SameSite=Lax session cookies and generic internal errors; deployed evidence is still required.
6. **Review operational policy.** Session revocation/account deletion expectations, invitation/session/audit retention, monitoring and incident response are separate beta gates.

## Current disposition

- **Implementation hardening:** the listed security and transactional-import PRs are merged to `main), with relevant CI and local-D1 evidence.
- **Source review:** route families and current role/scoping patterns have been inventoried above; this is not a claim that every route has a complete positive/negative test pair.
- **Live acceptance:** not complete. The intended beta role matrix, live cross-family tampering confirmation, deployed import/export reconciliation and deployed edge/security evidence remain outstanding. The local D1 foreign-resource-ID regression is automated repository evidence only.
- **Readiness scoring:** do not increase the beta tracker score on the basis of merged code or green CI alone.
- **Safety boundary:** this audit performs no production D1 reads/exports/restores/migrations, production SQL, secrets changes, Cloudflare resource changes, production deployment or production-branch promotion. Those remain separate owner-approved actions.
