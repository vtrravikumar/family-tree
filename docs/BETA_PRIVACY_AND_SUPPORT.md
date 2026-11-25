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

The following must be explicitly reviewed and approved before this note is published as the beta privacy notice:

| Topic | Proposed beta expectation | Approval / evidence |
|---|---|---|
| Session expiry and logout | Users should sign out on shared devices; verify the actual session lifetime and that logout invalidates the current session. | Owner to verify implementation and approve wording. |
| Invitation expiry | Invitations expire after seven days and are single-use. | Implemented behaviour; retain regression coverage. |
| Member access removal | Removing a member should stop future access to that family. | Verify with a bounded test account before making a public promise. |
| Account deletion | Do not promise self-service account deletion unless the feature and downstream data handling are implemented. Provide a manual request route during beta. | Owner to name the request route and decide how family-owned records are handled. |
| Family deletion | Do not promise immediate irreversible erasure; verify audit, backups and recovery implications before communicating deletion timing. | Owner approval required. |
| Audit and technical logs | Retain only what is necessary for security, troubleshooting and accountability. No retention period is promised until configured and reviewed. | Owner to set and document a retention period. |
| Backups | Backup destination, access, schedule and retention remain subject to the separate backup approval and recovery evidence. | Deferred operational item; do not imply complete backup coverage. |

## 6. Beta participant guidance

- Share invitations privately and only with the intended person.
- Use the least-privileged role that meets the participant's needs.
- Do not forward an invitation link; it is intended for the invited Google account.
- Review family information before entering it and obtain appropriate consent before adding details about living relatives.
- Report an incorrect, exposed or unexpectedly changed record promptly to the beta owner.
- Do not use the beta as the sole copy of important family records during this early access period.

## 7. Support route

During the Friends & Family beta, the support contact is the Vansvriksh beta owner. The owner should share a direct contact route with each participant when issuing the invitation. Do not publish a personal phone number or email address in this repository without an explicit decision.

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

- [ ] Verify actual session expiry and logout behaviour.
- [ ] Confirm member removal and role downgrade take effect as expected.
- [ ] Choose a manual account-deletion request route and decide family-record ownership implications.
- [ ] Decide audit/technical log retention and communicate the chosen period.
- [ ] Share the beta support contact directly with participants.
- [ ] Review the wording against the deployed service and approve publication.

Until these decisions are complete, keep this file labelled as a draft and do not award beta readiness points for privacy/lifecycle or support/incident controls solely because this document exists.
