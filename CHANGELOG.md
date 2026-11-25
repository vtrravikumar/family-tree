# Changelog

All notable Vansvriksha releases are documented here. Versions use the format `vMAJOR.MINOR.PATCH` (for example, `v0.2.0`). The major number is currently `0`; the second number is the feature/minor release; the third number is the patch/fix release.

## [Unreleased]

Changes prepared since the most recent formal release. They are not yet assigned a release number and may include work awaiting review.

### Added
- Owner/admin invitation listing and revocation with family audit records.
- Reason-gated, family-scoped Super Admin import and JSON export APIs with platform audit entries.
- Fixed-window rate limits for Google sign-in and invitation creation/acceptance.
- A production-readiness checklist that tracks required implementation, operations and migration evidence.
- Independent Google accounts can register and sign in without replacing the original workspace owner identity.
- Family workspaces are listed and created according to the authenticated user's actual membership.
- Family member directory with owner/admin/editor/viewer role visibility.
- Email-targeted family invitations with seven-day expiry and acceptance restricted to the invited Google account.
- Owners and admins can manage collaborator roles and remove non-owner members, with family audit records.
- Optional relationship linking while adding a new family member.
- When a new person is added as a **sibling**, automatically connect them to every member of the existing explicitly linked **Sibling** group.
- Keep **Sibling** distinct from **Half-sibling**; half-sibling relationships are never inferred by this automatic linking behavior.
- When adding a new sibling, also connect them to every biological parent recorded for the existing sibling group. Adoptive and step-parent relationships are not inherited automatically.
- Add owner/admin person deletion with explicit name confirmation; deleting a living person also removes all connected relationships. Deceased profiles remain protected. Existing media, saved-layout, or branch-share references block deletion.

### Improved
- Removed a leftover one-off family import dataset from the frontend source; it was unused by the application. Added a build-time guard and tests that fail if embedded family-record payloads reappear in frontend source, public assets or built JavaScript.
- Invitation acceptance now atomically consumes a pending invitation before creating membership, preventing reuse under concurrent requests.
- Import and export controls are limited to family owners and admins in the workspace UI.
- Family data changes and audit events are attributed to the authenticated collaborator rather than the legacy development owner.
- Family members and Relationships sections can be collapsed to keep large workspaces manageable.
- Returning to All generations clears the selected-person focus.
- Ancestors and descendants views are not dimmed by first-degree focus behavior.

### Security
- Corrected parsing of development Bearer authorization headers.
- Added acceptance and revocation actor identifiers to invitation records.
- Removed implicit hard-coded Super Admin bootstrap; the authorized identity must be configured explicitly per environment.

### Release history
No formal releases have been published yet.

---

## Release entry template

For every formal release, add a newest-first section using this structure:

## [X.Y.Z] - YYYY-MM-DD

### Highlights
- The most important user-visible outcome.

### Added
- New capabilities.

### Improved
- Enhancements to existing behavior or performance.

### Fixed
- Bugs corrected.

### Security
- Security or privacy changes, if applicable.

### Breaking changes
- Incompatible API, data, workflow, or behavior changes. Write "None" when there are none.

### Migration / upgrade notes
- Database migrations, required configuration, data impact, and manual steps. Write "None" when there are none.

### Known limitations
- Important gaps users should know about.

### Included commits
- `<short-sha>` — <commit subject>

---

## Versioning policy

- **MAJOR** (`X.0.0`): incompatible changes to user workflows, APIs, data formats, or stored data.
- **MINOR** (`0.Y.0`): backward-compatible user-facing features and substantial capabilities. During 0.x, this is the normal feature-release increment (for example, `v0.2.0`).
- **PATCH** (`0.Y.Z`): backward-compatible bug fixes, small refinements, and security fixes (for example, `v0.2.1`).
- While the product is in `0.x`, the API and data model may evolve; any breaking changes must still be called out explicitly.
- Every release gets a matching Git tag (`vX.Y.Z`) and GitHub Release with these notes.
- The app footer always displays the current package version as a link to `/version-history`, followed by the current build identifier in parentheses. The history page lists released versions and the unreleased changes awaiting the next version.
- The root, web, and API package versions must be kept aligned at the release version.
- A release is created only after CI is green and the intended deployment has succeeded. Development deployments from ordinary commits to `main` are not releases.
- Release notes describe what users receive, not merely a list of code changes. Always identify data migrations, compatibility impact, and known limitations.
- Each release entry records the exact included commit range or commit list so its contents are auditable.


## Unreleased

### Added
- Identity association schema separating registered user accounts from family person records.
- Family-scoped uniqueness constraints for linked accounts and people.
- API foundation for identity claim requests, owner direct claims, Owner/Admin review, and audited unlinking.
- Identity claim actions are audited and pending claims do not change family membership or role.
