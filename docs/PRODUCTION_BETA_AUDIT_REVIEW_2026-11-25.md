# Review Notes — Production and Beta Readiness Audit (2026-11-25)

**Source:** Claude audit supplied by the project owner and preserved verbatim in [docs/audits/PRODUCTION_BETA_AUDIT_2026-11-25.md](audits/PRODUCTION_BETA_AUDIT_2026-11-25.md).  
**Audit snapshot:** `main` at `93e780a`.  
**Repository state reviewed for these notes:** `main` after PR #93, merge commit `0941b014b6404f5d274008f6da89b0f67ef12cdf` (2026-11-25).

## How to read this audit

The original report is retained as an independent, dated assessment. Its findings are not silently rewritten to match later project decisions. The report's scores and test counts describe its stated snapshot and method; they are not a fresh run or a current certification.

Since the audit snapshot, PR #93 was merged. The Friends & Family beta tracker is now **72.5/100**, with controls 10–12 accepted on source review and automated unit/local-D1 test evidence. This is a deliberate owner decision: exhaustive live route replay is deferred to Friends & Family UAT. The separate v1.0 production checklist remains a different measure (15/27, 56% at its last recorded update).

## Findings checked against the post-PR #93 source

The following high-impact observations remain visible in the repository source reviewed for these notes:

| Audit finding | Review observation | Treatment |
|---|---|---|
| 3.1 Import fidelity and matching | The current import handler still matches existing people using normalized display names (and aliases), retains the name-specific `Varsha`/`Bhoodevi` gender special case, and inserts only exact birth/death dates. The insert omits birth/death year/range/original-text precision and birth place/country fields. | **Confirmed code-level issue; high priority.** Do not use the current import as a lossless general-purpose family migration until corrected or explicitly bounded and communicated. |
| 3.2 Embedded family data | `apps/web/src/ramanImportData.ts` still exists and is imported by `apps/web/src/App.tsx`. The compressed payload is therefore part of the frontend module graph. | **Confirmed exposure path; high priority.** Establish whether this is real personal/family data, remove it from the public bundle, and assess repository-history cleanup if real. |
| 3.3 Open Google registration | The Google sign-in handler accepts any verified Google identity not already bound to another account; no beta email allowlist or invite-only registration check is present in the reviewed handler. | **Confirmed code-level issue; high priority for a controlled beta.** Decide and implement the intended cohort gate before inviting testers. |
| 3.4 API fallback host | `App.tsx` still falls back to `https://api-dev.vtrrk.in`. The repository README identifies the `vtrrk.in` API namespace as belonging to TweetPilot. | **Confirmed configuration risk.** Prefer fail-closed behaviour for builds without an explicit API URL; do not allow Google credentials to be sent to an unrelated host. |
| 3.5 Frontend security headers | No `apps/web/public/_headers` file was found in the reviewed repository state. | **Confirmed repository gap.** Add a CSP compatible with Google Identity Services and appropriate framing/referrer/permissions headers, then verify deployed responses. |
| 3.6 Monitoring | PR #90 has since added a 15-minute GitHub Actions API health workflow for dev and production health/database connectivity. Its workflow failure is visible in GitHub Actions, but an owner notification destination and delivery test are not configured/verified by that change. | **Partially superseded.** Basic health polling exists; actionable alert delivery and application-level error observability remain open. |
| 3.7 Abuse and resource limits | The reviewed API has sign-in and invitation rate limits, but no general per-user resource quotas were identified in the audited design. The request body helper checks `Content-Length` before `request.json()`. | **Retain for focused engineering review.** The audit's D1 write-amplification and chunked-body observations have not been independently reproduced here. |
| 3.8 Lifecycle | The reviewed auth code has a seven-day session TTL and a logout route that deletes the current session. The audit's broader account deletion, revoke-all-sessions and ownership-transfer gaps were not exhaustively re-audited in this documentation pass. | **Keep open as v1.0/lifecycle work;** do not imply current-session logout solves account/session lifecycle management. |
| 3.9 Other | Includes nonce/JWKS rotation, Origin/Fetch Metadata, environment allowlists, field-reset semantics, audit coverage, lockfile/reproducibility and maintainability observations. | **Independent verification still required.** Use as a backlog for targeted review rather than treating every item as reproduced. |

## Beta impact and proposed order

The report identifies issues that materially affect the safety of inviting real families. The current 72.5 score does not mean these findings are resolved; the score's controls 10–12 address the bounded authorization and cross-family automated evidence agreed with the owner, not every concern in this audit.

Recommended sequence before inviting Friends & Family testers:

1. **Resolve the embedded-data question immediately.** Confirm whether the payload contains real identifiable family information. If yes, remove it from the shipped bundle and assess git-history and privacy/incident implications before beta.
2. **Close the import data-integrity risk.** Remove dataset-specific matching behaviour and avoid silent same-name merges; preserve date precision and place fields, or disable/bound imports for beta with an explicit user-facing limitation.
3. **Gate registration to the intended cohort.** Use an explicit allowlist or invite-only registration model selected by the owner.
4. **Fix the API fallback.** Fail closed unless a valid environment-specific API URL is configured.
5. **Add frontend response security headers** and verify the deployed headers before beta.
6. **Complete minimum monitoring** by confirming health workflow recurrence and setting up a notification destination with a successful delivery test.
7. **Record residual limitations** in the beta notes and get explicit owner go/no-go.

The existing owner decision to conduct live user acceptance during Friends & Family UAT remains in force. This review does not reinstate exhaustive pre-UAT route replay. It does distinguish the newly identified high-impact import, embedded-data, registration and API-host risks from the role/cross-family test evidence already accepted for the beta tracker.

## Verification boundaries

- These notes are a focused source comparison, not a rerun of Claude's full static audit, dependency audit, test suite, live HTTP checks or git-history scan.
- No production resources, production database, family records, secrets or deployed configuration were accessed or changed.
- No readiness points are awarded by adding this report.
- Any code remediation should be implemented in a separate reviewed change with tests; production deployment or data operations require the existing explicit owner approval boundaries.
