# Friends & Family Beta — Finite Closure Plan

**Prepared:** 2026-11-25  
**Purpose:** Convert the remaining 35 points in `BETA_READINESS_TRACKER.md` into a bounded, risk-proportionate closure plan.  
**Scope:** Controlled Friends & Family beta only. This is not a v1.0 production certification.

## Ground rules

1. Keep the existing 20-control, 100-point beta score unchanged. This plan changes neither the denominator nor the current 65/100 score.
2. Do not add requirements unless a concrete Friends & Family beta safety risk is identified.
3. Evidence must be the smallest reliable demonstration that the control works. Do not create paperwork for its own sake.
4. Green CI, source review, documentation, and a preview deployment are useful evidence but do not substitute for live behaviour where live behaviour is the thing being verified.
5. No production deployment, production D1 export/restore/migration, secret change, Cloudflare resource provisioning, scheduled production job, or retention/deletion policy change without separate explicit owner approval.
6. Keep commercial v1.0 hardening and deferred product features out of this beta closure plan.

## Closure classification

| Control | Remaining points | Beta treatment | Minimum closure evidence |
|---|---:|---|---|
| 10. Route authorization and role boundaries | 2.5 | **Mandatory blocker** | Compact route/method × role allow/deny matrix for family data and privileged operations; execute meaningful negative cases in development. Record routes not applicable to family roles separately (platform Super Admin). |
| 11. Identity-claim security | 2.5 | **Mandatory blocker** | Verify requester visibility, self-review denial, cross-family claim/person IDs and competing review outcomes against development D1; production smoke check only where safely possible with approved test accounts. |
| 12. Cross-family/resource-ID isolation | 2.5 | **Mandatory blocker** | Negative tests for family, person, relationship, invitation and claim identifiers across relevant handlers. Existing person/relationship live evidence remains valid; invitation-ID live test remains deferred and must not be called passed until executed. |
| 14. Backup/recovery | 2.5 | **Mandatory blocker** | Owner-approved production SQL export to the selected private destination (R2 is preferred, not provisioned), followed by restore into disposable D1 and concise integrity reconciliation. No production restore. |
| 15. Production edge/security | 2.5 | **Mandatory blocker** | Focused production verification: allowed/disallowed CORS preflight, session cookie attributes, TLS/security headers, and confirmation errors/logs expose no credentials or family content. |
| 16. Monitoring and alerts | 5 | **Mandatory blocker — beta minimum** | Existing 15-minute API health workflow runs repeatedly for both environments. Verify actionable notification for a controlled failure. Health workflow success alone is not alert delivery. Avoid family data in telemetry. |
| 17. Privacy and lifecycle | 5 | **Lightweight beta requirement** | Short user-readable beta notice plus decisions for session/logout, invitation expiry, account access removal/deletion expectations and audit-data handling. No enterprise privacy programme. |
| 18. Support, incident and rollback | 5 | **Lightweight beta requirement** | One-page operator note naming support contact and covering suspected unauthorized access, data issue, outage, stopping invitations, preserving evidence and reverting a bad application release. Production data recovery remains separately approved. |
| 19. Intended beta account/role acceptance | 2.5 | **Mandatory blocker** | Bounded acceptance run using intended beta test accounts: Owner, Admin, Editor, Viewer; key family workflows; invitation lifecycle; direct API denials; family isolation. Production acceptance is a short smoke pass with approved test accounts. |
| 20. Beta notes and go/no-go | 5 | **Final release gate** | Publish scope/known limitations and support route. Owner reviews evidence and explicitly approves or declines invitations. A 100 score does not itself authorize launch. |

## Execution order and timebox

The target is **10–12 focused hours of hands-on work**, excluding owner response time, external service delays and remediation for a newly discovered defect. This is a planning budget, not a guarantee or a reason to waive a failed check.

| Work package | Target effort | Output |
|---|---:|---|
| A. Security/isolation evidence (10–12) | 2–3 hours | Executed compact role and cross-family negative-test matrix; defects fixed before proceeding |
| B. Backup/recovery (14) | 2 hours of operator effort | Approved export stored privately; disposable restore and basic reconciliation recorded |
| C. Production edge checks (15) | 1 hour | Concise verification record |
| D. Monitoring (16) | 1–2 hours | Repeated health checks and verified notification path |
| E. Privacy and incident essentials (17–18) | 2 hours | Short beta notice and one-page operator instructions |
| F. Acceptance and release gate (19–20) | 2 hours | Intended-account acceptance record, beta notes and owner go/no-go |

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

The source tracker records **65.0/100**, with **35.0 points remaining**. This plan does not claim any of those points have been earned. The next execution step is Work Package A: close the security and isolation evidence with a finite route/role/resource-ID matrix.
