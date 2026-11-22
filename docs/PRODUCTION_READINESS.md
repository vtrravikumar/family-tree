# Production Readiness

Vansvriksh is still a development deployment. This checklist separates implemented foundations from evidence still required before a production launch. Do not treat a passing development deployment as production approval.

## Current state

- Google sign-in, family membership, Owner/Admin/Editor/Viewer roles, identity claims and a platform Super Admin are implemented.
- The app currently uses Cloudflare Pages and a Worker with a development D1 database. A dedicated production Worker, database, secrets and domain are not configured in this repository.
- M3.2 was deployed with CI passing. The latest baseline CI run on `9766744` was verified green.
- M3.3 changes include a development Bearer parsing fix, invitation acceptance/revocation handling, reason-gated Super Admin import/export, UI role gating and authorization tests. Local tests, type checks and web build pass; PR #41 validation and its Cloudflare Pages preview are green. The Worker development-deploy job was skipped; no production deployment or database migration was performed.
- The new rate-limit and invitation actor migrations apply cleanly to local SQLite. Wrangler could not inspect development D1 because `CLOUDFLARE_API_TOKEN` is not available in this environment.
- No production data migration, backup, rollback or launch has been performed or approved.

## Required before production

### Product and authorization

- [ ] Complete exhaustive Owner/Admin/Editor/Viewer tests for every sensitive API route. M3.3 now covers the primary route boundaries; local tests do not exercise a live D1 database.
- [ ] Test family ID/person ID tampering, pending claims, invitation email mismatch, expiry/revocation and single-use acceptance against the development D1 database.
- [x] Implement Platform Super Admin import/export APIs that require a reason, target one family, and record a platform audit event. The Super Admin download format is JSON; no import preview or validation stage exists yet.
- [x] Require explicit `SUPER_ADMIN_EMAIL` configuration before bootstrapping the platform role; configure it separately in each intended environment.
- [x] Provide an audited, server-authorized Platform Super Admin family export. Hiding the browser workbook export button for Editor/Viewer is a usability guard because all family members can read family data through the API.
- [x] Add fixed-window rate limits for Google sign-in and invitation creation/acceptance. Review thresholds against development traffic before production.
- [ ] Review invitation, account deletion, session revocation, privacy retention and audit-log retention policies.
- [ ] Confirm API errors and logs never expose session tokens, invitation codes or family data unnecessarily.

### Operations and environments

- [ ] Add an explicit production Wrangler environment with its own D1 database, domain, Google configuration and least-privilege secrets.
- [ ] Remove development-only configuration and credentials from every production deployment path; verify the deployed `APP_ENV` is production.
- [ ] Verify the production origin allowlist, cookie behavior, TLS, security headers, CORS preflight and health monitoring.
- [ ] Establish backup frequency, retention, access controls and a tested restore procedure for D1.
- [ ] Add actionable error reporting and operational alerts without logging personal data or credentials.

### Data migration and launch

- [ ] Inventory both existing family workspaces and their users, roles, people, relationships and identity links.
- [ ] Write and rehearse a non-destructive migration plan with verified source backups and a development fallback.
- [ ] Apply migrations to a production-like empty database first; verify constraints, indexes and rollback/recovery behavior.
- [ ] Reconcile row counts, foreign keys, ownership, memberships, roles, relationship integrity and representative tree renderings after migration.
- [ ] Run end-to-end acceptance with the three intended test users and their assigned roles.
- [ ] Confirm current CI is green, complete release notes, review the rollback plan and obtain explicit production launch approval.

## Release gate

Production launch remains blocked until every required item above has evidence recorded, CI passes on the exact release candidate, the migration and restore rehearsal succeed, and the owner explicitly approves deployment. No production deployment is authorized by this checklist.
