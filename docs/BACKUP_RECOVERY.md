# D1 Backup and Recovery Runbook

Status: draft for owner approval. This document describes the current protection and a proposed operating procedure. It does not authorize a production export, restore, database change or deployment.

## Scope and production target

- Worker: `family-tree-api-production`
- D1 database: `vansvriksh-production`
- D1 database ID: configured in `workers/api/wrangler.toml` under `[env.production]`
- Development database: `vansvriksh-dev`; never use it as a substitute for a production backup.
- Production and development data must remain separate.

Backups contain personal family information. Treat SQL exports, restore files and copied databases as sensitive production data.

## Current protection and evidence

- The owner confirmed the account is on Workers Free. Cloudflare D1 Time Travel provides point-in-time recovery for the preceding seven days on this plan.
- Time Travel is always enabled for supported D1 databases; it is not a scheduled downloadable backup.
- A current production Time Travel bookmark was previously retrieved.
- A separate APAC scratch D1 restore rehearsal succeeded. Production data was not restored or modified during that rehearsal.
- A complete, independently retained production SQL export and its recurring schedule have not yet been established.
- The previous restore rehearsal validates the basic recovery capability, but it does not prove a complete production backup/restore cycle.
- The owner's Synology NAS is currently unavailable because one disk is unresponsive. It is excluded from this backup plan until the hardware issue is resolved and storage integrity is verified.

Cloudflare references:
- [D1 Time Travel and backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [D1 import and export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)

## Proposed backup policy — pending owner approval

| Layer | Proposed cadence | Proposed retention | Purpose |
|---|---|---|---|
| D1 Time Travel | Continuous, managed by Cloudflare | 7 days on current plan | Fast recovery from recent mistakes |
| Logical SQL export | Weekly, before every production migration, and after material data changes | 8 weekly copies | Independent portable backup |
| Monthly archive | Monthly export | 12 months | Longer-term recovery |
| Restore rehearsal | Quarterly, using a disposable D1 database | Keep the latest successful evidence | Verify that exports are usable |

**Proposed storage approach (not yet configured):**
- Primary: Cloudflare R2, subject to a cost, access-control and operational review.
- Independent second copy: another cloud storage provider, not yet selected.
- Synology NAS: excluded while unavailable; do not treat it as a backup destination until recovered and storage integrity is verified.

The SQL export is first created as a file by Wrangler. A separate, reviewed upload process would then place it in R2 and, if approved, copy it to the independent provider. Wrangler's D1 export command does not itself write directly to R2.

No R2 bucket, credentials, upload workflow, scheduled export or external second copy has been created. The proposed schedule, retention and storage locations are not approved policy and must not be represented as implemented.

## Manual production SQL export

Run from the repository root only after the owner explicitly approves a production export and after confirming that Wrangler is authenticated to the intended Cloudflare account.

1. Confirm the target configuration is production:
   - Config file: `workers/api/wrangler.toml`
   - Environment: `production`
   - Database name: `vansvriksh-production`
   - Database ID must match the production D1 ID in that file.
2. Choose a secure temporary destination outside the repository. Do not use the unavailable Synology NAS. The export must be moved to an approved encrypted backup location through a separately reviewed process.
3. Export the remote database:

```sh
pnpm exec wrangler d1 export vansvriksh-production \\
  --remote \\
  --env production \\
  --config workers/api/wrangler.toml \\
  --output /secure/temporary/path/vansvriksh-production-YYYYMMDD-HHmmss.sql
```

4. Confirm the command completed successfully and the file exists and is non-empty.
5. Record the UTC timestamp, database name, database ID, export result, file size and approved storage location in the backup log. Do not record credentials or put the SQL dump in Git.
6. Protect the export as production personal data. Restrict access, encrypt storage and transfer, and verify that the backup can be read only by authorized operators.

Cloudflare documents that `wrangler d1 export --remote --output` exports the schema and data to SQL. D1 exports can be imported using `wrangler d1 execute --remote --file`. Exports can temporarily affect database availability; schedule approved manual exports during a quiet period and monitor the application.

## Recovery options

### Option A — recent accidental change: D1 Time Travel

Time Travel restore overwrites the target database in place. It is a production-impacting, destructive operation.

1. Declare an incident and stop or pause application writes using an approved operational procedure.
2. Identify the desired recovery timestamp/bookmark and confirm it falls within the current seven-day retention window.
3. Retrieve and record the current production bookmark immediately before any restore.
4. Obtain explicit owner approval for the exact production restore target and timestamp/bookmark.
5. Restore only after approval. Use the production environment and verify the database name and ID one final time.
6. Preserve the `previous_bookmark` returned by the restore operation. Cloudflare documents that it can be used to undo the restore if required.
7. Verify application health, Google sign-in, family access, membership/roles, people, relationships, biographies and representative tree rendering before reopening writes.
8. Record the incident, chosen bookmark, operator, approval, validation results and any data loss window.

Example command shape only — do not execute without explicit approval:

```sh
pnpm exec wrangler d1 time-travel restore vansvriksh-production \\
  --env production \\
  --config workers/api/wrangler.toml \\
  --bookmark <approved-bookmark>
```

### Option B — older recovery or portable restore: SQL export

1. Select a known-good SQL export and verify its recorded database identity and timestamp.
2. Create or select a disposable D1 database for rehearsal. Do not point the import at production.
3. Import the SQL file into the disposable database using `wrangler d1 execute <scratch-database> --remote --file <backup.sql>`.
4. Reconcile schema, table counts, memberships, roles, people, biographies, relationship integrity and representative tree rendering.
5. If production recovery is required, prepare a separate change plan and obtain explicit owner approval before any production mutation. Prefer a reviewed restore into a new database and a separately approved cutover plan where the platform and application configuration permit it.

## Restore safety rules

- Never run a Time Travel restore against production as a test.
- Never import a backup SQL file directly into production as an exploratory action.
- Never delete the last known-good backup while replacing or rotating backups.
- Never store SQL dumps, exported personal data, API tokens or credentials in GitHub.
- Keep production backup access limited to the owner and explicitly authorized operators.
- Verify the database name and ID before every remote command; do not rely on a similar display name.
- Record the pre-restore bookmark before a Time Travel restore so the operation can be reversed if necessary.
- Do not run production export, restore, migration, cutover or destructive data changes without explicit owner approval.

## Backup log template

| Field | Value |
|---|---|
| Backup timestamp (UTC) | |
| Database name and ID | |
| Backup type (Time Travel bookmark / SQL export) | |
| Bookmark or export filename | |
| File size / export result | |
| Storage location | |
| Encryption and access check | |
| Operator | |
| Restore rehearsal date and result | |

## Decisions required before marking this control complete

- [ ] Approve the proposed weekly export and monthly archive schedule.
- [ ] Review and approve R2 as the primary restricted backup location, including cost and access controls.
- [ ] Select an independent second cloud provider, or explicitly defer the second copy.
- [ ] Approve retention periods and secure deletion procedure.
- [ ] Confirm encryption at rest and in transit for each selected storage location.
- [ ] Decide whether to implement scheduled D1-to-R2 exports using Cloudflare Workflows, with a separately approved off-account copy.
- [ ] Complete a SQL export and restore rehearsal against a disposable D1 database.
- [ ] Document the named operator and incident approval path.
- [ ] Reassess the NAS only after its hardware issue is resolved and storage integrity is verified.
