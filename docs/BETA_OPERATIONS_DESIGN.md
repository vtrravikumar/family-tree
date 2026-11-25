# Beta Operations Design — Backup, Monitoring and Recovery

Status: **design proposal only**. This document records an implementation direction for the Friends & Family beta. It does not authorize creation of Cloudflare resources, production exports, secret changes, scheduled jobs, production deployments, retention/deletion rules or restore operations.

## Safety boundary

- Production Worker: `family-tree-api-production`; production D1: `vansvriksh-production`.
- Development Worker and D1 remain separate. Never use development data as a production backup.
- Production is promoted from the dedicated `production` branch. Changes merged to `main` are for development; verify branch-specific Cloudflare build/deployment behavior before any production action.
- Backups contain highly sensitive personal family information. Do not place SQL dumps, credentials, tokens, signed URLs or family records in GitHub, CI logs or issue comments.
- Any production export, restore, migration, secret/resource change, scheduled production job or cutover requires separate explicit owner approval.

## 1. Backup architecture

### Owner decision already recorded

On 2026-11-25 the owner selected **Cloudflare R2 as the preferred primary backup destination**. This approves the destination choice only. It does not approve bucket creation, a paid R2 purchase, credentials, a schedule, retention, a production export or a second provider.

### Recommended implementation shape

Prefer a dedicated, isolated **backup Worker + Cloudflare Workflow** rather than adding backup duties to the application API Worker.

1. A scheduled Workflow starts a D1 export job through Cloudflare's D1 export REST API for the explicitly configured production database ID.
2. The Workflow polls the export job until Cloudflare provides the completed dump URL.
3. It streams the SQL dump directly into a **private R2 bucket** through a bucket binding. Do not expose the bucket publicly.
4. It writes a small backup manifest containing database identity, export bookmark/time, object key, byte size, completion status and checksum where available. Do not include family content or secrets in the manifest.
5. It emits structured success/failure events. A run is not successful until the object and manifest are both persisted and independently verified.
6. Restore is a separate, manually approved process into a disposable D1 database first. Production restore/cutover remains a separate owner-approved change.

Cloudflare publishes an example of this exact D1 REST export → Workflow → R2 pattern. It uses a D1 export token as a secret and an R2 bucket binding. The official example is a simplified starting point; production implementation must add database-ID allowlisting, response validation, retry/backoff, bounded polling, checksum/size checks, manifest writes, duplicate-run protection, alerting and safe failure handling.

References:
- https://developers.cloudflare.com/workflows/examples/backup-d1/
- https://developers.cloudflare.com/d1/best-practices/import-export-data/
- https://developers.cloudflare.com/d1/reference/time-travel/

### Isolation and access controls

- Create a dedicated private bucket, provisionally named `vansvriksh-prod-backups`; name is a proposal, not a resource that exists.
- Do not configure public bucket access, custom domains, public object URLs or public listing.
- Prefer a Worker R2 bucket binding over long-lived S3 credentials in GitHub Actions. The backup Worker should have only the bucket binding it needs.
- Store the D1 export API token as a Cloudflare Worker secret, never as a plaintext `vars` value. Scope it to the single production D1 database and export capability only, if the available API token permissions permit that scope.
- The backup Worker must not expose a public endpoint that can trigger arbitrary exports. Use the Workflow schedule/manual operator controls and an allowlisted database ID.
- Limit Cloudflare dashboard/bucket access to the owner and named operators. Record who can initiate exports, read backups and perform restores.
- Use HTTPS for API and object transfer. R2 provides encryption at rest; verify current bucket encryption settings and jurisdiction requirements during provisioning.
- Rotate/revoke credentials on suspected exposure and after operator access changes.
- R2 is in the same Cloudflare account/provider as D1. It is an independent copy from D1's Time Travel history, but **not an independent provider/account disaster-recovery copy**.

Cloudflare references:
- https://developers.cloudflare.com/r2/api/tokens/
- https://developers.cloudflare.com/r2/get-started/s3/

### Object layout and retention proposal

Use non-public, timestamped keys, for example:

- `production/weekly/YYYY/MM/DD/vansvriksh-production-<timestamp>.sql`
- `production/monthly/YYYY/MM/vansvriksh-production-<timestamp>.sql`
- `production/manifests/<timestamp>.json`

The existing backup runbook proposes 8 weekly copies and 12 monthly archives. These remain **unapproved proposals**. Do not enable automatic deletion/lifecycle rules until the owner approves retention and secure-deletion requirements. Preserve the last known-good backup while rotating older copies.

A second provider remains undecided. R2 alone must not be described as off-account or multi-provider disaster recovery. The Synology NAS remains excluded until repaired and integrity-verified.

### Schedule and verification

The existing proposal is a weekly logical export, before production migrations and after material data changes, plus a monthly archive and quarterly disposable restore rehearsal. None of these cadences is approved or configured yet.

Before enabling a recurring schedule:
- Complete one owner-approved production export to R2.
- Verify object existence, non-zero size, manifest metadata, checksum if available, and that the object can be read by the authorized restore operator.
- Restore the export into a disposable D1 database.
- Reconcile schema/migrations, table counts, family/member/role records, people, relationships, identity claims and audit rows; validate representative application reads against the restored data.
- Record duration, restore result and any gaps.
- Confirm failure alert delivery and recovery steps.
- Obtain owner approval for schedule, retention, cost and any second copy.

D1 Time Travel remains the short-window recovery mechanism (7 days on the currently recorded Workers Free plan); it is not a downloadable, independently retained SQL backup.

## 2. Monitoring and alerting

### Recommended beta baseline

Use Cloudflare's built-in Workers observability first; avoid introducing a third-party monitoring vendor until there is a demonstrated need.

1. **Workers Logs:** enable and verify log ingestion for the production API Worker. Use structured JSON events and useful error context.
2. **Workers Issues:** enable failure grouping for uncaught exceptions, failed invocations, HTTP 5xx responses and error-level logs. Configure an owner notification automation with first-occurrence threshold after confirming the destination.
3. **Monitors:** add threshold alerts for repeated 5xx/error events and backup workflow failures once the required log dataset is available. Preview each query and confirm it matches only the intended Worker/events.
4. **Availability:** use a lightweight external or Cloudflare health monitor against the production API health endpoint and production frontend. Probe only health endpoints; never authenticate or fetch family content. Choose provider and notification destination before setup.
5. **Deployment:** retain GitHub Actions and Cloudflare deployment checks. Treat a preview build as a preview, not a production release. Alert on failed validation or failed production-branch deployment.
6. **Backup freshness:** alert if no successful backup manifest exists within the approved schedule window. A scheduled trigger alone is not proof of a successful backup.

Cloudflare references:
- https://developers.cloudflare.com/workers/observability/logs/workers-logs/
- https://developers.cloudflare.com/workers/observability/logs/real-time-logs/

### Logging privacy rules

Never log:
- OAuth access/ID tokens, session cookies, authorization headers, API keys or signed backup URLs.
- Family member names, email addresses, dates of birth, biographies, relationship details, imported workbook contents or SQL rows.
- Raw request/response bodies.

Prefer event name, route template, status code, duration, deployment version, a non-sensitive correlation ID and coarse failure category. Avoid stable user identifiers unless an explicit privacy review approves them. Verify redaction against real error paths before enabling broad log retention.

### Alert delivery and response

- Alerts must reach a named owner/operator, not merely appear in a dashboard.
- Test delivery with a synthetic failure/monitor test that does not touch production family data.
- Define severity:
  - Critical: production API unavailable, suspected cross-family data exposure, backup corruption or failed restore.
  - High: sustained 5xx/error spike, failed scheduled backup, missing backup beyond the approved window.
  - Informational: deployment success, isolated transient errors.
- Every critical/high alert needs a documented first response, containment step, escalation contact and evidence record.

## 3. Incident and rollback minimum

Before inviting beta users, publish a short operator runbook that covers:
- How to identify the active production release and last known-good release.
- How to stop or pause writes safely during a suspected data-integrity incident.
- How to disable compromised sessions/credentials and restrict access.
- How to select and verify a D1 Time Travel bookmark or SQL backup.
- How to rehearse restore into a disposable database and reconcile data before any production recovery.
- How to roll back application code separately from restoring data. A code rollback must not automatically run destructive database rollback migrations.
- Who can authorize production restore, cutover, account deletion and notification to affected users.
- How to record timeline, impact, actions, validation and follow-up.

No production restore or rollback is authorized by this design document.

## 4. Decisions and implementation gates

| Item | Current state | Gate to proceed |
|---|---|---|
| Primary backup destination | R2 selected by owner (2026-11-25) | Bucket/resource creation approval and cost review |
| Backup architecture | Dedicated backup Worker + Workflow proposed | Owner approval to implement |
| R2 bucket | Does not exist / not verified | Create private bucket and verify settings |
| D1 export credential | Not configured | Create least-privilege secret scoped to production D1 export |
| Backup schedule | Proposed only | Owner approves cadence and operational cost |
| Retention/deletion | Proposed only | Owner approves weekly/monthly retention and secure deletion |
| Second independent copy | Not selected | Select provider or explicitly defer |
| Restore rehearsal | Prior scratch rehearsal passed; no R2 export restore | Complete R2-to-disposable-D1 rehearsal |
| Workers Logs/Issues | Configuration and delivery not yet evidenced here | Verify production logging, privacy and alert delivery |
| Availability monitor | Not selected/configured | Select provider, health URL and alert recipient |
| Incident/rollback | Not complete | Name operators and approve runbook |

## 5. Immediate next engineering sequence

1. Resolve the Cloudflare Worker build-check failure observed on the post-merge `main` commit. Confirm whether it is a preview/build-only check and capture the actual failure reason; do not infer a production deployment from the check name.
2. Implement and test the backup Worker/Workflow against a dedicated development D1 database and development-only R2 test bucket after owner approval for those resources.
3. Review least-privilege D1 export permissions and R2 binding access; prove the backup Worker cannot export a different database or serve objects publicly.
4. Add automated tests for manifest integrity, retries, duplicate runs, partial upload failure, wrong database ID and alert emission.
5. Configure production only after the development rehearsal passes and the owner separately approves production bucket/secret/schedule/export actions.
6. Configure and test Workers Logs/Issues and health alerts without logging personal family data.
7. Update the beta readiness tracker only when operational evidence exists. This design document alone does not increase the score.

