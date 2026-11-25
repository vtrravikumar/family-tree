# Friends & Family Beta — Privacy, Support and Incident Notes

**Status: Draft for owner review — not yet an approved public privacy policy.**  
**Scope:** Controlled Friends & Family beta. This short note is intended to make the beta's data handling and support expectations understandable without claiming a formal compliance certification.

## 1. What the beta does

Vansvriksh lets invited family members create and maintain a shared family record. Depending on the permissions assigned to them, members may add or view family-member details, relationships and associated family information.

The beta uses Google sign-in to authenticate people. A Google identity is not, by itself, permission to view a family. Access to a family is controlled by that family's membership and role.

## 2. Information handled

The application may process:

- Google account email address and identity/profile information needed to sign in and identify a member.
- Family information entered by members, such as names, biographies, dates, relationships and other details the application supports.
- Family membership, role, invitation and identity-claim records.
- Operational records needed to secure and operate the service, such as audit events and technical error information.

Do not enter highly sensitive information that is not needed to preserve family history. Before inviting beta participants, the owner should explain that family information is shared with members who have access to that family.

## 3. Authentication, invitations and access

- Sign-in uses a verified Google identity.
- Registration is open to verified Google identities, but this does not grant access to an existing family.
- A person can access a family only after the appropriate membership or invitation-acceptance flow.
- Invitations are restricted to the invited email identity, use a secure single-use link and expire after seven days.
- Family Owners/Admins are responsible for inviting the intended person and choosing the least-privileged suitable role.
- Removing a member or changing their role is the family administrator's responsibility, subject to the application's available controls.

## 4. Storage, sharing and operational access

Family records are stored in the application's Cloudflare D1 database. The application uses Cloudflare-hosted services to run the website and API. Do not assume that a beta deployment has a complete backup/restore or formal disaster-recovery service until the owner has completed and approved the relevant operational checks.

Family information is intended to be visible only to members authorized for that family and to service operators when necessary to maintain, secure or support the service. The beta should not be treated as an end-to-end encrypted private vault.

## 5. Sessions, logout, deletion and retention

### Implementation facts verified in source and regression tests

- A successful Google sign-in creates a server-side session with an absolute expiry seven days after creation. The same seven-day value is placed in the browser cookie's `Max-Age`.
- Authenticated requests look up the session by its token hash and reject it after the stored expiry. The inspected implementation does not establish a separate idle timeout or sliding renewal.
- Logout deletes the matching server-side session and clears the browser cookie. A regression test checks that the logout response clears the cookie; the route implementation performs the server-side deletion.
- Invitations are created with a seven-day expiry, can be accepted only while pending and unexpired, and are single-use. Owner/Admin can revoke a pending invitation; invitation acceptance and expiry/revocation paths have regression coverage.
- Owner/Admin member removal deletes the family-membership row and writes an audit event. Subsequent family access is governed by current family membership, so this removes that user's access to that family; it does not delete the user's Google identity or membership in other families.
- A family can be deleted through the family DELETE API only by its current Owner. The request must include explicit confirmation, and the database write rechecks Owner authority at mutation time. This is an in-app capability; it is not an account-deletion operation.

These are implementation observations, not a substitute for owner approval of the participant-facing wording or a live acceptance test.

### Approved beta policies and remaining evidence

| Topic | Proposed beta expectation | Approval / evidence |
|---|---|---|
| Session expiry and logout | State that sessions expire after seven days and users can sign out to invalidate the current session. Advise signing out on shared devices. | Source and regression-test review completed; owner to approve participant-facing wording. |
| Invitation expiry and revocation | Invitations expire after seven days, are single-use and may be revoked by a family Owner/Admin while pending. | Implemented behaviour; retain regression coverage. |
| Member access removal | Owner/Admin can remove a member; removal ends that member's access to that family on subsequent requests. | Source and regression-test review completed; owner to approve wording. |
| Account deletion | No self-service account-deletion flow exists. During beta, requests go to **vtr.ravikumar@gmail.com** and are handled manually by the owner. Verify the requester; inventory all family memberships and ownership; never delete a shared family solely because its owner requests account deletion. Resolve each owned family first through an agreed continuity/ownership decision. Revoke sessions and remove access only after those decisions. Review identity and audit references before any account-level deletion; do not promise immediate deletion. | Owner approved this manual owner-reviewed policy on 2026-11-25. This is an operator workflow, not an implemented self-service endpoint. If ownership cannot be resolved using a verified capability, pause and explain the dependency. |
| Family deletion | A current family Owner can delete a family in the app after explicit confirmation. For help or a family-deletion request, contact **vtr.ravikumar@gmail.com**. Explain that deletion is a destructive family-level action, separate from deleting a Google account. | Owner-only API enforcement and explicit-confirmation requirement verified in source. Email contact route approved. Do not promise recovery or a deletion/backup retention period; backup and audit implications remain subject to the separate operational decisions. |
| Application audit logs (D1 audit_logs) | Retain for 90 days; automatically delete older application audit rows daily. | Owner approved 90 days on 2026-11-25. Scheduled cleanup code and automated tests are included in this change; deployment and first scheduled-run evidence remain pending. |
| Cloudflare invocation/observability logs | Platform-managed invocation logs are separate from application audit rows. This policy does not change Cloudflare platform retention, sampling or billing settings. | Governed separately in Cloudflare; this application cleanup does not change them. |\n| Backups | Backup destination, access, schedule and retention remain subject to the separate backup approval and recovery evidence. | Deferred operational item; do not imply complete backup coverage. |


### Manual account-deletion handling during beta

This is an owner-operated request workflow; the application has no self-service account-deletion endpoint.

1. Receive the request at **vtr.ravikumar@gmail.com** and verify the requester. Never ask for passwords, Google verification codes or session cookies.
2. Identify the account and every family membership, including families where the person is Owner.
3. For each owned family, agree whether it should continue under another responsible owner or be deleted at the current Owner's explicit request. Do not delete shared family data by default.
4. If ownership cannot be safely resolved using an implemented, verified control, pause the request and explain the dependency. Do not improvise a production database change.
5. After ownership decisions, revoke active sessions and remove family access using supported controls. Member removal does not delete the Google identity or other family memberships.
6. Review remaining identity-claim and audit references. Application audit rows are retained only within the approved 90-day window unless a separately approved legal/security hold applies.
7. Do not claim full account deletion until a separately reviewed and tested account-level deletion procedure exists. Tell the requester exactly what was completed and what remains.

No production account, family, membership or audit data is changed by this policy documentation or by adding the scheduled cleanup code. Once deployed, the job deletes only D1 audit_logs rows older than 90 days; Cloudflare platform invocation logs are outside its scope.

## 6. Beta participant guidance

- Share invitations privately and only with the intended person.
- Use the least-privileged role that meets the participant's needs.
- Do not forward an invitation link; it is intended for the invited Google account.
- Review family information before entering it and obtain appropriate consent before adding details about living relatives.
- Report an incorrect, exposed or unexpectedly changed record promptly to the beta owner.
- Do not use the beta as the sole copy of important family records during this early access period.

## 7. Support route

During the Friends & Family beta, participants should contact the Vansvriksh beta owner through WhatsApp using the contact details they already have. If WhatsApp is unavailable or a written email route is preferred, participants may email **vtr.ravikumar@gmail.com**. Send both account-deletion requests and family-deletion requests or requests for help with family deletion to this email address. A family Owner may also use the existing in-app family-deletion control, which requires explicit confirmation.

When reporting a problem, include:
- Approximate time and timezone.
- The family/workflow affected.
- What action was attempted and what happened.
- A screenshot only after removing unrelated personal information.

Never send passwords, Google verification codes, session cookies, invitation links or API credentials in a support report.

## 8. Incident handling and rollback

For suspected unauthorized access, cross-family data exposure or unexpected data loss:

1. Stop the affected activity. If necessary, pause issuing new invitations and tell affected participants not to make further changes.
2. Preserve the approximate time, affected family, user account and relevant workflow run or error reference. Do not copy family content or secrets into GitHub issues.
3. The owner should assess whether access must be removed, a member's role changed, or a session invalidated using the supported controls.
4. For a suspected security or privacy incident, do not attempt an ad-hoc production database repair. Preserve evidence and use the separately approved recovery procedure.
5. For a bad application release, identify the last known-good application commit and use the normal Cloudflare/Git release rollback process. Confirm the deployed API and frontend versions before reopening invitations.
6. Record the cause, impact, corrective action and regression test before closing the incident.

Production D1 export/restore, migrations, secret changes, resource provisioning and retention changes require separate explicit owner approval. This note does not authorize those operations.

## 9. Owner release checklist

Before using this document as the beta-facing privacy/support note, the owner must:

- [x] Verify the seven-day absolute session expiry, server-side logout invalidation and cookie clearing in source/tests.
- [x] Verify invitation expiry/revocation and member removal behaviour in source/tests; owner approval of participant-facing wording remains pending.
- [x] Set the account- and family-deletion request email route to vtr.ravikumar@gmail.com. Account-deletion processing and family-record ownership implications remain to be defined.
- [x] Owner approved 90-day retention for application D1 audit rows; scheduled cleanup code and tests are included. Cloudflare platform invocation-log retention remains separate.
- [x] Set the beta support route: WhatsApp with the owner; email fallback plus account- and family-deletion requests at vtr.ravikumar@gmail.com.
- [ ] Review the wording against the deployed service and approve publication.

The 90-day application audit retention and manual owner-reviewed account-deletion policy are approved. Keep this file labelled as a draft until scheduled cleanup is deployed and verified and the owner completes the participant-facing wording review.
