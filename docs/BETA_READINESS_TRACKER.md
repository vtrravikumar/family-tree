# Friends & Family Beta Readiness Tracker

**Baseline date:** 2026-11-24  
**Latest evidence update:** 2026-11-25  
**Scope:** The minimum safe, bounded Friends & Family beta — not full v1.0.  
**Scoring:** 20 evidence-based controls, each worth 5 points. Complete = 5; partial = 2.5; not evidenced = 0. The score is earned points divided by 100. Automated unit and local-D1 integration tests, source review and green CI are accepted evidence for implementation/security controls when they exercise the relevant behaviour; a live production-like test is not automatically required before a bounded Friends & Family UAT.

## Current score

| Measure | Result |
|---|---:|
| Evidence score (all controls, including production backlog) | **87.5 / 100 (87.5%)** |
| Beta-gate readiness (production-backlog work excluded) | **87.5 / 97.5 (89.7%)** |
| Remaining beta-gate points | **10 points** |
| Production-backlog points (not a beta blocker) | **2.5 points** |
| Remaining | **12.5 points** |
| Confidence of reaching 100% | **85% within 1 focused week** |
| Confidence basis | Remaining work is finite and mostly operational setup, beta guidance and owner decisions; confidence is conditional on no new security/data-integrity issue and timely owner-side checks. |

This is a deliberately separate score from v1.0 completion. Deferred features such as photo upload, full-tree presentation export and advanced collaboration do not reduce beta readiness.

## Latest engineering evidence — 2026-11-25

- PR #110 merged on 2026-11-25. It records the approved account- and family-deletion request route (**vtr.ravikumar@gmail.com**), documents the existing Owner-only, explicit-confirmation in-app family deletion API, and distinguishes account deletion from family deletion. Validation, Cloudflare Pages dev and production, and Workers production checks succeeded; development deployment was skipped as expected. Merge commit: `9facfedbd6b53135f02fc24369dc696516938a86`.
- The privacy/support document now has source-verified session/logout, invitation, member-removal and family-deletion implementation facts; the owner-approved email route for account/family deletion and support; and incident/rollback instructions. The owner approved a manual owner-reviewed account-deletion process and 90-day D1 application audit retention; scheduled cleanup deployment/evidence and final participant-facing wording approval remain open. This earns partial evidence for controls 17 and 18, not full completion.

- PR #107 production edge verification workflow was manually run on `main` on 2026-11-25; [workflow run 45601381941](https://github.com/vtrravikumar/family-tree/actions/runs/45601381941) succeeded. From a GitHub-hosted runner, TLS certificate validation, production API health (HTTP 200, production environment, D1 connected), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, allowed-origin credentialed CORS preflight, absence of CORS permission for an unapproved origin, and server-side rejection of an unapproved-origin POST (HTTP 403, `origin_not_allowed`) all passed. The run used no authenticated session, family data, secrets or production writes. This closes the live TLS/CORS/health/header portion of control 15; deployed production invocation review is now complete as recorded below, closing control 15 at 5/5.

- PR #101 actionable beta health alerts is merged. Controlled failure test on 2026-11-25 (workflow run #3, [run 45599198715](https://github.com/vtrravikumar/family-tree/actions/runs/45599198715)) intentionally failed the health-check job; the notification job succeeded and created [issue #103](https://github.com/vtrravikumar/family-tree/issues/103), assigned to `vtrravikumar`. A second controlled run reused the existing alert rather than creating a duplicate. Test alert #103 was closed after verification. Normal scheduled run #2 completed successfully. This verifies the alert delivery path; the simulated failure is not evidence of an actual service outage.

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

The merged changes have passing validation and applicable Workers/Pages checks. They are merged to `main`; this does not by itself prove production promotion. The beta score is 85/100: controls 10–12, 16 and 19 are now complete based on source review, automated unit/local-D1 evidence and a verified monitoring alert path. Live production-like role replay is intentionally deferred to Friends & Family UAT and is not treated as a pre-UAT gate.

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
| 10 | Route-level authorization and role-boundary audit | Complete | 5 | Source route inventory plus automated role/authorization regressions cover family read/write roles, roster visibility, person and relationship mutations, invitation administration, member-role changes, identity claims, imports, family deletion and platform-only routes. CI runs unit and local-D1 integration suites. Any defects found during UAT are handled through the normal defect process; exhaustive live route replay is not a pre-UAT gate. |
| 11 | Identity-claim security: pending state, self-review, uniqueness and race handling | Complete | 5 | Automated unit and local-D1 integration coverage exercises claim creation, requester scoping, Owner/Admin review, self-review denial, stale pending state, competing approve/reject actions, uniqueness conflicts, atomic unlink and audit gating. Live observations during UAT are welcome but are not a prerequisite to inviting the bounded test group. |
| 12 | Cross-family/resource-ID tampering negative tests | Complete | 5 | Local-D1 integration test `rejects foreign-family resource IDs across member, invitation, identity, person and relationship mutations` exercises foreign resource IDs and verifies denials, unchanged foreign records and no foreign audit writes. Existing tests also cover foreign family/person substitutions. Live production-like replay is deferred to UAT feedback rather than treated as a pre-UAT gate. |
| 13 | Local D1 integration test capability and CI execution | Complete | 5 | PR #59 added real local D1/SQLite integration tests; PR #62's latest CI run is green. Green CI is not equivalent to merged code or production deployment. |
| 14 | Backup/recovery operating procedure, access and retention | **Production backlog — not a beta blocker** | 2.5 | PR #58 runbook is retained. Existing disposable D1 restore rehearsal and production Time Travel bookmark are recorded. Remaining work (independent SQL export, storage, access, schedule, retention and restore rehearsal) is deferred to production readiness and is excluded from the beta go/no-go score. No production backup operation is authorized by this deferral. |
| 15 | Production edge/security verification: CORS, cookies, TLS, headers, safe errors/logging | Complete | 5 | PR #107 [workflow run 45601381941](https://github.com/vtrravikumar/family-tree/actions/runs/45601381941) passed live production TLS validation, health/D1 response, no-store/nosniff headers, allowed credentialed CORS preflight, denied-origin no-ACAO and denied-origin POST (403). Source tests/review cover secure HttpOnly SameSite=Lax session cookie attributes and generic API errors. On 2026-11-25, production invocation details for `GET /v1/families/sample-family-v1/identity` were reviewed: the cookie header value was redacted, request/response bodies and credentials were not present, and the event exposed only method/path, response status and operational metadata. This closes the deployed-log evidence for the bounded beta. Client IP/geolocation metadata is visible; retention/minimization decisions remain tracked under Control 17. |
| 16 | Actionable operational monitoring and failure alerts | Complete | 5 | PR #101 merged. Normal monitor run #2 succeeded for dev/prod; controlled failure run #3 failed the health job as intended and notification job succeeded, creating assigned GitHub issue #103. Second test run reused the alert (no duplicate); test issue closed after verification. Evidence: [run #3](https://github.com/vtrravikumar/family-tree/actions/runs/45599198715), [issue #103](https://github.com/vtrravikumar/family-tree/issues/103). |
| 17 | Beta privacy and lifecycle policy | Partial | 2.5 | PRs #109/#110 verify session/logout, invitation, member-removal and family-deletion behaviour. Owner approved manual owner-reviewed account-deletion handling and 90-day D1 audit_logs retention on 2026-11-25. Scheduled cleanup implementation/tests are in PR #118; deployment and first scheduled-run evidence plus final participant-facing wording approval remain. No self-service account-deletion endpoint is claimed. |
| 18 | Support contact, incident handling and rollback instructions | Partial | 2.5 | PRs #102 and #109 document WhatsApp with the owner, email fallback at vtr.ravikumar@gmail.com, incident response steps and application rollback guidance. PR #110 confirms the same email for account/family-deletion requests. Remaining: owner review/approval of the participant-facing support and incident note. |
| 19 | End-to-end acceptance using the intended beta accounts and roles | Complete | 5 | Owner confirmed the intended account/role acceptance is checked and complete, including Owner, Admin, Editor and Viewer. Existing automated regressions cover role permissions, invitation lifecycle, identity claims, family isolation and cross-family resource IDs. Development acceptance is closed; retain production UAT findings in the normal defect process. |
| 20 | Bounded beta notes and explicit invitation go/no-go | Not evidenced | 0 | Publish scope/limitations and data-safety guidance; owner explicitly approves opening the beta after all Gate 1 checks pass. |
|  | **Total** |  | **87.5 / 100** |  |

## Immediate work queue

### Engineering / repository work
1. Keep the route inventory and automated role/security regressions current; add tests when code changes or a defect is found. No duplicate live route-by-route replay is required before UAT.
2. Use Friends & Family UAT to collect real-user findings on role behaviour, family isolation, invitations and identity claims. Triage and fix any defects before expanding the beta.
3. Review the deployed import/export behavior and reconcile record counts, memberships, relationships and audit rows after a representative import.
4. Keep the beta tracker and route audit synchronized with merged evidence; do not count CI alone as live acceptance.

### Operational / owner verification
5. **Production backlog (after beta):** decide and approve D1 backup destination, schedule, retention and access controls; then complete an approved SQL export and disposable restore rehearsal.
6. CORS preflight, secure-cookie, TLS/header and deployed invocation-log evidence are complete for Control 15.
7. Configure actionable monitoring/alerts and verify the notification path.
8. Record privacy/session/invitation/audit retention decisions and account deletion/revocation expectations.
9. Prepare the bounded UAT cohort, instructions, feedback channel and issue-triage process. Friends & Family use is the live acceptance phase; production-style certification remains part of the later v1.0 release process.

## Confidence assessment

**85% confidence of reaching the 100% beta gate within 1 focused week** is a planning estimate, not a guarantee.

Why confidence is reasonably high:
- The product is already deployed in a separated production environment.
- Core family creation, role/invitation flows, workbook portability and a selected-family transfer have owner-confirmed evidence.
- Authorization and data-integrity hardening across PRs #59–#70 and #73 is merged, with CI and local-D1 evidence. PR #78 additionally closes the identity-claim review stale-role race by checking current Owner/Admin membership at write time. These changes, together with the local-D1 foreign-resource-ID regression, satisfy the pre-UAT automated evidence standard. Real-world feedback and any environment-specific defects will be gathered during UAT.
- The remaining checklist is bounded and does not require building the deferred v1.0 feature set.

What could reduce confidence:
- A newly discovered authorization or data-integrity flaw.
- A failed production-like role/acceptance test.
- Delays in owner-side policy decisions, monitoring setup or operational verification.
- A newly identified backup/recovery risk that materially changes the bounded beta risk assessment; otherwise backup implementation remains in the production backlog.

## Scoring rules and release guardrails

- A PR with green CI is **validated code**, not automatically merged or deployed. Draft PR work remains partial until reviewed and merged.
- Production deployment, production D1 export/restore/migration, secrets changes and production resource changes require separate explicit owner approval.
- Do not open the Friends & Family beta merely because the beta-gate score reaches 100%; review the pre-UAT safety gates and explicitly approve the go/no-go. Control 14 is tracked separately as production backlog and is not part of this beta gate. UAT is the planned live-user acceptance phase, not a prerequisite that must be completed before inviting the UAT cohort.
- Recalculate this score only when evidence changes. Keep v1.0-only and deferred product features out of this beta denominator.

- PR #71 (route-authorization follow-up findings) and PR #72 (beta acceptance checklist) are merged to `main`.
- PR #73 (person creation authorization-atomicity) is merged to `main`; its local D1 integration test verifies the person and matching audit record.


## UAT approach decision — 2026-11-25

The owner has chosen an automated-test-first approach for the bounded Friends & Family beta:

- Source review, automated unit tests, local-D1 integration tests and CI are the pre-UAT evidence for route authorization, identity-claim security and cross-family resource isolation (controls 10–12).
- Do not create duplicate live-environment test campaigns solely to replay already-covered automated cases before UAT.
- Friends & Family UAT is the live acceptance phase. Real users will exercise the application and report usability, role, invitation, family-isolation and data-integrity findings.
- Triage UAT findings, fix confirmed defects and add regression tests. Escalate immediately if a security or data-integrity issue is reported.
- This decision does not waive basic operational safeguards, an explicit beta go/no-go, or the deeper production verification required for formal v1.0.



## Intended-account acceptance closure — 2026-11-25

The owner confirmed that the intended account/role acceptance checks are already completed and verified. Control 19 is therefore closed at 5/5. This confirmation supersedes the earlier partial-status note; no additional duplicate manual test campaign is required. Any future UAT findings remain subject to normal defect triage and regression coverage.


## Backup/recovery scope decision — 2026-11-25

The owner confirmed backup/recovery is not a blocker for the bounded Friends & Family beta. Control 14 remains partially evidenced at 2.5/5 for transparency, but its remaining 2.5 points are excluded from the beta-gate denominator and moved to the production backlog. The runbook remains available for later production-readiness work. This decision does not mark backup/recovery complete or authorize R2 provisioning, production export/restore, secrets, schedules or retention changes.


## Production invocation-log review — 2026-11-25

The owner reviewed a production invocation detail for `GET /v1/families/sample-family-v1/identity` in Cloudflare Workers Observability. The cookie header value was explicitly redacted. The event contained request method/path, response status and operational metadata; no request or response body, session token, invitation code or family-record content was present in the displayed event. Client IP and approximate geolocation/connection metadata were visible; decisions on log retention and data minimization remain open under Control 17. Together with the successful production edge workflow and source-reviewed cookie/error handling, this closes Control 15 at 5/5.
