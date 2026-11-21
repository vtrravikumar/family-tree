# Security Baseline

## Core controls

- Validate Google identity tokens on the server.
- Use secure, HttpOnly, SameSite cookies for application sessions.
- Protect state-changing cookie-authenticated requests against CSRF.
- Enforce family membership and role checks on every API route.
- Never rely on frontend-hidden controls for authorization.
- Keep D1 and R2 bindings environment-specific.
- Keep secrets out of source control; use Cloudflare secrets.
- Validate and constrain uploaded file type, size and ownership.
- Use opaque, high-entropy invitation and share tokens; store hashes where practical.
- Rate-limit authentication, invitation and public-link endpoints.
- Record security-relevant events in audit logs.
- Apply least privilege to deployment credentials.
- Keep development and production environments, databases and secrets separate.
- Back up and validate existing family data before production migration.

## Role and permission boundaries

Family-level roles are Owner, Admin, Editor and Viewer. Platform Super Admin is a separate platform-level authority and must not be confused with a family role.

### Import/export

Only the following may import or export family data:
- The Owner of the target family.
- An Admin of the target family.
- Platform Super Admin, using an explicitly authorized platform-level capability.

Editors and Viewers must be denied. Authorization must be checked server-side on every relevant operation, including import/export preview, validation, commit, download and alternate endpoints. A user must not bypass family scoping by changing a family ID or calling an endpoint directly. Platform Super Admin actions should be audited.

### Identity claims

- A signed-in account may request association with an existing person record in a family.
- A pending claim grants no additional access or editing permissions.
- Only the Family Owner or a family Admin may approve or reject a claim.
- The Family Owner may directly claim any person in their family without a separate approval.
- Editors and Viewers cannot approve claims.
- Enforce one account-to-person association per family and one account per person per family. Any exception must use an explicitly authorized reassignment process.
- Claiming identity does not transfer family ownership or alter the claimant's existing family role.
- Approval, rejection, direct claim, unlink and reassignment must be audited.
- Display the Google avatar as a separate overlay; never overwrite the person's historical family portrait.
- Verify authorization and uniqueness in the API/database transaction, not only in the UI.

## Deceased-profile immutability

The domain service and API must reject all ordinary profile update/delete operations when life_status is deceased, regardless of caller role. The status transition itself must be an explicit owner/admin operation, confirmed and audited. Relationship operations are separate and must not be blocked solely because a linked person is deceased.

## Privacy

Family workspaces are private by default. Public/read-only sharing is outside focused production v1 scope. If introduced later, it must be explicitly enabled, scoped and revocable. Avoid exposing living persons' sensitive information in public previews, exports or metadata.

## Production migration safety

- Keep the development environment intact as a fallback during production migration.
- Take and verify backups before migration.
- Preserve family IDs, person IDs, relationship IDs, family ownership, memberships and roles wherever the migration strategy permits.
- Validate row counts, foreign-key/relationship integrity, role assignments and representative family-tree renderings after migration.
- Do not cut over until reconciliation passes and a rollback path is documented.
- Never run destructive migration or production data mutation without explicit approval.

## Testing

Add negative tests for:
- Cross-family access and forged family/person IDs.
- Role escalation and every unauthorized role/action combination.
- Editor and Viewer attempts to import/export, including direct API calls and preview/commit/download paths.
- Platform Super Admin authorization boundaries and audit events.
- Identity claim approval by Editor/Viewer, self-approval, duplicate claims, race conditions and unauthorized reassignment.
- Pending claims granting no additional permissions.
- Expired/revoked invitations.
- Attempts to edit deceased profiles directly through the API.
- Production migration preserving people, relationships, memberships, roles and ownership.
