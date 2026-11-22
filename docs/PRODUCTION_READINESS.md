# Production Readiness

Vansvriksh is still a development deployment. This checklist separates implemented foundations from evidence still required before a production launch. Do not treat a passing development deployment as production approval.

## Current state

- Google sign-in, family membership, Owner/Admin/Editor/Viewer roles, identity claims and a platform Super Admin are implemented.
- The app currently uses Cloudflare Pages and a Worker with a development D1 database. A dedicated production Worker, database, secrets and domain are not configured in this repository.
- A read-only check on 2026-11-22 found `vansvriksh.vtrrk.in` serves the same JavaScript bundle as `vansvriksh-web-dev.pages.dev`; that bundle calls `api-dev.vtrrk.in`. Treat the branded hostname as development until Cloudflare's project/domain mapping and a separate production frontend/API/database are verified. `api.vtrrk.in` currently returns only a legacy health response and 404s for the current `/v1` routes.
- M3.3 was merged in PR #41. Its CI passed and the Worker was deployed to development; the development health endpoint returned 200 and unauthenticated family/platform data requests returned 401. Authenticated live D1 authorization and invitation lifecycle tests remain outstanding. No production deployment was performed.
- PR #43 added the shared fictional sample family. CI run #280 passed; D1 migration `0010_shared_sample_family.sql` and the Worker deployment both completed successfully. The development health endpoint reports `environment: development` and `database: connected`. The sample appears for existing users; this was confirmed by the owner on 2026-11-22.
- Migrations `0008_invitation_actor_audit.sql`, `0009_api_rate_limits.sql`, and `0010_shared_sample_family.sql` are applied to the development D1 database. Authenticated live authorization and invitation lifecycle tests against D1 remain outstanding.
- Current checklist progress: 5 of 20 items complete (25%). This measures documented readiness tasks; production remains unavailable until its environment, data-migration plan, backup/recovery process and release evidence are in place.
- The local Worker authorization suite now has 46 tests, including member-role/removal boundaries, family and relationship permissions, invitation lifecycle checks, platform-admin separation and sample-family protections. The remaining role/data-isolation cases still need live development D1 verification.
- A read-only development D1 inventory on 2026-11-22 found three private family records; two share the same display name. Migration reconciliation must identify families by stable ID and verify owner/membership, not rely on names alone.
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

- [ ] Add an explicit production Wrangler environment with its own D1 database, domain, Google configuration and least-privilege secrets.
- [ ] Remove development-only configuration and credentials from every production deployment path; verify the deployed `APP_ENV` is production.
- [ ] Set and verify `VITE_API_URL` separately for each Pages environment. The current frontend falls back to `https://api-dev.vtrrk.in` when the variable is absent; never let a production build inherit that default.
- [ ] Verify the production origin allowlist, cookie behavior, TLS, security headers, CORS preflight and health monitoring.
- [ ] Establish backup frequency, retention, access controls and a tested restore procedure for D1.
- [ ] Add actionable error reporting and operational alerts without logging personal data or credentials.

### Data migration and launch

- [ ] Inventory all current private family workspaces and their users, roles, people, relationships and identity links. The current development D1 has three private family records, including two with the same name; reconcile by stable ID and owner.
- [ ] Write and rehearse a non-destructive migration plan with verified source backups and a development fallback.
- [ ] Apply migrations to a production-like empty database first; verify constraints, indexes and rollback/recovery behavior.
- [ ] Reconcile row counts, foreign keys, ownership, memberships, roles, relationship integrity and representative tree renderings after migration.
- [ ] Run end-to-end acceptance with the three intended test users and their assigned roles.
- [ ] Confirm current CI is green, complete release notes, review the rollback plan and obtain explicit production launch approval.

## Release gate

Production launch remains blocked until every required item above has evidence recorded, CI passes on the exact release candidate, the migration and restore rehearsal succeed, and the owner explicitly approves deployment. No production deployment is authorized by this checklist.
