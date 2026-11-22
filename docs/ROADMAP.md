# Vansvriksha Development Roadmap

This roadmap reflects the agreed focused production v1 scope. Professional UI/UX redesign is mandatory for v1. Photo upload, presentation exports and independently managed family branches are deferred.

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
- [x] Build and test canonical sample-family access, read-only enforcement, personal hide/remove, and export/import into private family workspaces; deployed to development in PR #43
- [ ] Comprehensive authorization and API security review
- [ ] Strict cross-family data isolation and role-boundary tests
- [ ] Identity-claim uniqueness, approval and reassignment security tests
- [ ] Audit-log review and coverage
- [ ] Backup and tested recovery procedures
- [ ] Operational monitoring and error reporting
- [x] Verify development login and D1 access on the active dev hostname; development and branded domains currently share the development Pages project
- [ ] Move `vansvriksh.vtrrk.in` to a separate production Pages project before launch
- [ ] Complete production isolation: the production D1 is migrated, but Worker script creation is pending additional Cloudflare Workers Admin access; a separate production Pages project and API domain are still pending.
- [x] Choose a clean production database for the initial beta; keep development family data in development and let users transfer selected families through export/import
- [x] Apply all ten migrations to the empty production D1 database, including the shared sample-family seed
- [ ] Verify production constraints and indexes; rehearse D1 backup/restore recovery
- [ ] Verify export/import of a selected family into production, preserving people, relationships, ownership and roles
- [ ] Reconcile imported family records, memberships and relationship integrity; preserve the development fallback
- [ ] End-to-end acceptance testing with the three current test users and intended roles
- [ ] Production deployment checklist, rollback plan and release process
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
