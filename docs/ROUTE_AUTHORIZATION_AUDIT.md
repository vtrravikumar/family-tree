# Route-by-Route Authorization Audit

**Baseline:** `main` at `cf5f8f1a45056caac932fbe3080ef3cb9da40d8c` (2026-11-24, after PR #60)  
**Audit branch:** `security/route-authorization-audit`  
**Scope:** Worker API routes in `workers/api/src/index.ts`. This is an audit record, not a production release or authorization change.

## Audit method

For every route, verify:
1. Authentication requirement and accepted identity/session path.
2. Family membership and role requirement.
3. Resource scoping: family, person, relationship, invitation, member and claim IDs must be checked against the authorized family.
4. Platform Super Admin separation and explicit reason/audit requirements.
5. State transition, concurrency, audit-log and failure behavior.
6. Positive and negative tests against local mocks and, where state/transaction behavior matters, local D1 integration tests.

A route is not marked passed merely because a role check exists. The database operation and tests must support the conclusion.

## Route inventory and initial expected policy

| Route | Methods | Expected authorization |
|---|---|---|
| `/v1/auth/google` | POST | Public sign-in entry; valid Google credential required; rate limited |
| `/v1/auth/me` | GET | Valid session |
| `/v1/auth/logout` | POST | Session cookie if present; revoke only that session |
| `/v1/onboarding/sample-access` | POST, DELETE | Authenticated user; affect only caller's sample membership/dismissal |
| `/v1/platform/me` | GET | Authenticated; disclose only caller's platform status |
| `/v1/platform/overview` | GET | Platform Super Admin |
| `/v1/platform/users` | GET | Platform Super Admin |
| `/v1/platform/families` | GET | Platform Super Admin |
| `/v1/platform/audit-logs` | GET | Platform Super Admin |
| `/v1/platform/families/:familyId/support-access` | POST | Platform Super Admin; reason required; platform audit |
| `/v1/platform/families/:familyId/export` | POST | Platform Super Admin; reason required; platform audit; one family only |
| `/v1/families` | GET | Authenticated; only caller's memberships |
| `/v1/families` | POST | Authenticated; caller becomes Owner |
| `/v1/families/:familyId` | DELETE | Family Owner only; explicit confirmation |
| `/v1/families/:familyId/members` | GET | Owner/Admin/Editor; Viewer denied (API guard and regression test added on audit branch) |
| `/v1/families/:familyId/members/:userId` | PUT, DELETE | Owner/Admin; protect Owner; Admin cannot grant or modify/remove another Admin |
| `/v1/families/:familyId/invitations` | POST | Owner/Admin; Admin cannot invite another Admin; rate limited |
| `/v1/families/:familyId/invitations` | GET | Owner/Admin |
| `/v1/families/:familyId/invitations/:invitationId` | DELETE | Owner/Admin; pending, unexpired invitation only |
| `/v1/invitations/:code/accept` | POST | Signed-in Google account; invitee email match; pending/unexpired; consume once |
| `/v1/families/:familyId/identity` | GET | Family member; own link/claims; pending claims visible only to Owner/Admin |
| `/v1/families/:familyId/identity` | DELETE | Owner/Admin; family-scoped identity unlink |
| `/v1/families/:familyId/identity-claims` | POST | Any family member may request; Owner may directly claim |
| `/v1/families/:familyId/identity-claims/:claimId/review` | POST | Owner/Admin; no self-review; pending transition must win |
| `/v1/families/:familyId/people` | GET | Any family member |
| `/v1/families/:familyId/people` | POST | Owner/Admin/Editor |
| `/v1/families/:familyId/people/:personId` | PUT | Owner/Admin/Editor; living profile only |
| `/v1/families/:familyId/people/:personId` | DELETE | Owner/Admin; explicit confirmation; living profile only |
| `/v1/families/:familyId/people/:personId/restore` | POST | Owner/Admin; explicit confirmation |
| `/v1/families/:familyId/people/:personId/deceased` | POST | Owner/Admin; explicit confirmation |
| `/v1/families/:familyId/import` | POST | Owner/Admin, or Super Admin through reason-gated platform path |
| `/v1/families/:familyId/relationships` | GET | Any family member |
| `/v1/families/:familyId/relationships` | POST | Owner/Admin/Editor; both people must belong to family |
| `/v1/families/:familyId/relationships/:relationshipId` | PUT, DELETE | Owner/Admin/Editor; relationship and both endpoint people family-scoped |

The shared sample is separately protected by a family-scoped mutation guard: family-scoped POST/PUT/PATCH/DELETE requests against the canonical sample must be denied for every role.

## Existing test baseline

The current Worker unit suite already exercises:
- Session/development-token authorization, origin checks and production identity isolation.
- Owner-only family deletion and shared-sample read-only behavior.
- Family read access, Viewer write denial, Editor profile edits, and Owner/Admin lifecycle operations.
- Relationship role boundaries and cross-family person-ID substitution.
- Invitation create/list/revoke/accept role checks, email matching, expiry, rate limits and competing acceptance.
- Member role changes/removals, including Owner and peer-Admin protection.
- Identity claim request/review/unlink permissions, self-review denial and stale-claim handling.
- Super Admin separation, reason-gated support/export/import paths.
- PR #59's local-D1 identity-claim approval/rejection race and uniqueness behavior.

## Initial review notes — not yet final findings

1. **Member roster visibility — initial gap fixed on audit branch.** The API now denies Viewer access to the member roster while retaining Owner/Admin/Editor access, matching the web UI's hidden Members navigation for Viewers. A regression test covers all four roles. CI verification is pending.
2. **Role and membership changes need a concurrency review.** Several handlers authorize using a role read and perform a later write. Review whether a concurrent role revocation/demotion can allow a stale authorization decision to complete.
3. **Authorization tests are broad but not exhaustive.** Add route-specific negative coverage for any gap found in the matrix, especially read endpoints and platform-only paths. Do not infer that an untested role is denied.
4. **Keep authorization separate from product policy.** Where the product spec or security matrix is ambiguous, record the decision before changing server behavior.

## Status

- [x] Confirmed baseline commit and created an isolated audit branch.
- [x] Enumerated current Worker API route families and methods.
- [x] Read the current Worker unit tests, identity-claim D1 integration tests and security baseline.
- [x] Resolve member-roster visibility policy and deny Viewer roster access.
- [ ] Complete route-by-route authorization and resource-scope review.
- [ ] Add regression tests for confirmed gaps.
- [ ] Run Worker unit tests, local D1 integration tests, typecheck and build.
- [ ] Open a draft PR for review.
- [ ] Obtain explicit approval before merge or any production promotion/deployment.

## Safety boundary

This audit and its tests use repository code and local/test databases only. No production D1 reads/exports/restores/migrations, production SQL, secrets, Cloudflare resource changes, production deployments or production-branch updates are authorized by this work.


## Follow-up review evidence — 2026-11-25

The following changes are under review after the initial audit. Draft PRs are evidence of proposed fixes, not merged protections or production behavior.

| PR | Route area | Proposed protection | Current evidence / status |
|---:|---|---|---|
| #59 (merged) | Identity claim review | Conditional pending-state transition; dependent link/audit writes gated on success | Merged to main; local D1 integration tests cover competing decisions and uniqueness rollback |
| #60 (merged) | Member roster and member role changes | Viewer roster denial; write-time actor/target role checks; audit gated on successful mutation | Merged to main; validation passed |
| #61 (draft) | Identity unlink | Recheck current Owner/Admin membership at unlink; gate audit and claim withdrawal on successful unlink | Validation, both Pages previews and Workers preview passed; not merged |
| #62 (draft) | Invitation creation | Recheck current Owner/Admin membership and Admin privilege restriction in INSERT | Validation, both Pages previews and Workers preview passed; not merged |
| #64 (draft) | Invitation revocation | Recheck current Owner/Admin membership in conditional UPDATE | Validation, both Pages previews and Workers preview passed; not merged |
| #65 (draft) | Person profile update | Recheck Owner/Admin/Editor membership in UPDATE | Local D1 integration test added; validation, both Pages previews and Workers preview passed; not merged |
| #66 (draft) | Person lifecycle actions | Recheck Owner/Admin membership in delete/restore/deceased writes | Local D1 integration test added; validation, both Pages previews and Workers preview passed; not merged |
| #67 (draft) | Relationship create/update/delete | Recheck Owner/Admin/Editor membership and family-scoped endpoints in writes | Validation, Pages previews and Workers preview passed; not merged |
| #68 (draft) | Workbook import integrity | Prevalidate all people; plan people/relationships; apply data and audit writes in one authorized D1 batch; rollback on SQL failure | Local D1 tests cover malformed late rows, forced rollback, relationship import/cycle handling and Super Admin audit. Latest typecheck/tests/build and Workers preview passed; Production Pages preview is still running |
| #69 (draft) | Family deletion | Recheck Owner membership inside family DELETE; conflict on zero-row delete | Validation, both Pages previews and Workers preview passed; local D1 integration test confirms family deletion and cascade behavior |
| #70 (draft) | Identity claim creation | Recheck membership/person scope during claim INSERT; require Owner for direct link | Validation, both Pages previews and Workers preview passed; local D1 integration test confirms direct Owner link and audit |
| #73 (draft) | Person creation | Recheck current Owner/Admin/Editor membership inside person INSERT; gate audit on success | Typecheck, tests, build, both Pages previews and Workers preview passed; local D1 integration test confirms person/audit consistency |

### Additional confirmed findings

1. **Family deletion had a stale-authorization window.** The original handler checked Owner role, then deleted the family by ID only. PR #69 adds a conditional Owner predicate in the DELETE statement and a zero-row conflict response.
2. **Identity claim creation had a stale-membership window.** The original handler checked membership and person scope before a later INSERT. PR #70 moves membership/person scope into the INSERT and gates audit rows.
3. **Workbook import integrity is implemented in draft PR #68 but not yet accepted.** The latest code plans all records first and executes person, relationship and audit writes in one authorized D1 batch. Local D1 tests cover malformed late rows, forced database-failure rollback and the reason-gated Super Admin audit path. Keep the finding open until the Production Pages preview completes and the PR is reviewed/merged.

4. **Read-route scope review:** Reviewed the current API GET paths for family lists, member rosters, invitations, identity links/claims, people and relationships, plus platform overview/users/families/audit/support/export. Family reads are scoped by membership/family ID; identity claim requester data is self-scoped and pending requester details are Owner/Admin-only; platform data reads require Super Admin. No unscoped cross-family read was identified in this pass. Existing negative tests do not yet cover every read route, so retain broader API-level cross-family tests in the acceptance plan.

### Current audit disposition

- Merged protections: PR #59 and PR #60 only.
- Draft code with green validation is not counted as deployed or merged protection.
- Route-by-route audit is **not complete**. The import transaction implementation is in draft PR #68 awaiting its final Pages preview and review. Platform route evidence, read-route scope checks and final D1 coverage review still require work.
- No production deployment, production D1 export/restore/migration, production SQL, or production-branch update is authorized by this audit.
