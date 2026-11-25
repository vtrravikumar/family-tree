# Production Readiness

Vansvriksh production web and API are deployed for controlled friends-and-family verification. This checklist tracks the remaining evidence required before a formal v1.0 release; deployment alone is not release approval.

## Current state

Status checked 2026-11-25.

- Google sign-in, family membership, Owner/Admin/Editor/Viewer roles, identity claims and platform Super Admin are implemented.
- Production API is deployed at `https://api.vansvriksh.vtrrk.in`, bound to the separate `vansvriksh-production` D1 database. The owner verified the health response reports `environment: production` and `database: connected`.
- Production web is deployed as the separate Cloudflare Pages project `vansvriksh-web-production`; `vansvriksh.vtrrk.in` is attached to it. The Pages production branch is `production`, and the build uses the production API URL. Google sign-in and the shared sample family were confirmed by the owner.
- Development remains separate: `dev.vansvriksh.vtrrk.in` uses the dev Pages project and `api-dev.vansvriksh.vtrrk.in` uses the dev Worker/database.
- All ten D1 migrations, `0001`–`0010`, have been applied to the new production database. The shared fictional sample is available there. On 2026-11-23, Wrangler returned a current Time Travel bookmark for production D1. The owner confirmed the account is on Workers Free, which provides 7-day D1 Time Travel retention. A separate APAC scratch D1 restore drill successfully restored a test row from `after-restore` to `before-restore`; production data was untouched, and the temporary database was deleted after verification. The owner has confirmed family creation and workbook export/import work in production. The owner has also completed a development-to-production family transfer and confirmed that the imported family works as desired.
- PR #46 made the preview banner follow the configured API host and deployed successfully to production. PR #47 was merged to `main`.
- M3.3 was merged in PR #41. The Worker unit suite has since grown beyond the original 54-test baseline and now covers the principal role boundaries, invitation state transitions, identity-claim races, write-time authorization, relationship integrity, import validation and platform-admin paths. PRs #59–#70 and #73 are merged to `main`; PR #50's cross-family relationship/member-ID regressions remain part of the test evidence. The owner confirmed functional role and invitation flows. Exhaustive live sensitive-route authorization, broader cross-family tampering and identity-claim edge-case acceptance remain separate readiness items. PR #54 is merged to `main` and adds GitHub validation for production-branch changes; confirm the workflow exists on `production` for PRs targeting that branch.
- A read-only development D1 inventory on 2026-11-22 found three private family records; two share the same display name. Any future migration must identify families by stable ID and verify owner/membership, not rely on names alone.
- Initial friends-and-family beta data plan: start with a clean production D1 database and leave development data in development. Users can export a selected family from development and import it into a private production family. No bulk development-to-production migration is planned.
- Current checklist progress: 15 of 27 items complete (56%). This is the completion of tracked readiness actions, not a claim that every production risk is closed. The owner has confirmed the selected-family development-to-production transfer and its resulting data/tree behavior.
- Production web and API are live for controlled verification. A formal `v1.0` release is not yet approved or tagged. Backup access controls and operating procedure, deeper authorization and identity-claim edge-case checks, import/export verification, operational alerts, privacy/session/audit retention decisions and rollback documentation remain open. The owner-confirmed role and invitation flows are recorded as tested.
- PR #49 was merged to `production` as commit `61fcb1b`. It adds a branch-specific build guard requiring an HTTPS `VITE_API_URL` and rejecting the development API host. GitHub typecheck, tests and build passed, and the owner confirmed the Cloudflare Pages production deployment is green.
- PR #51 makes family creation available to accounts viewing only the shared sample while preserving the sample's read-only role. PR #53 preserves biographies through workbook export/import and adds API regression coverage. Both merged to `production`; the owner has confirmed family creation and workbook export/import work in production. The owner has since confirmed a selected development-family transfer into production works as desired. The earlier PR #52 was closed as superseded.

## Release stages

The production URL and API are live, but Friends & Family invitations should wait until the safety gate below is complete. The detailed checkboxes remain the source of truth. The last recorded production-readiness count is 15/27 (56%); it is separate from the beta tracker score and has not been recalculated in this documentation refresh.

### Before Friends & Family beta

- Remove the production build's development API fallback and make missing production configuration fail closed. The branch-specific guard is merged in PR #49, and the owner confirmed the Cloudflare Pages production deployment is green. The source fallback remains for development and preview builds.
- [x] Protect data: Workers Free D1 Time Travel retention is 7 days; a disposable APAC D1 restore rehearsal passed, and the scratch database was deleted.
- [x] Owner-confirmed role and invitation flows have been tested successfully.
- Run deeper positive and negative authorization checks for every sensitive route, identity claims and cross-family data isolation.
- [x] Confirm family creation and workbook export/import are usable in production.
- [x] Owner-confirmed selected-family development-to-production transfer: people, biographies, relationships, memberships/roles and rendered family tree work as desired.
- Verify CORS, cookies, TLS, security headers and safe logging; enable basic actionable alerts.
- Decide and document beta privacy/session/invitation/audit retention, support contact and rollback steps.

### During Friends & Family beta

- Invite a small, known group; keep production and development data separate.
- Ask users to exercise the sample and selected-family import/export flows; do not bulk-copy development data.
- Monitor failures and feedback, prioritize data-loss, privacy and access-control issues, and tune rate limits from observed traffic.

### Before full v1.0 production readiness

- Finish extended authorization, identity-claim race/uniqueness, audit coverage and role-matrix testing.
- Complete account/session lifecycle and retention cleanup decisions and implementation.
- Finish import preview, validation, duplicate handling and historical date edge-case work.
- Close monitoring, backup/restore, release notes, rollback and formal approval gates.

## Remaining beta and v1.0 readiness

### Product and authorization

- [x] Implement and deploy the shared fictional sample family to development with Viewer-only access, server-enforced read-only behavior, personal remove/dismissal, and export/import into a private family. The same fictional sample is now available in the clean production database through migration 0010.
- [x] Owner-confirmed functional role and invitation flows have been tested successfully.
- [ ] Complete exhaustive Owner/Admin/Editor/Viewer authorization tests for every sensitive API route. The current Worker unit suite covers principal route boundaries and write-time guards, including cross-family relationship/member-ID tampering regressions; local mocks do not exercise every route against the intended beta environment.
- [ ] Verify remaining security edge cases against the intended beta environment: family/person/relationship/invitation/claim ID tampering, pending identity-claim requester visibility and self-review denial, invitation email mismatch, expiry/revocation and single-use acceptance. Local unit and D1 integration tests now cover important race and rollback cases, but are not live acceptance.
- [x] Implement Platform Super Admin import/export APIs that require a reason, target one family, and record a platform audit event. The Super Admin download format is JSON; no import preview or validation stage exists yet.
- [x] Require explicit `SUPER_ADMIN_EMAIL` configuration before bootstrapping the platform role; configure it separately in each intended environment.
- [x] Provide an audited, server-authorized Platform Super Admin family export. Hiding the browser workbook export button for Editor/Viewer is a usability guard because all family members can read family data through the API.
- [x] Add fixed-window rate limits for Google sign-in and invitation creation/acceptance. Review thresholds against development traffic before production.
- [ ] Approve invitation, account deletion, session revocation, privacy retention and audit-log retention policies. Source review found seven-day sessions and invitations, current-session-only logout, no account-deletion or revoke-all-sessions flow, and no cleanup/retention policy for expired sessions, invitations or audit logs; details are in [SECURITY.md](SECURITY.md).
- [ ] Confirm API errors and operational logs never expose session tokens, invitation codes or family data unnecessarily. Current Worker source returns generic internal errors and has no explicit application console logging; verify deployed Worker/platform logs and any platform-level telemetry before launch.

### Operations and environments

- [x] Complete and verify the production Wrangler environment.
- [x] Deploy and verify the separate production Pages project `vansvriksh-web-production`; attach `vansvriksh.vtrrk.in` to it while keeping the dev hostname on the dev project. Production Worker `family-tree-api-production` uses the separate production D1, `APP_ENV=production`, configured Super Admin identity and production origin; `api.vansvriksh.vtrrk.in` is active and its health response reports the production environment and connected database.
- [x] Remove development-only configuration and credentials from every production deployment path; verify that missing production configuration fails closed. PR #49 adds the production build guard, and the owner confirmed the production Pages deployment is green. The development fallback remains available for development and preview builds.
- [x] Set and verify `VITE_API_URL` separately for development and production Pages deployments: development uses `https://api-dev.vansvriksh.vtrrk.in`; production uses `https://api.vansvriksh.vtrrk.in`. The owner confirmed successful production Google sign-in.
- [ ] Finish verifying production origin allowlist, cookie behavior, TLS, security headers, CORS preflight and health monitoring. The production health endpoint, domain/SSL, database connection and Google sign-in have been confirmed; preflight, headers and ongoing monitoring still need evidence.
- [ ] Approve and operationalize D1 backup frequency, destination, retention and access controls, then complete the owner-approved SQL export and disposable restore rehearsal. PR #58 added `docs/BACKUP_RECOVERY.md`; it is a runbook, not configured automatic backup infrastructure.
- [ ] Add actionable error reporting and operational alerts without logging personal data or credentials.

### Data migration and launch

- [x] Choose a clean production database for the initial beta; keep development data in development and support user-selected transfer through family export/import.
- [x] Apply all ten migrations (`0001`–`0010`) to the clean production D1 database; the owner confirmed each migration completed.
- [ ] Verify production schema constraints and indexes against the expected schema.
- [x] Verify production D1 recovery readiness: a current production Time Travel bookmark was returned, and a disposable APAC D1 restore rehearsal recovered the probe row from `after-restore` to `before-restore`. No live production restore was run.
- [x] Verify a development family can be exported and imported into a fresh production family with people, biographies, relationships, memberships/roles and tree behavior intact; the owner completed this transfer and confirmed it works as desired.
- [ ] Reconcile the sample and test import in production for record counts, foreign keys, memberships, roles, relationship integrity and representative tree renderings.
- [ ] Run end-to-end acceptance with the three intended test users and their assigned roles.
- [x] PR #54 was merged to `main` on 2026-11-23 and the owner confirmed its Cloudflare Pages deployment. For subsequent security/documentation work, PRs #59–#70 and #73–#76 have merged to `main`; PRs #75 and #76 each passed validation and applicable Workers/Pages checks (the development deployment workflow was skipped by configuration). This evidence is not a substitute for the production-branch workflow check or live beta acceptance.
- [ ] Complete and publish the v1.0 release notes.
- [ ] Review and document a production rollback plan.
- [ ] Obtain explicit approval for a formal v1.0 release.

## Release gate

The production service is live for controlled verification. A formal v1.0 release remains blocked until the remaining required items above have evidence, the migration and restore rehearsal succeed, release notes and rollback guidance are complete, and the owner explicitly approves the release.


## Friends & Family beta update — 2026-11-25

The separate evidence-based beta tracker records 65.0/100 as of 2026-11-25. This is not the same denominator as the last recorded 15/27 production-readiness action count above; neither score by itself authorizes a release.

- PRs #59–#70 and #73 are merged to `main`. They cover identity-claim review/unlink/create, member roster and role authorization, invitation creation/revocation, person profile/lifecycle/create, relationship mutations, family deletion and transactional workbook import.
- These merged changes include local-D1 integration tests for key write paths, race handling, uniqueness constraints and import rollback. PR #68 applies prevalidated people, relationships and audit records in one authorized D1 batch. Passing CI and local D1 tests establish repository evidence, not production promotion or live role-matrix acceptance.
- PR #58 is merged and adds `docs/BACKUP_RECOVERY.md`. It is an operating runbook; backup destination, schedule, retention and access controls remain pending owner approval. No production SQL export or restore has been performed.
- PR #71 (route-authorization findings), #72 (beta acceptance checklist), #75 (beta readiness evidence refresh) and #76 (route authorization audit refresh) are merged to `main`.
- The refreshed route audit inventories current Worker routes and test evidence. It keeps exhaustive live role/family-isolation tests, deployed import/export reconciliation, edge-security evidence, monitoring/alerts, privacy/retention, support/rollback and explicit go/no-go outstanding.

- PR #86 records live development Viewer API acceptance: identity capability flags, member-roster denial and invitation-list denial. PR #87 records live development Editor API acceptance: member roster access, invitation-list/create denial, people/relationship reads, person create/update and relationship create/delete, followed by cleanup to the original record counts. These are scoped development checks, not production acceptance or a complete role matrix.
- Additional development cross-family checks returned 404 for a foreign-family person ID and relationship ID when substituted into the other family's mutation routes. Invitation-ID live isolation was explicitly deferred; do not mark it as passed. Automated member-ID substitution coverage and identity-claim self-review tests remain repository evidence, not live acceptance.

- On 2026-11-25, the owner completed development UI smoke checks for Owner, Admin, Editor and Viewer: Owner member/invitation management, Admin roster/invitation access with protected Owner/self controls, Editor role transition/access, and Viewer read-only viewing. This is development-only UI evidence; it does not close the direct API authorization matrix or production acceptance items. The detailed evidence and limitations are recorded in `docs/BETA_ACCEPTANCE_CHECKLIST.md` and `docs/BETA_READINESS_TRACKER.md`.

No production deployment, production D1 export/restore/migration, secrets change or production-branch update was performed as part of these documentation changes. Production promotion and opening the beta require separate explicit owner approval.
