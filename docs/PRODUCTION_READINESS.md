# Production Readiness

Vansvriksh is still a development deployment. This checklist separates implemented foundations from evidence still required before a production launch. Do not treat a passing development deployment as production approval.

## Current state

- Google sign-in, family membership, Owner/Admin/Editor/Viewer roles, identity claims and a platform Super Admin are implemented.
- The `vansvriksh-production` D1 database was created and all ten migrations, including the shared sample-family seed, were applied on 2026-11-22. Production Worker deployment is pending: Wrangler failed to create the new `family-tree-api-production` script because the current token lacks the Workers product-level Admin access Cloudflare requires for creating Workers. The production Worker Custom Domain and separate production Pages frontend are not deployed/configured.
- Development routing was verified on 2026-11-22: the Worker Custom Domain `api-dev.vansvriksh.vtrrk.in` is deployed; `dev.vansvriksh.vtrrk.in` and `vansvriksh.vtrrk.in` are both active custom domains with SSL on the same `vansvriksh-web-dev` Pages project. The owner confirmed Google sign-in and family loading from the development D1 database at the dev hostname. The branded hostname is therefore still development; move it to a separate production Pages project before production launch.
- Keep `vansvriksh-web-dev.pages.dev` and `dev.vansvriksh.vtrrk.in` as development hosts paired with `api-dev.vansvriksh.vtrrk.in`. The production web host is `vansvriksh.vtrrk.in` and proposed API is `api.vansvriksh.vtrrk.in`. `api.vtrrk.in` is in use by TweetPilot and must not be repurposed. Any later TweetPilot move to `api.tweetpilot.vtrrk.in` is a separate migration.
- M3.3 was merged in PR #41. Its CI passed and the Worker was deployed to development; the development health endpoint returned 200 and unauthenticated family/platform data requests returned 401. Authenticated live D1 authorization and invitation lifecycle tests remain outstanding. No production deployment was performed.
- PR #43 added the shared fictional sample family. CI run #280 passed; D1 migration `0010_shared_sample_family.sql` and the Worker deployment both completed successfully. The development health endpoint reports `environment: development` and `database: connected`. The sample appears for existing users; this was confirmed by the owner on 2026-11-22.
- Migrations `0008_invitation_actor_audit.sql`, `0009_api_rate_limits.sql`, and `0010_shared_sample_family.sql` are applied to the development D1 database. Authenticated live authorization and invitation lifecycle tests against D1 remain outstanding.
- Current checklist progress: 9 of 24 items complete (38%). The checklist now separately records the applied production migrations and verified development path; it measures completed readiness work, not a launch estimate. Production remains unavailable until its environment, backup/recovery process, and release evidence are in place.
- The Worker authorization suite has 48 tests, including member-role/removal boundaries, family and relationship permissions, invitation lifecycle checks, platform-admin separation, sample-family protections, and production origin/identity isolation. Authenticated live D1 authorization still needs development verification.
- A read-only development D1 inventory on 2026-11-22 found three private family records; two share the same display name. Migration reconciliation must identify families by stable ID and verify owner/membership, not rely on names alone.
- Initial friends-and-family beta data plan: start with a clean production D1 database and leave development data in development. Users can export a selected family from development and import it into a private production family when they choose. No bulk development-to-production migration is planned for the initial beta.
- No production data migration, backup, rollback or launch has been performed or approved.

## Required before production

### Product and authorization

- [x] Implement and deploy the shared fictional sample family to development with Viewer-only access, server-enforced read-only behavior, personal remove/dismissal, and export/import into a private family. Production availability will follow when a production environment is configured.
- [ ] Complete exhaustive Owner/Admin/Editor/Viewer tests for every sensitive API route. The 46 local Worker tests cover primary route boundaries; local mocks do not exercise the live development D1 database.
- [ ] Test family ID/person ID tampering, pending claims, invitation email mismatch, expiry/revocation and single-use acceptance against the development D1 database.
- [x] Implement Platform Super Admin import/export APIs that require a reason, target one family, and record a platform audit event. The Super Admin download format is JSON; no import preview or validation stage exists yet.
- [x] Require explicit `SUPER_ADMIN_EMAIL` configuration before bootstrapping the platform role; configure it separately in each intended environment.
- [x] Provide an audited, server-authorized Platform Super Admin family export. Hiding the browser workbook export button for Editor/Viewer is a usability guard because all family members can read family data through the API.
- [x] Add fixed-window rate limits for Google sign-in and invitation creation/acceptance. Review thresholds against development traffic before production.
- [ ] Approve invitation, account deletion, session revocation, privacy retention and audit-log retention policies. Source review found seven-day sessions and invitations, current-session-only logout, no account-deletion or revoke-all-sessions flow, and no cleanup/retention policy for expired sessions, invitations or audit logs; details are in [SECURITY.md](SECURITY.md).
- [ ] Confirm API errors and operational logs never expose session tokens, invitation codes or family data unnecessarily. Source review found no explicit Worker console logging and generic application errors; verify the deployed Worker and platform logs before launch.

### Operations and environments

- [x] Activate and verify the development web/API path: `api-dev.vansvriksh.vtrrk.in` Worker and `dev.vansvriksh.vtrrk.in` Pages custom domain are active; the owner confirmed Google sign-in and family records from dev D1. The branded hostname is also attached to this dev Pages project and is not production.
- [ ] Complete and verify the production Wrangler environment. PR #44 defines the production Worker, D1 binding, `APP_ENV=production`, Google client ID, Super Admin email and production-only origin. Wrangler could not create the new `family-tree-api-production` Worker with the current edit-only token; Cloudflare requires Workers product-level Admin to create a Worker. After the script exists, configure and verify `api.vansvriksh.vtrrk.in` as a production Worker Custom Domain and verify runtime settings.
- [ ] Remove development-only configuration and credentials from every production deployment path; verify the deployed `APP_ENV` is production.
- [x] Set and verify the development Pages build variable `VITE_API_URL=https://api-dev.vansvriksh.vtrrk.in`; the owner confirmed sign-in and dev D1 family loading after the Pages deployment.
- [ ] Create/use a separate production Pages project for `vansvriksh.vtrrk.in` and set `VITE_API_URL=https://api.vansvriksh.vtrrk.in`. Never let a production build use a development API.
- [ ] Verify the production origin allowlist, cookie behavior, TLS, security headers, CORS preflight and health monitoring.
- [ ] Establish backup frequency, retention, access controls and a tested restore procedure for D1.
- [ ] Add actionable error reporting and operational alerts without logging personal data or credentials.

### Data migration and launch

- [x] Choose a clean production database for the initial beta; keep development data in development and support user-selected transfer through family export/import.
- [x] Apply all ten migrations to the empty production D1 database; migration `0010_shared_sample_family.sql` also seeded the shared sample family.
- [ ] Verify production constraints, indexes and a tested backup/restore recovery procedure.
- [ ] Verify that a selected family can be exported from development and imported into a fresh production family without losing people, relationships, ownership or roles.
- [ ] Reconcile the sample and test import in production for record counts, foreign keys, memberships, roles, relationship integrity and representative tree renderings.
- [ ] Run end-to-end acceptance with the three intended test users and their assigned roles.
- [ ] Confirm current CI is green, complete release notes, review the rollback plan and obtain explicit production launch approval.

## Release gate

Production launch remains blocked until every required item above has evidence recorded, CI passes on the exact release candidate, the migration and restore rehearsal succeed, and the owner explicitly approves deployment. No production deployment is authorized by this checklist.
