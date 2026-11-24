# Production Readiness

Vansvriksh production web and API are deployed for controlled friends-and-family verification. This checklist tracks the remaining evidence required before a formal v1.0 release; deployment alone is not release approval.

## Current state

Status checked 2026-11-24.

- Google sign-in, family membership, Owner/Admin/Editor/Viewer roles, identity claims and platform Super Admin are implemented.
- Production API is deployed at `https://api.vansvriksh.vtrrk.in`, bound to the separate `vansvriksh-production` D1 database. The owner verified the health response reports `environment: production` and `database: connected`.
- Production web is deployed as the separate Cloudflare Pages project `vansvriksh-web-production`; `vansvriksh.vtrrk.in` is attached to it. The Pages production branch is `production`, and the build uses the production API URL. Google sign-in and the shared sample family were confirmed by the owner.
- Development remains separate: `dev.vansvriksh.vtrrk.in` uses the dev Pages project and `api-dev.vansvriksh.vtrrk.in` uses the dev Worker/database.
- All ten D1 migrations, `0001`–`0010`, have been applied to the new production database. The shared fictional sample is available there. On 2026-11-23, Wrangler returned a current Time Travel bookmark for production D1. The owner confirmed the account is on Workers Free, which provides 7-day D1 Time Travel retention. A separate APAC scratch D1 restore drill successfully restored a test row from `after-restore` to `before-restore`; production data was untouched, and the temporary database was deleted after verification. The owner has confirmed family creation and workbook export/import work in production. Detailed reconciliation of people, biographies, relationships, memberships/roles and rendered tree integrity remains unverified.
- PR #46 made the preview banner follow the configured API host and deployed successfully to production. PR #47 is open to sync the change from `production` to `main`.
- M3.3 was merged in PR #41. The Worker suite has 54 tests covering primary role and route boundaries. PR #50 adds mocked cross-family relationship and member-ID regressions. The owner has now confirmed that the role and invitation flows have been tested successfully. Exhaustive sensitive-route authorization, cross-family tampering and identity-claim edge-case evidence remain separate readiness items. PR #54 is merged to `main` and adds GitHub validation for production-branch changes; the workflow must also be present on `production` for PRs targeting that branch to receive those checks.
- A read-only development D1 inventory on 2026-11-22 found three private family records; two share the same display name. Any future migration must identify families by stable ID and verify owner/membership, not rely on names alone.
- Initial friends-and-family beta data plan: start with a clean production D1 database and leave development data in development. Users can export a selected family from development and import it into a private production family. No bulk development-to-production migration is planned.
- Current checklist progress: 13 of 27 items complete (48%). This is the completion of tracked readiness actions, not a claim that every production risk is closed. The owner has since confirmed family creation and workbook export/import in production; the deeper selected-family data-integrity reconciliation remains open.
- Production web and API are live for controlled verification. A formal `v1.0` release is not yet approved or tagged. Backup access controls and operating procedure, deeper authorization and identity-claim edge-case checks, import/export verification, operational alerts, privacy/session/audit retention decisions and rollback documentation remain open. The owner-confirmed role and invitation flows are recorded as tested.
- PR #49 was merged to `production` as commit `61fcb1b`. It adds a branch-specific build guard requiring an HTTPS `VITE_API_URL` and rejecting the development API host. GitHub typecheck, tests and build passed, and the owner confirmed the Cloudflare Pages production deployment is green.
- PR #51 makes family creation available to accounts viewing only the shared sample while preserving the sample's read-only role. PR #53 preserves biographies through workbook export/import and adds API regression coverage. Both merged to `production`; the owner has confirmed family creation and workbook export/import work in production. Full record reconciliation remains pending. The earlier PR #52 was closed as superseded.

## Release stages

The production URL and API are live, but Friends & Family invitations should wait until the safety gate below is complete. The detailed checkboxes remain the source of truth and the 13/27 completion count.

### Before Friends & Family beta

- Remove the production build's development API fallback and make missing production configuration fail closed. The branch-specific guard is merged in PR #49, and the owner confirmed the Cloudflare Pages production deployment is green. The source fallback remains for development and preview builds.
- [x] Protect data: Workers Free D1 Time Travel retention is 7 days; a disposable APAC D1 restore rehearsal passed, and the scratch database was deleted.
- [x] Owner-confirmed role and invitation flows have been tested successfully.
- Run deeper positive and negative authorization checks for every sensitive route, identity claims and cross-family data isolation.
- [x] Confirm family creation and workbook export/import are usable in production.
- [ ] Reconcile a selected-family transfer across people, biographies, relationships, ownership, roles and tree rendering.
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
- [ ] Complete exhaustive Owner/Admin/Editor/Viewer authorization tests for every sensitive API route. The 54 Worker tests cover primary route boundaries, including cross-family relationship and member-ID tampering regressions added in PR #50; these local mocks do not exercise every route against live development D1.
- [ ] Verify remaining security edge cases against development D1: family ID/person ID tampering, pending identity claims, invitation email mismatch, expiry/revocation and single-use acceptance.
- [x] Implement Platform Super Admin import/export APIs that require a reason, target one family, and record a platform audit event. The Super Admin download format is JSON; no import preview or validation stage exists yet.
- [x] Require explicit `SUPER_ADMIN_EMAIL` configuration before bootstrapping the platform role; configure it separately in each intended environment.
- [x] Provide an audited, server-authorized Platform Super Admin family export. Hiding the browser workbook export button for Editor/Viewer is a usability guard because all family members can read family data through the API.
- [x] Add fixed-window rate limits for Google sign-in and invitation creation/acceptance. Review thresholds against development traffic before production.
- [ ] Approve invitation, account deletion, session revocation, privacy retention and audit-log retention policies. Source review found seven-day sessions and invitations, current-session-only logout, no account-deletion or revoke-all-sessions flow, and no cleanup/retention policy for expired sessions, invitations or audit logs; details are in [SECURITY.md](SECURITY.md).
- [ ] Confirm API errors and operational logs never expose session tokens, invitation codes or family data unnecessarily. Source review found no explicit Worker console logging and generic application errors; verify the deployed Worker and platform logs before launch.

### Operations and environments

- [x] Complete and verify the production Wrangler environment.
- [x] Deploy and verify the separate production Pages project `vansvriksh-web-production`; attach `vansvriksh.vtrrk.in` to it while keeping the dev hostname on the dev project. Production Worker `family-tree-api-production` uses the separate production D1, `APP_ENV=production`, configured Super Admin identity and production origin; `api.vansvriksh.vtrrk.in` is active and its health response reports the production environment and connected database.
- [x] Remove development-only configuration and credentials from every production deployment path; verify that missing production configuration fails closed. PR #49 adds the production build guard, and the owner confirmed the production Pages deployment is green. The development fallback remains available for development and preview builds.
- [x] Set and verify `VITE_API_URL` separately for development and production Pages deployments: development uses `https://api-dev.vansvriksh.vtrrk.in`; production uses `https://api.vansvriksh.vtrrk.in`. The owner confirmed successful production Google sign-in.
- [ ] Finish verifying production origin allowlist, cookie behavior, TLS, security headers, CORS preflight and health monitoring. The production health endpoint, domain/SSL, database connection and Google sign-in have been confirmed; preflight, headers and ongoing monitoring still need evidence.
- [ ] Establish backup frequency, retention, access controls and a tested restore procedure for D1.
- [ ] Add actionable error reporting and operational alerts without logging personal data or credentials.

### Data migration and launch

- [x] Choose a clean production database for the initial beta; keep development data in development and support user-selected transfer through family export/import.
- [x] Apply all ten migrations (`0001`–`0010`) to the clean production D1 database; the owner confirmed each migration completed.
- [ ] Verify production schema constraints and indexes against the expected schema.
- [x] Verify production D1 recovery readiness: a current production Time Travel bookmark was returned, and a disposable APAC D1 restore rehearsal recovered the probe row from `after-restore` to `before-restore`. No live production restore was run.
- [ ] Verify a development family can be exported and imported into a fresh production family with all people, biographies, relationships, ownership and roles intact. Basic family creation and workbook export/import in production are owner-confirmed; end-to-end transfer integrity still needs evidence.
- [ ] Reconcile the sample and test import in production for record counts, foreign keys, memberships, roles, relationship integrity and representative tree renderings.
- [ ] Run end-to-end acceptance with the three intended test users and their assigned roles.
- [x] Confirm GitHub validation and Cloudflare Pages checks are green for PR #54; PR #54 was merged to `main` on 2026-11-23. The owner confirms Cloudflare is green. A separate Worker build failure was still present in the PR-associated status snapshot and should be reconciled before claiming every Worker build check is green.
- [ ] Complete and publish the v1.0 release notes.
- [ ] Review and document a production rollback plan.
- [ ] Obtain explicit approval for a formal v1.0 release.

## Release gate

The production service is live for controlled verification. A formal v1.0 release remains blocked until the remaining required items above have evidence, the migration and restore rehearsal succeed, release notes and rollback guidance are complete, and the owner explicitly approves the release.
