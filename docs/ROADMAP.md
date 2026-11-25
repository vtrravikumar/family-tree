# Vansvriksha Development Roadmap

This roadmap reflects the agreed focused production v1 scope. Professional UI/UX redesign is mandatory for v1. Photo upload, presentation exports and independently managed family branches are deferred.

## Release roadmap: Friends & Family beta to v1.0

Status: 2026-11-25. Production web and API are deployed for controlled verification. The evidence-based Friends & Family beta tracker is 62.5/100; this is a beta-specific score, not v1.0 completion. Gate 1 still requires access-boundary verification, privacy/operations evidence, and bounded-beta support/go-no-go. Treat this as a controlled production environment, not yet an approved Friends & Family beta or formal v1.0 release.

### Gate 1 — before inviting Friends & Family

Complete these safety checks before inviting people to enter important family records:

1. **[Complete] Make production fail safely:** PR #49 adds a production build guard requiring HTTPS `VITE_API_URL` and rejecting the development API host; production Pages deployment is green.
2. **[Complete] Protect data:** Workers Free provides 7-day D1 Time Travel retention; a disposable APAC D1 restore rehearsal passed and the scratch database was deleted. Production data was not restored.
3. **Verify access boundaries:** PR #50 adds mocked regressions for cross-family relationship and member-ID tampering. PR #59 and #60 are merged to `main` with identity-claim review and member/roster authorization hardening. PRs #61–#70 contain additional draft authorization fixes; they are not merged or promoted. Complete route-by-route review, local D1 tests for high-risk transitions, and Owner/Admin/Editor/Viewer plus family-isolation acceptance before closing this item.
4. **Prove data portability:** The owner confirmed production family creation and workbook export/import, and confirmed a selected-family development-to-production transfer across people, biographies, relationships, memberships/roles and rendered tree. Import integrity still needs hardening: PR #68 adds pre-validation but does not yet provide full transactional rollback.
5. **Verify privacy and operations:** confirm CORS preflight, secure cookies, TLS/security headers, error/log data minimization, and actionable failure alerts; decide beta-appropriate session, invitation and audit retention. These owner/operator checks remain open.
6. **Prepare a bounded beta:** document support/contact and rollback steps, identify the test accounts/roles, publish short beta notes explaining that this is an early release, and obtain explicit owner go/no-go approval. This item remains open.

### Stage 2 — Friends & Family beta

After Gate 1, invite a small, known group. Keep sign-in restricted to invitations, keep development and production data separate, monitor errors and feedback, and avoid bulk migration. Encourage users to test the sample family first and import only a family they choose. Triage data-loss, access-control and account/invitation issues before visual or convenience requests.

### Gate 3 — from beta to full production readiness

Use beta evidence to close the remaining v1 work:

- Complete route-by-route authorization, identity-claim uniqueness/race/self-review and audit coverage tests; test all roles and cross-family boundaries.
- Complete data lifecycle and privacy decisions: account deletion, revoke-all-sessions, expiry cleanup, and family/platform audit-log retention.
- Validate import edge cases and usability: preview/validation, duplicate resolution, and date precision; reconcile imported production records.
- Review real beta traffic, tune rate limits, and establish actionable monitoring/alerts without exposing personal data.
- Finish remaining v1 usability tasks in M2.1, formally approve product/architecture/security documentation, complete release notes and rollback review, then obtain explicit v1.0 approval and create the matching release/tag.

The detailed evidence checklist and current completion count are in [Production Readiness](docs/PRODUCTION_READINESS.md). Photo upload and other items in “Next major release” remain deferred.


## M0 — Product and engineering foundation
- [x] Product specification and architecture baseline
- [x] Conceptual data model and security baseline
- [x] Monorepo and workspace tooling
- [x] Shared TypeScript contracts
- [x] D1 migration workflow
- [x] Unit/integration test setup
- [x] GitHub Actions CI
- [x] Development deployment workflow
- [ ] Update and formally approve v1 product/architecture/security documentation

## M1 — Application foundation
- [x] React + TypeScript frontend
- [x] Cloudflare Worker API
- [x] D1 database and migrations
- [x] Family workspace creation and selection
- [x] Development frontend and API deployment
- [x] Canonical fictional sample family: compact eight-person fixture covering all relationship types across four generations; shared read-only Viewer access, personal hide/remove, and export/import into a user's private family

## M2 — Family tree engine
- [x] Person creation and profile editing
- [x] Life-status management and deceased-profile immutability
- [x] Historical date precision (exact, year, approximate, range, unknown)
- [x] Relationship domain and validation
- [x] Parent, spouse/partner and sibling relationship support
- [x] Interactive family-tree visualization
- [x] Ancestor and descendant views
- [x] Family summary statistics
- [x] Family data Excel-compatible import/export baseline (authorization hardening remains a v1 task)

## M2.1 — Complete the core family experience
- [ ] Refine default avatar handling across member lists, tree cards and profile views
- [ ] Consistent gender symbols and deceased memorial marker
- [ ] Dedicated visual relationship editor
- [ ] Import preview, validation and duplicate-resolution workflow
- [ ] Improve and verify date-precision handling in imports
- [ ] Final core-workflow usability pass
- [ ] Photo upload — explicitly deferred; not part of v1

## M3.1 — Authentication, collaboration and identity
- [x] Google authentication baseline
- [ ] Verify secure session lifecycle, expiry and revocation
- [x] Family invitations and membership baseline
- [ ] Complete and test Owner/Admin/Editor/Viewer permission matrix
- [x] Identity-claim database foundation: separate person-account links and pending claim records
- [x] API foundation: request claims, owner direct claim, Owner/Admin review, and Owner/Admin unlink
- [x] Enforce one account and one person per family through database uniqueness constraints
- [x] Audit claim request, approval, rejection, direct claim and unlink actions
- [ ] Add identity-claim and review controls to the family UI
- [ ] Verify pending claims grant no additional permissions with automated tests
- [ ] Verify race conditions, self-review prevention, uniqueness and cross-family isolation
- [ ] Display Google profile photo as an overlay, separate from the historical family portrait
- [ ] Implement authorized audited reassignment workflow
- [ ] Multi-user collaboration safeguards, concurrency handling and conflict feedback
- [ ] Workspace access and isolation tests

## M3.2 — Import/export authorization and data portability
- [x] Restrict family data import to Family Owner, family Admin and reason-gated Platform Super Admin
- [x] Deny Editor and Viewer at the import endpoint
- [x] Add a family-scoped, reason-gated, audited Platform Super Admin export endpoint
- [ ] Enforce authorization on preview, validation, commit and download paths
- [ ] Add negative tests for unauthorized roles and cross-family access
- [ ] Preserve and validate IDs, relationships, memberships, roles and ownership in migration/import workflows

## M3.3 — Security and authorization audit
- [x] Trace family, identity, invitation and platform-admin API authorization paths
- [x] Correct development Bearer token parsing
- [x] Hide import/export controls from Editor and Viewer roles
- [x] Add pending invitation listing and owner/admin revocation controls
- [x] Make invitation acceptance a single-use conditional database operation
- [x] Remove the implicit hard-coded Super Admin identity; require explicit environment configuration
- [x] Add focused positive and negative tests for sensitive route and role boundaries
- [x] Verify single-use invitation acceptance and revocation behavior using SQLite transaction semantics compatible with D1 batches
- [x] Close Super Admin import/export API policy gaps with reason-gated platform authorization and audit events
- [x] Add fixed-window rate limiting for Google sign-in and invitation create/accept endpoints
- [x] Review session expiry/revocation, origin checks, security headers and rate-limit data minimization
- [x] Verify CI on the audited commit via PR #41

## M4 — Professional UI/UX redesign (mandatory for v1) — COMPLETE
- [x] Agree and document a cohesive design system: colours, typography, spacing, borders, elevation and iconography
- [x] Redesign application branding, navigation and page hierarchy
- [x] Redesign workspace dashboard and family overview
- [x] Refine member cards and profile views
- [x] Redesign tree visualization, connectors, legends and interaction states
- [x] Improve responsive layouts for desktop, tablet and mobile
- [x] Improve empty, loading, success, warning and error states
- [x] Consistent dialogs, forms, buttons, controls and feedback
- [x] Accessibility pass: contrast, keyboard navigation, focus states and screen-reader labels
- [x] Performance and visual-regression review across key screens
- [x] Final cross-browser and device QA (user-confirmed)

## M5 — Security, production migration and launch readiness

Production web/API cutover completed 2026-11-23. The owner confirmed production Google sign-in, sample-family access, and API health with production D1 connected. This is a live controlled environment; the remaining release gates are tracked in [Production Readiness](PRODUCTION_READINESS.md). Do not treat deployment alone as formal v1.0 approval.
- [x] Build and test canonical sample-family access, read-only enforcement, personal hide/remove, and export/import into private family workspaces; deployed to development in PR #43
- [ ] Comprehensive authorization and API security review
- [ ] Strict cross-family data isolation and role-boundary tests
- [ ] Identity-claim uniqueness, approval and reassignment security tests
- [ ] Audit-log review and coverage
- [ ] Backup and tested recovery procedures
- [ ] Operational monitoring and error reporting
- [x] Separate production Cloudflare environment, D1 database, secrets and domains: production Worker/API and Pages frontend are deployed on the `production` branch with a separate D1 and custom domains.
- [x] Choose a clean production database for the initial beta; keep development family data in development and let users transfer selected families through export/import
- [x] Apply all ten migrations to the clean production database and complete a separate disposable D1 restore rehearsal; production data was untouched.
- [ ] Reconcile a selected-family export/import into production, preserving people, biographies, relationships, ownership, roles and tree rendering (basic production workbook export/import is owner-confirmed)
- [ ] Reconcile imported family records, memberships and relationship integrity; preserve the development fallback
- [ ] End-to-end acceptance testing with the three current test users and intended roles
- [ ] Production deployment checklist, rollback plan and release process
- [x] Add GitHub CI triggers for production pushes and pull requests (PR #54 merged to `main`; carry the workflow change to `production` before expecting checks there)
- [ ] Privacy, retention and account lifecycle review
- [ ] Production launch approval only after all v1 acceptance criteria pass

See [Production Readiness](PRODUCTION_READINESS.md) for current blockers and required evidence.

## Next major release — Deferred capabilities
- [ ] High-resolution full-tree PNG export and selected-branch export
- [ ] Export themes, layout and settings
- [ ] Read-only family share links, branch-scoped links, expiry and revocation
- [ ] Photo upload and media management
- [ ] Family timeline, stories, memories and historical-source enhancements
- [ ] Activity feed, notifications and advanced real-time collaboration
- [ ] Independently managed family branches and consent-based cross-family connections
- [ ] Additional presentation/export formats

## Definition of done

A milestone item is complete when implementation, tests and documentation are finished; type checks and CI are green; authorization and privacy implications are reviewed; and the intended deployment has been verified.

A formal release is created only after every included v1 acceptance criterion is validated and the intended production deployment succeeds. Development commits are not automatically releases.
