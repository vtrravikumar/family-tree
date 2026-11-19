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

## Deceased-profile immutability

The domain service and API must reject all ordinary profile update/delete operations when life_status is deceased, regardless of caller role. The status transition itself must be an explicit owner/admin operation, confirmed and audited. Relationship operations are separate and must not be blocked solely because a linked person is deceased.

## Privacy

Family workspaces are private by default. Public/read-only sharing must be explicitly enabled, scoped and revocable. Avoid exposing living persons' sensitive information in public previews, exports or metadata.

## Testing

Add negative tests for cross-family access, role escalation, forged IDs, expired/revoked invitations, share-link revocation, and attempts to edit deceased profiles directly through the API.
