# Data Model — Initial Proposal

This document defines conceptual entities. Physical D1 migrations will follow after the domain model and constraints are reviewed.

## Entities

### users
Registered application identities. Store stable provider subject, email, display name, avatar URL and timestamps. Do not use email as the sole identity key.

### families
Independent family workspaces with name, owner user ID, privacy settings and timestamps.

### family_members
Membership linking a user to a family with role: owner, admin, editor or viewer.

### persons
People represented in a family tree. They are not necessarily registered users. Include family scope, names, optional profile details, life_status and timestamps.

### relationships
Typed links between person records, with family scope, source/target person IDs, relationship type and optional metadata. Validate parent-child graph constraints in domain services.

### date_information
A reusable structured date representation:
- date_kind: exact, year, approximate_year, range, unknown
- exact_date (nullable)
- year (nullable)
- range_start_year (nullable)
- range_end_year (nullable)
- original_text (nullable)

Use separate birth and death date records or equivalent typed fields with the same structure. Validate allowed combinations.

### invitations
Family, inviter, invitee email or code hash, offered role, expiry, accepted/revoked timestamps and status. Record which user accepted or revoked the invitation. Acceptance is a single-use state transition; only the request that changes pending to accepted may create membership and an audit event.

### api_rate_limits
Scoped fixed-window request counters keyed by a per-window hash of client IP and, where applicable, the authenticated user ID. Store no raw IP addresses; delete expired windows as traffic continues.

### person_identity_links
Family-scoped association between one registered user account and one existing person record. Store family ID, person ID, user ID, linking actor and timestamp. Enforce one linked account per person and one linked person per account within each family.

### person_identity_claims
A request by a family member to associate their account with an existing person. Store family, person, requesting user, status (pending, approved, rejected, withdrawn), request/review timestamps, reviewing user and optional reason. Pending claims do not grant additional access.

### media
Private R2 object key, owning family/person, media type, metadata and uploader.

### historical_sources
Person/claim association, source type, description, optional attachment and contributor.

### tree_layouts
Saved view configuration and optional branch/focus settings; presentation data must not redefine relationships.

### share_links
Hashed token, family/branch scope, permissions, expiry and revocation metadata.

### audit_logs
Actor, family, entity type/ID, action, timestamp and safe change summary. Avoid unnecessarily copying sensitive personal data into logs.

## Important invariants

1. A person's family scope must match the family scope of every relationship involving them.
2. A user must be a member of the family to access private records.
3. Only owner/admin may change a living person's status to deceased.
4. Once deceased, profile update and delete operations are rejected for every role.
5. Relationship changes remain separately authorized and may involve deceased people.
6. Date precision and values must be internally consistent.
7. Unknown dates are represented explicitly, not as invented placeholder dates.
8. User accounts and person records remain independent.
