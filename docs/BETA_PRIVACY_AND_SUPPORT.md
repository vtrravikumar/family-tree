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

## 5. Sessions, logout, deletion and retention — owner decisions required

### Implementation facts verified in source and regression tests

- A successful Google sign-in creates a server-side session with an absolute expiry seven days after creation. The same seven-day value is placed in the browser cookie's `Max-Age`.
- Authenticated requests look up the session by its token hash and reject it after the stored expiry. The inspected implementation does not establish a separate idle timeout or sliding renewal.
- Logout deletes the matching server-side session and clears the browser cookie. A regression test checks that the logout response clears the cookie; the route implementation performs the server-side deletion.
- Invitations are created with a seven-day expiry, can be accepted only while pending and unexpired, and are single-use. Owner/Admin can revoke a pending invitation; invitation acceptance and expiry/revocation paths have regression coverage.
- Owner/Admin member removal deletes the family-membership row and writes an audit event. Subsequent family access is governed by current family membership, so this removes that user's access to that family; it does not delete the user's Google identity or membership in other families.

These are implementation observations, not a substitute for owner approval of the participant-facing wording or a live acceptance test.

### Decisions and evidence still required before publication

| Topic | Proposed beta expectation | Approval / evidence |
|---|---|---|
| Session expiry and logout | State that sessions expire after seven days and users can sign out to invalidate the current session. Advise signing out on shared devices. | Source and regression-test review completed; owner to approve participant-facing wording. |
| Invitation expiry and revocation | Invitations expire after seven days, are single-use and may be revoked by a family Owner/Admin while pending. | Implemented behaviour; retain regression coverage. |
| Member access removal | Owner/Admin can remove a member; removal ends that member's access to that family on subsequent requests. | Source and regression-test review completed; owner to approve wording. |
| Account deletion | Do not promise self-service account deletion. Provide a manual request route during beta and explain that Google sign-in identity and family-owned records are distinct. | Owner to name the request route and decide how family-owned records are handled. |
| Family deletion | Do not promise immediate irreversible erasure; verify audit, backup and recovery implications before communicating deletion timing. | Owner approval required. |
| Audit and technical logs | No retention period is promised until configured and reviewed. Document what is retained, who can access it and when it is deleted. | Owner to set and document a retention period; deployed-log review remains outstanding. |
| Backups | Backup destination, access, schedule and retention remain subject to the separate backup approval and recovery evidence. | Deferred operational item; do not imply complete backup coverage. |

## 6. Beta participant guidance

- Share invitations privately and only with the intended person.
- Use the least-privileged role that meets the participant's needs.
- Do not forward an invitation link; it is intended for the invited Google account.
- Review family information before entering it and obtain appropriate consent before adding details about living relatives.
- Report an incorrect, exposed or unexpectedly changed record promptly to the beta owner.
- Do not use the beta as the sole copy of important family records during this early access period.

## 7. Support route

During the Friends & Family beta, participants should contact the Vansvriksh beta owner through WhatsApp using the contact details they already have. If WhatsApp is unavailable or a written email route is preferred, participants may email **vtr.ravikumar@gmail.com**. This email address is also the fallback contact for account-deletion requests.

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
- [ ] Choose a manual account-deletion request route and decide family-record ownership implications.
- [ ] Decide audit/technical log retention and communicate the chosen period.
- [x] Set the beta support route: WhatsApp with the owner; email fallback and account-deletion requests at vtr.ravikumar@gmail.com.
- [ ] Review the wording against the deployed service and approve publication.

Until these decisions are complete, keep this file labelled as a draft and do not award beta readiness points for privacy/lifecycle or support/incident controls solely because this document exists.
