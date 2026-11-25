# Friends & Family Beta Readiness Tracker

**Baseline date:** 2026-11-24  
**Scope:** The minimum safe, bounded Friends & Family beta — not full v1.0.  
**Scoring:** 20 evidence-based controls, each worth 5 points. Complete = 5; partial = 2.5; not evidenced = 0. The score is earned points divided by 100. No item is marked complete solely because code exists or CI is green.

## Current score

| Measure | Result |
|---|---:|
| Beta readiness | **62.5 / 100 (62.5%)** |
| Remaining | **37.5 points** |
| Confidence of reaching 100% | **75% within 1–2 focused weeks** |
| Confidence basis | Remaining work is finite and mostly verification, documentation and operational setup; confidence is conditional on no new security/data-integrity issue and timely owner-side checks. |

This is a deliberately separate score from v1.0 completion. Deferred features such as photo upload, full-tree presentation export and advanced collaboration do not reduce beta readiness.

## Latest engineering evidence — 2026-11-25

The following feature-branch PRs have additional CI evidence, but remain unmerged and therefore do not change the readiness score:

- PR #61 identity unlink atomicity: validation, both Pages previews and Workers preview passed.
- PR #62 invitation creation atomicity: validation, both Pages previews and Workers preview passed.
- PR #64 invitation revocation atomicity: validation, both Pages previews and Workers preview passed.
- PR #65 person profile update atomicity: validation, both Pages previews and Workers preview passed.
- PR #66 person lifecycle atomicity: validation, both Pages previews and Workers preview passed.
- PR #67 relationship mutation atomicity: validation, both Pages previews and Workers preview passed.
- PR #68 import integrity: the draft now validates all rows first and applies people, relationships and audit writes in one D1 batch; local D1 tests cover malformed late rows, forced rollback and Super Admin audit. Typecheck/tests/build passed on an intermediate commit; the latest commit is being revalidated. An earlier Workers preview failed, so the latest Worker preview must be checked before considering this PR validated.
- PR #69 family deletion atomicity: validation and Workers preview passed on the latest tested head; Production Pages preview was still running at the last check. Local D1 integration coverage verifies family deletion and cascade behavior.
- PR #70 identity claim creation atomicity: validation passed; Cloudflare Pages and Workers previews were still running at the last check.

The import work in PR #68 is an initial guard only. Full transactional import rollback and write-time authorization remain open. No PR in this list has been merged or promoted to production.

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
| 10 | Route-level authorization and role-boundary audit | Partial | 2.5 | PR #60 merged and tightened roster/member mutation authorization. Route-by-route audit remains incomplete; people, relationship, import and platform paths still need final evidence. |
| 11 | Identity-claim security: pending state, self-review, uniqueness and race handling | Partial | 2.5 | PR #59 merged with local-D1 race/uniqueness tests. PR #61 adds atomic unlink but remains draft; complete end-to-end edge-case review remains open. |
| 12 | Cross-family/resource-ID tampering negative tests | Partial | 2.5 | Mock regressions exist for relationship/member-ID substitution. Need broader route coverage and production-like D1 verification. |
| 13 | Local D1 integration test capability and CI execution | Complete | 5 | PR #59 added real local D1/SQLite integration tests; PR #62's latest CI run is green. Green CI is not equivalent to merged code or production deployment. |
| 14 | Backup/recovery operating procedure, access and retention | Partial | 2.5 | Disposable D1 restore rehearsal passed and production Time Travel bookmark was observed. Runbook is in an unmerged PR; backup destination, schedule, access controls and retention still need decisions. |
| 15 | Production edge/security verification: CORS, cookies, TLS, headers, safe errors/logging | Partial | 2.5 | Domain/SSL, production sign-in and health confirmed. CORS preflight, cookie attributes, security headers and deployed-log review need recorded evidence. |
| 16 | Actionable operational monitoring and failure alerts | Not evidenced | 0 | Choose and verify beta-appropriate error/availability alerts without exposing family data or credentials. |
| 17 | Beta privacy and lifecycle policy | Not evidenced | 0 | Decide/document session and invitation expiry, logout/revocation, account deletion expectations, and family/platform audit retention. |
| 18 | Support contact, incident handling and rollback instructions | Not evidenced | 0 | Name the beta support route and document operator steps for a failed release or serious data/access issue. |
| 19 | End-to-end acceptance using the intended beta accounts and roles | Not evidenced | 0 | Run and record a role-by-role acceptance pass with the intended test users against the beta environment. |
| 20 | Bounded beta notes and explicit invitation go/no-go | Not evidenced | 0 | Publish scope/limitations and data-safety guidance; owner explicitly approves opening the beta after all Gate 1 checks pass. |
|  | **Total** |  | **62.5 / 100** |  |

## Immediate work queue

### Engineering / repository work
1. Finish the route-by-route authorization audit and add regression tests for confirmed gaps.
2. Review PR #61 (atomic identity unlink) and PR #62 (atomic invitation creation) after CI; both are draft changes and are not counted as merged.
3. Complete the invitation revocation concurrency review and inspect people, relationship, import and platform-admin mutation paths.
4. Reconcile the audit findings with the route inventory and update the security evidence only after tests support each status.

### Operational / owner verification
5. Complete and review the D1 backup/recovery runbook; decide backup destination, schedule, retention and access controls. No production export or restore is implied by this tracker.
6. Capture CORS preflight, secure-cookie, TLS/header and safe-logging evidence from the intended beta environment.
7. Configure actionable monitoring/alerts.
8. Record the privacy/session/invitation/audit retention decisions.
9. Run end-to-end acceptance with the intended accounts/roles; prepare support, rollback and beta notes.

## Confidence assessment

**75% confidence of reaching the 100% beta gate within 1–2 focused weeks** is a planning estimate, not a guarantee.

Why confidence is reasonably high:
- The product is already deployed in a separated production environment.
- Core family creation, role/invitation flows, workbook portability and a selected-family transfer have owner-confirmed evidence.
- Recent security changes have been delivered in PR #59 and #60; PR #61 and #62 have green/ongoing CI evidence, with PR #62 now reported green by the owner and verified through the associated workflow run.
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

- PR #71 (draft documentation): route-authorization follow-up findings and roadmap status refresh; validation and Workers preview passed, Pages preview was pending at last check.
- PR #72 (draft documentation): beta acceptance checklist; validation passed, Pages preview still pending at last check.
- PR #73 (draft): person creation authorization-atomicity; typecheck, tests, build, both Pages previews and Workers preview passed; local D1 integration coverage verifies the person and audit record.
