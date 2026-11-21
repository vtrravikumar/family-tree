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
- [ ] Implement identity claim requests against existing person records
- [ ] Allow Family Owner and family Admin to approve/reject claims
- [ ] Allow Family Owner to directly claim any person in the family
- [ ] Ensure pending claims grant no additional permissions
- [ ] Enforce one account per person and one person per account within each family, with authorized audited reassignment
- [ ] Display Google profile photo as an overlay, separate from the historical family portrait
- [ ] Audit claim, approval, rejection, direct claim, unlink and reassignment events
- [ ] Multi-user collaboration safeguards, concurrency handling and conflict feedback
- [ ] Workspace access and isolation tests

## M3.2 — Import/export authorization and data portability
- [ ] Restrict family data import/export to Family Owner, family Admin and Platform Super Admin
- [ ] Deny Editor and Viewer at every import/export API route
- [ ] Enforce authorization on preview, validation, commit and download paths
- [ ] Add negative tests for unauthorized roles and cross-family access
- [ ] Preserve and validate IDs, relationships, memberships, roles and ownership in migration/import workflows

## M4 — Professional UI/UX redesign (mandatory for v1)
- [ ] Agree and document a cohesive design system: colours, typography, spacing, borders, elevation and iconography
- [ ] Redesign application branding, navigation and page hierarchy
- [ ] Redesign workspace dashboard and family overview
- [ ] Refine member cards, identity/avatar overlays and profile views
- [ ] Redesign tree visualization, connectors, legends and interaction states
- [ ] Improve responsive layouts for desktop, tablet and mobile
- [ ] Improve empty, loading, success, warning and error states
- [ ] Consistent dialogs, forms, buttons, controls and feedback
- [ ] Accessibility pass: contrast, keyboard navigation, focus states and screen-reader labels
- [ ] Performance and visual-regression review across key screens
- [ ] Final cross-browser and device QA

## M5 — Security, production migration and launch readiness
- [ ] Comprehensive authorization and API security review
- [ ] Strict cross-family data isolation and role-boundary tests
- [ ] Identity-claim uniqueness, approval and reassignment security tests
- [ ] Audit-log review and coverage
- [ ] Backup and tested recovery procedures
- [ ] Operational monitoring and error reporting
- [ ] Separate production Cloudflare environment, D1 database, secrets and domain
- [ ] Create and validate a non-destructive migration plan for both existing family workspaces
- [ ] Take verified pre-migration backups and preserve a development fallback
- [ ] Migrate existing families, users, memberships, roles, people and relationships without loss
- [ ] Reconcile source and destination counts and relationship integrity
- [ ] End-to-end acceptance testing with the three current test users and intended roles
- [ ] Production deployment checklist, rollback plan and release process
- [ ] Privacy, retention and account lifecycle review
- [ ] Production launch approval only after all v1 acceptance criteria pass

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
