# Friends & Family Beta Readiness Tracker

**Baseline date:** 2026-11-24  
**Latest evidence update:** 2026-11-25  
**Scope:** The minimum safe, bounded Friends & Family beta — not full v1.0.  
**Scoring:** 20 evidence-based controls, each worth 5 points. Complete = 5; partial = 2.5; not evidenced = 0. The score is earned points divided by 100. No item is marked complete solely because code exists or CI is green.

## Current score

| Measure | Result |
|---|---:|
| Beta readiness | **65.0 / 100 (65.0%)** |
| Remaining | **35.0 points** |
| Confidence of reaching 100% | **75% within 1–2 focused weeks** |
| Confidence basis | Remaining work is finite and mostly verification, documentation and operational setup; confidence is conditional on no new security/data-integrity issue and timely owner-side checks. |

This is a deliberately separate score from v1.0 completion. Deferred features such as photo upload, full-tree presentation export and advanced collaboration do not reduce beta readiness.

## Latest engineering evidence — 2026-11-25

The authorization and data-integrity hardening series is now merged to `main`:

- PR #59: identity-claim review race/uniqueness protections.
- PR #60: route-level authorization and member-roster visibility.
- PR #61: identity unlink rechecks Owner/Admin authority at mutation time; audit and claim withdrawal are gated on successful unlink.
- PR #62: invitation creation rechecks current authority and allowed offered role in the INSERT.
- PR #64: invitation revocation rechecks Owner/Admin authority at mutation time.
- PR #65: person profile updates recheck the current editable role at mutation time.
- PR #66: person delete/restore/deceased transitions recheck Owner/Admin authority at mutation time.
- PR #67: relationship create/update/delete enforce write-time membership, role, person scope, duplicate and ancestry-cycle constraints.
- PR #68: workbook imports are prevalidated and applied in one authorized D1 batch; local D1 tests cover malformed late rows and rollback after a forced database failure.
- PR #69: family deletion rechecks Owner authority inside the delete statement.
- PR #70: identity-claim creation/direct linking rechecks membership, person scope and Owner authority in the write.
- PR #73: person creation rechecks role and family/person constraints in the write and gates the audit record on success.
- PR #58: D1 backup/recovery runbook merged; operational backup schedule, destination, retention and access decisions remain pending owner approval.
- PR #83: corrected Admin role display in the member roster; development deployment was owner-verified.
- 2026-11-25 development UI acceptance: Owner, Admin, Editor and Viewer role display/transition checks were owner-confirmed. Admin protected controls and Viewer read-only behavior were observed. This is UI smoke-test evidence only; the full action/API matrix and production acceptance remain open.

The merged changes have passing validation and applicable Workers/Pages checks. They are merged to `main`; this does not by itself prove production promotion or complete live role-matrix acceptance. The beta score is now 65.0/100 after the limited development UI acceptance evidence recorded below. Remaining controls still require independent environment verification and owner/operator decisions; the score increase does not represent full authorization or production acceptance.

## Scored evidence checklist

| # | Control / evidence required | Status | Points | Evidence / remaining work |
|---:|---|---|---:|---|
| 1 | Core family workflows: create/select family, people, relationships and tree views | Complete | 5 | Core application is implemented; production family creation and family/tree operation were owner-confirmed. |
| 2 | Shared sample family is available and server-enforced read-only | Complete | 5 | Sample family deployed; family mutation guard and production sample access are recorded. |
| 3 | Professional UI/UX and responsive QA | Complete | 5 | M4 redesign marked complete; cross-browser/device QA owner-confirmed. |
| 4 | Production Google sign-in and API/D1 health | Complete | 5 | Owner confirmed Google sign-in; production health reports production environment and connected D1. |
| 5 | Development/production isolation and fail-closed production frontend config | Complete | 5 | Separate Pages, Worker, D1 and domains; production API URL guard merged to production and Pages deployment owner-confirmed. |
| 6 | Production database schema/migrations established | Complete | 5 | All ten migrations 0001–0010 applied to clean production D1. |
| 7 | Selected-family development-to-production transfer | Complete | 5 | Owner confirmed people, biographies, relationships, memberships/roles and rendered tree after transfer. |
| 8 | Production family creation and workbook export/import usable | Complete | 5 | Owner-confirmed production family creation and workbook export/import. |
| 9 | Functional Owner/Admin/Editor/Viewer and invitation flows | Complete | 5 | Owner explicitly confirmed role and invitation flows tested successfully. This is functional confirmation, not exhaustive route proof. |
| 10 | Route-level authorization and role-boundary audit | Partial | 2.5 | PRs #60–#70 and #73 are merged, covering roster visibility and write-time authorization for identity links/claims, invitations, people, relationships, imports and family deletion. The complete route-by-route role matrix and live negative tests against the intended beta environment are still required. |
| 11 | Identity-claim security: pending state, self-review, uniqueness and race handling | Partial | 2.5 | PR #59 (review transitions/race/uniqueness), #61 (atomic unlink) and #70 (atomic claim creation/direct link) are merged with local-D1 coverage. Remaining work is live environment verification of requester visibility, self-review denial, cross-family IDs and competing claim actions. |
| 12 | Cross-family/resource-ID tampering negative tests | Partial | 2.5 | Mock regressions exist for relationship/member-ID substitution. Need broader route coverage and production-like D1 verification. |
| 13 | Local D1 integration test capability and CI execution | Complete | 5 | PR #59 added real local D1/SQLite integration tests; PR #62's latest CI run is green. Green CI is not equivalent to merged code or production deployment. |
| 14 | Backup/recovery operating procedure, access and retention | Partial | 2.5 | PR #58 is merged with `docs/BACKUP_RECOVERY.md`; a disposable D1 restore rehearsal passed and a production Time Travel bookmark was observed. Backup destination, schedule, access controls, retention and a fresh SQL export/restore rehearsal still need owner approval/evidence. |
| 15 | Production edge/security verification: CORS, cookies, TLS, headers, safe errors/logging | Partial | 2.5 | Domain/SSL, production sign-in and health confirmed. CORS preflight, cookie attributes, security headers and deployed-log review need recorded evidence. |
| 16 | Actionable operational monitoring and failure alerts | Not evidenced | 0 | Choose and verify beta-appropriate error/availability alerts without exposing family data or credentials. |
| 17 | Beta privacy and lifecycle policy | Not evidenced | 0 | Decide/document session and invitation expiry, logout/revocation, account deletion expectations, and family/platform audit retention. |
| 18 | Support contact, incident handling and rollback instructions | Not evidenced | 0 | Name the beta support route and document operator steps for a failed release or serious data/access issue. |
| 19 | End-to-end acceptance using the intended beta accounts and roles | Partial | 2.5 | Owner-confirmed development UI smoke tests cover Owner, Admin, Editor and Viewer role display/transition, Admin protected controls and Viewer read-only behavior (2026-11-25; PR #83 deployed to development). Remaining: action-by-action permission matrix, direct API denial tests, Editor restriction checks, invitation/identity/family-isolation edge cases and production acceptance. |
| 20 | Bounded beta notes and explicit invitation go/no-go | Not evidenced | 0 | Publish scope/limitations and data-safety guidance; owner explicitly approves opening the beta after all Gate 1 checks pass. |
|  | **Total** |  | **65.0 / 100** |  |

## Immediate work queue

### Engineering / repository work
1. Complete the route-by-route authorization matrix, including remaining read and platform-admin routes; add negative tests for confirmed gaps.
2. Complete the action-by-action role matrix and direct API negative tests in development first; include Editor/Viewer restrictions, family-ID/person-ID substitution, invitation expiry/revocation and identity-claim edge cases. Then perform the separate production smoke/acceptance pass.
3. Review the deployed import/export behavior and reconcile record counts, memberships, relationships and audit rows after a representative import.
4. Keep the beta tracker and route audit synchronized with merged evidence; do not count CI alone as live acceptance.

### Operational / owner verification
5. Decide and approve the D1 backup destination, schedule, retention and access controls; then complete an approved SQL export and disposable restore rehearsal.
6. Capture CORS preflight, secure-cookie, TLS/header and safe-logging evidence from the intended beta environment.
7. Configure actionable monitoring/alerts and verify the notification path.
8. Record privacy/session/invitation/audit retention decisions and account deletion/revocation expectations.
9. Extend the 2026-11-25 development UI smoke test into the full action/API acceptance matrix; separately run production acceptance with the intended accounts/roles. Prepare support, rollback and beta notes.

## Confidence assessment

**75% confidence of reaching the 100% beta gate within 1–2 focused weeks** is a planning estimate, not a guarantee.

Why confidence is reasonably high:
- The product is already deployed in a separated production environment.
- Core family creation, role/invitation flows, workbook portability and a selected-family transfer have owner-confirmed evidence.
- Authorization and data-integrity hardening across PRs #59–#70 and #73 is merged, with CI and local-D1 evidence. PR #78 additionally closes the identity-claim review stale-role race by checking current Owner/Admin membership at write time. These changes improve implementation confidence but do not replace live beta role-matrix and environment acceptance.
- The remaining checklist is bounded and does not require building the deferred v1.0 feature set.

What could reduce confidence:
- A newly discovered authorization or data-integrity flaw.
- A failed production-like role/acceptance test.
- Delays in owner-side policy decisions, monitoring setup or operational verification.
- Backup/recovery controls proving inadequate for the intended beta risk.

## Scoring rules and release guardrails

- A PR with green CI is **validated code**, not automatically merged or deployed. Draft PR work remains partial until reviewed and merged.
- Production deployment, production D1 export/restore/migration, secrets changes and production resource changes require separate explicit owner approval.
- Do not open the Friends & Family beta merely because the score reaches 100%; all Gate 1 evidence must be reviewed and the owner must explicitly approve the go/no-go.
- Recalculate this score only when evidence changes. Keep v1.0-only and deferred product features out of this beta denominator.

- PR #71 (route-authorization follow-up findings) and PR #72 (beta acceptance checklist) are merged to `main`.
- PR #73 (person creation authorization-atomicity) is merged to `main`; its local D1 integration test verifies the person and matching audit record.
