# Friends & Family Beta Acceptance Checklist

**Purpose:** Record the final human verification required before opening the bounded Friends & Family beta. This checklist complements the engineering readiness tracker; it does not replace security review or owner go/no-go approval.

## Test record

- Test date/time:
- Tester:
- Environment URL:
- Frontend build/commit:
- API build/commit:
- Test family A:
- Test family B:
- Test accounts used (record role and a non-sensitive alias; do not record passwords, cookies or tokens):

## 1. Authentication and session

- [ ] Sign in with an invited/approved Google account.
- [ ] Confirm /v1/auth/me reports the expected signed-in account and no private cache headers are missing.
- [ ] Sign out; confirm the session is no longer usable.
- [ ] Confirm a user without a valid session cannot read private family data.
- [ ] Confirm session-cookie attributes are Secure, HttpOnly, and SameSite=Lax in the browser.

## 2. Family isolation and sample protection

- [ ] Owner of Family A can see Family A and cannot see Family B unless separately invited.
- [ ] A member of Family B cannot read or mutate Family A by substituting a family ID.
- [ ] Cross-family person IDs and relationship endpoint IDs are rejected.
- [ ] Shared sample family is readable but rejects all family mutations, including Owner-level mutation attempts.
- [ ] A Viewer cannot read the private family member roster through direct API calls.

## 3. Role acceptance matrix

Use separate accounts for each role. Verify both the UI and direct API behavior.

| Action | Owner | Admin | Editor | Viewer |
|---|---|---|---|---|
| Read family people and relationships | [ ] | [ ] | [ ] | [ ] |
| Create a person | [ ] | [ ] | [ ] | [ ] |
| Edit a living profile | [ ] | [ ] | [ ] | [ ] |
| Create/edit/delete relationships | [ ] | [ ] | [ ] | [ ] |
| Delete a person | [ ] | [ ] | [ ] | [ ] |
| Mark deceased / restore | [ ] | [ ] | [ ] | [ ] |
| View member roster | [ ] | [ ] | [ ] | [ ] |
| Change/remove members | [ ] | [ ] | [ ] | [ ] |
| Create/list/revoke invitations | [ ] | [ ] | [ ] | [ ] |
| Import a family workbook | [ ] | [ ] | [ ] | [ ] |
| Export a family workbook | [ ] | [ ] | [ ] | [ ] |

Expected policy: Owner has full family control; Admin has broad control but cannot grant/change/remove another Admin; Editor can manage people and relationships but not family administration or person lifecycle actions; Viewer is read-only and does not receive the private member roster.

## 4. Invitations

- [ ] Owner creates an invitation for each supported role.
- [ ] Admin can invite Editor/Viewer but cannot invite another Admin.
- [ ] Editor and Viewer cannot create, list or revoke invitations.
- [ ] Correct Google account can accept an email-restricted invitation.
- [ ] Different Google account is rejected when invitation email is restricted.
- [ ] Expired invitation cannot be accepted.
- [ ] Revoked invitation cannot be accepted.
- [ ] Repeated/concurrent acceptance results in exactly one membership.
- [ ] Invitation expiry and role are displayed correctly after acceptance.

## 5. Identity claims

- [ ] Member can request a claim for a person in the same family.
- [ ] Member cannot claim a person from another family.
- [ ] Owner can directly link their own identity.
- [ ] Admin cannot directly link an identity.
- [ ] Owner/Admin can approve or reject another member's claim.
- [ ] Claim requester cannot review their own claim.
- [ ] A claim can be reviewed only once; competing decisions cannot create duplicate links/audits.
- [ ] Identity unlink is available only to Owner/Admin and leaves consistent claim/audit state.

## 6. Workbook portability and data integrity

- [ ] Export includes people, biographies, date precision, deceased status and relationships.
- [ ] Import preserves biographies and expected relationship semantics.
- [ ] Name/alias matching does not create unintended duplicates.
- [ ] Re-importing an already imported workbook does not duplicate existing people/relationships.
- [ ] Malformed late person row is rejected before import-side writes (requires PR #68 to be reviewed and merged before relying on this behavior).
- [ ] A forced database failure during import leaves no partial people, relationships or audit records (must remain unchecked until full transaction rollback is implemented and tested).
- [ ] Reconcile people, biographies, relationships, roles/memberships and rendered tree after import.

## 7. Browser, API and operational checks

- [ ] Allowed production origin receives the expected CORS response.
- [ ] Unapproved browser origin cannot perform state-changing requests.
- [ ] TLS certificate is valid and HTTPS is enforced.
- [ ] Security headers and safe error responses are present.
- [ ] Logs do not expose session tokens, invitation codes, private biographies or unnecessary personal data.
- [ ] Actionable alert exists for Worker 5xx/error spikes or availability failure.
- [ ] Alert exists for failed production deployment/build and someone is responsible for responding.
- [ ] Confirm D1 Time Travel retention and the current backup/recovery procedure.
- [ ] Confirm an off-account backup destination and restore process before storing important beta data.

## 8. Support, privacy and release decision

- [ ] Publish a support contact/channel for beta participants.
- [ ] Document who can disable invitations or pause access during an incident.
- [ ] Document rollback/recovery steps and the person authorized to execute them.
- [ ] Publish beta limitations and data-safety guidance; recommend keeping an independent copy of important family records.
- [ ] Confirm session lifetime, invitation expiry, account deletion expectations, and family/platform audit retention.
- [ ] Record who can access family data for support and how that access is audited.
- [ ] Owner reviews unresolved risks and explicitly records the beta go/no-go decision.

## Go / no-go

**Decision:** Pending / Go / No-go

**Owner decision date:**

**Approved scope / participant limit:**

**Outstanding accepted risks (if any):**

**Evidence links:**

A beta is not approved merely because CI is green or the tracker reaches 100%. All critical access, data-integrity, recovery and support checks must be evidenced, and the owner must explicitly approve the go/no-go.
