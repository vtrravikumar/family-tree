# Vansvriksha Development Roadmap

This roadmap reflects the current implementation state and the agreed remaining delivery sequence. Photo upload is deliberately deferred; default avatar handling remains in scope.

## M0 — Product and engineering foundation
- [x] Product specification and architecture
- [x] Conceptual data model and security baseline
- [x] Monorepo and workspace tooling
- [x] Shared TypeScript contracts
- [x] D1 migration workflow
- [x] Unit/integration test setup
- [x] GitHub Actions CI
- [x] Development deployment workflow
- [ ] Review and formally approve the baseline

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
- [x] Family data Excel-compatible import/export (with documented limitations)

## M2.1 — Complete the core family experience
- [ ] Refine default avatar handling across member lists, tree cards and profile views
- [ ] Consistent gender symbols and deceased memorial marker
- [ ] Dedicated visual relationship editor
- [ ] Import preview, validation and duplicate-resolution workflow
- [ ] Improve and verify date-precision handling in imports
- [ ] Final core-workflow usability pass
- [ ] Photo upload — explicitly deferred; not part of this milestone

## M3.1 — Authentication and collaboration
- [ ] Google authentication
- [ ] Secure session lifecycle, expiry and revocation
- [ ] Family invitations
- [ ] Membership management
- [ ] Owner/admin/editor/viewer permissions and administration UI
- [ ] Multi-user collaboration safeguards
- [ ] Concurrency handling and conflict feedback
- [ ] Workspace access and isolation tests

## M4.1 — Export and sharing
- [ ] High-resolution full-tree PNG export
- [ ] Selected-branch export
- [ ] Export themes, layout and settings
- [ ] Read-only family share links
- [ ] Branch-scoped share links
- [ ] Link expiry, revocation and access controls

## M5.1 — Security and production readiness
- [ ] Comprehensive authorization and API security review
- [ ] Strict cross-family data isolation tests
- [ ] Audit-log review and coverage
- [ ] Backup and recovery procedures
- [ ] Operational monitoring and error reporting
- [ ] Production Cloudflare environment and domain
- [ ] Production deployment checklist and release process
- [ ] Privacy, retention and account lifecycle review

## M5.2 — Heritage capabilities
- [ ] Family timeline
- [ ] Stories and memories
- [ ] Historical sources and evidence
- [ ] Documents attached to people and events
- [ ] Photo storage and display (revisit deferred photo-upload decision)
- [ ] Activity feed and notifications
- [ ] Relationship discovery
- [ ] Real-time collaboration enhancements
- [ ] Additional export formats

## M6 — Visual beautification and professional polish
This is the final dedicated design and user-experience milestone. It begins after the functional capabilities and production-readiness work are stable. It is a whole-product consistency pass, not a substitute for accessibility, security or usability requirements in earlier milestones.

- [ ] Establish and document a cohesive design system: colours, typography, spacing, borders, elevation and iconography
- [ ] Refine application branding, logo use, navigation and page hierarchy
- [ ] Polish workspace dashboard and family overview
- [ ] Refine family member cards, avatars, profile views and relationship editor
- [ ] Final family-tree visual treatment, connectors, legends and interaction states
- [ ] Improve responsive layouts for desktop, tablet and mobile
- [ ] Improve empty, loading, success, warning and error states
- [ ] Consistent dialogs, forms, buttons, controls and feedback
- [ ] Accessibility pass: contrast, keyboard navigation, focus states and screen-reader labels
- [ ] Motion and micro-interactions, used sparingly and consistently
- [ ] Performance and visual-regression review across key screens
- [ ] Final cross-browser and device QA

## Definition of done

A milestone item is complete when implementation, tests and documentation are finished; type checks and CI are green; authorization and privacy implications are reviewed; and the intended deployment has been verified.

A formal release is created only after its included changes are validated and the intended deployment succeeds. Development commits are not automatically releases.
