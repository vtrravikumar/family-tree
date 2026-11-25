# Friends & Family Beta — Finite Closure Plan

**Prepared:** 2026-11-25  
**Latest baseline:** 2026-11-25  
**Purpose:** Close the remaining 12.5 beta-gate points in `BETA_READINESS_TRACKER.md` with bounded, risk-proportionate evidence. Control 14's remaining 2.5 points are tracked separately in the production backlog.  
**Scope:** Controlled Friends & Family beta only. This is not a v1.0 production certification.

## Ground rules

1. Keep the existing 20-control, 100-point beta score unchanged. The evidence score is **87.5/100**. Beta-gate readiness is **87.5/97.5 (89.7%)**, with **10 beta-gate points remaining**; Control 14's remaining 2.5 points are excluded and tracked in the production backlog.
2. Do not add requirements unless a concrete Friends & Family beta safety risk is identified.
3. Evidence must be the smallest reliable demonstration that the control works. Do not create paperwork for its own sake.
4. Green CI, source review, documentation and preview deployment are useful evidence, but do not substitute for live behaviour where live behaviour is the thing being verified.
5. No production deployment, production D1 export/restore/migration, secret change, Cloudflare resource provisioning, scheduled production job or retention/deletion policy change without separate explicit owner approval.
6. Keep commercial v1.0 hardening and deferred product features out of this beta closure plan.

## Closure classification

Controls 10–12 are complete in the source tracker based on route/source review and automated unit/local-D1 integration evidence. The agreed automated-test-first approach means these cases do not need a duplicate live-environment replay before UAT. Defects reported during UAT still require triage and regression coverage.

| Control | Remaining points | Beta treatment | Minimum closure evidence |
|---|---:|---|---|
| 14. Backup/recovery | 2.5 | **Production backlog — not a beta blocker** | Retain `docs/BACKUP_RECOVERY.md`. After beta, obtain separate approvals for storage, access, schedule, retention and export/restore rehearsal. No production operation is authorized by this deferral. Excluded from beta-gate denominator. |
| 15. Production edge/security | 0 | **Complete** | Production TLS/CORS/health/header workflow passed. Source review covers secure cookie attributes and generic API errors. On 2026-11-25, a production invocation detail was reviewed: cookie value redacted, no request/response body or credentials/family content present. IP/geolocation metadata is visible; retention/minimization remains under Control 17. |
| 16. Monitoring and alerts | 0 | **Complete** | PR #101 merged. Normal monitor run #2 succeeded for dev/prod; controlled failure run #3 failed the health job intentionally and notification job succeeded, creating assigned issue #103. A second controlled run reused the alert (no duplicate); test issue closed after verification. [Run #3](https://github.com/vtrravikumar/family-tree/actions/runs/45599198715), [issue #103](https://github.com/vtrravikumar/family-tree/issues/103). |
| 17. Privacy and lifecycle | 2.5 | **Partial — lightweight beta requirement** | Owner approved manual owner-reviewed account-deletion handling and 90-day D1 audit_logs retention on 2026-11-25. Scheduled cleanup implementation/tests are in PR #118; deployment and first scheduled-run evidence plus final participant-facing wording approval remain. No self-service account-deletion endpoint is claimed. |
| 18. Support, incident and rollback | 2.5 | **Partial — lightweight beta requirement** | Support route and incident/rollback instructions are documented in PRs #102/#109; PR #110 confirms account/family-deletion request email. Remaining: owner review/approval of the participant-facing note. Production data recovery remains separately approved. |
| 19. Intended beta account/role acceptance | 0 | **Complete** | Owner confirmed intended account/role acceptance has already been checked and confirmed, including Owner, Admin, Editor and Viewer. Existing automated regressions cover role boundaries, invitations, identity claims and family isolation. Any future UAT defects remain subject to normal triage. |
| 20. Beta notes and go/no-go | 5 | **Final release gate** | Publish scope/known limitations and support route. Owner reviews evidence and explicitly approves or declines invitations. A 100 score does not itself authorize launch. |

## Execution order and timebox

The target is **7–9 focused hours of hands-on work**, excluding owner response time, external service delays and remediation for a newly discovered defect. This is a planning budget, not a guarantee or a reason to waive a failed check.

| Work package | Target effort | Output |
|---|---:|---|
| A. Production edge/log review (15) | 1 hour | Concise verification record |
| B. Privacy and incident essentials (17–18) | 2 hours | Short beta notice and one-page operator instructions |
| C. Beta notes and release gate (20) | 1 hour | Beta notes and owner go/no-go |

If a critical check fails, stop that work package, fix the underlying issue and rerun the relevant test. Do not lower the evidence standard or mark a control complete to stay within the timebox.

## Deliberately out of scope for this beta

- Full commercial v1.0 certification or compliance programme.
- Multi-provider disaster recovery. R2 is the preferred primary destination only; a second provider is not a beta prerequisite unless the owner decides the risk requires it.
- Sophisticated observability dashboards or a third-party monitoring vendor. Minimum is detection plus a verified notification path.
- Automated production backup scheduling, retention deletion rules or recurring workflows before separate approval of resource creation, cost, access, cadence and retention.
- Exhaustive penetration testing beyond focused authorization, isolation and edge checks.
- Deferred product features such as photo upload, full-tree presentation export and advanced collaboration.

## Owner approvals and safety boundaries

The owner selected Cloudflare R2 as the preferred primary backup destination on 2026-11-25. That is a destination preference only. Before bucket creation, paid resources, credentials/secrets, production export, schedule, retention rule or restore operation, obtain explicit approval for that exact action.

Use development tests and disposable D1 restore rehearsals wherever they can prove the required behaviour without touching production data. All production operations remain separately approved.

## Completion and scorekeeping

- Update the original tracker only when the minimum closure evidence above exists and is reviewed.
- Award the remaining points only when the stated evidence is complete; do not award credit for merely starting work.
- Link concise evidence (test report, workflow run, configuration capture or owner acceptance), not lengthy narrative.
- Keep blockers visible if an owner decision or approval is outstanding.
- When all controls are evidenced, request the owner's explicit Friends & Family beta go/no-go. 100/100 is necessary under the current scoring model but is not sufficient authorization to invite users.

## Current baseline

The source tracker records an evidence score of **87.5/100**. Beta-gate readiness is **87.5/97.5 (89.7%)**, with **10 beta-gate points remaining**. Control 14's remaining 2.5 points are explicitly excluded from the beta gate and moved to the production backlog. Controls 15 (production edge/security), 16 (monitoring/alerts) and 19 (intended account/role acceptance) are complete. The remaining sequence is privacy/account-deletion and support-note approvals, then beta notes and the explicit beta go/no-go.


## Intended-account acceptance closure — 2026-11-25

The owner confirmed control 19 is already checked and complete. No further role acceptance campaign is required; close control 19 at 5/5. The remaining release gate is control 20, alongside beta-gate items 15, 17 and 18. Control 14 is production backlog, not a beta blocker.


## Backup/recovery scope decision — 2026-11-25

The owner confirmed backup/recovery is not a blocker for the bounded Friends & Family beta. Control 14 remains partially evidenced at 2.5/5 for transparency, but its remaining 2.5 points are excluded from the beta-gate denominator and moved to the production backlog. The runbook remains available for later production-readiness work. This decision does not mark backup/recovery complete or authorize R2 provisioning, production export/restore, secrets, schedules or retention changes.


## Production invocation-log review — 2026-11-25

Control 15 was closed after the owner reviewed a production Cloudflare invocation detail for `GET /v1/families/sample-family-v1/identity`. The cookie header value was redacted; the displayed event contained no request/response body, session token, invitation code or family-record content. It did expose client IP and approximate geolocation/connection metadata. Log retention and data-minimization decisions remain open under Control 17 and are not treated as a reason to leave Control 15 partial.
