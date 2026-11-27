# Vansvriksh Friends & Family Beta — Participant Notes

**Status: Owner-approved staged beta plan and participant privacy/lifecycle wording. Production Worker deployment is complete; participant distribution remains held until the first scheduled cleanup execution is verified and Control 17 is closed.**  
**Audience:** Close family, siblings and selected relatives, invited gradually by the owner. Initial role: Viewer for every participant.

## What this beta is for

Vansvriksh is an early-access family-history application. This bounded beta is intended to validate everyday family workflows with a small group: creating or selecting a family, maintaining people and relationships, viewing family information, and collaborating through assigned family roles.

This is a limited UAT release, not a declaration that the product is complete or formally certified.

## What participants can do

For the initial staged cohort, participants will be assigned the **Viewer** role. They can view family information and the family tree. Editing, importing/exporting and membership administration are not part of the initial Viewer access. Any later role changes will be made deliberately by the owner after reviewing beta feedback.

For future role assignments, the application supports role-dependent capabilities such as:
- View family information and the family tree.
- Add or update people and relationships where their role permits.
- Invite family members and manage membership where their role permits.
- Export or import supported family workbook data where their role permits.

A Google sign-in alone does not grant access to a family. Access is controlled by membership in that family and the role assigned there.

## Important limitations and data-safety guidance

- Treat this as an early-access service. Features and workflows may change during the beta.
- Do not use Vansvriksh as the only copy of important family records. Keep your own appropriate copy of information you cannot afford to lose.
- Do not enter passwords, financial details, government identity numbers, medical records or other highly sensitive information that is not needed for family history.
- Obtain appropriate consent before adding personal details about living relatives.
- Family information is shared with members who are authorized for that family. The service is not an end-to-end encrypted private vault.
- Invitations are intended only for the invited email identity. Do not forward invitation links.
- Use the least-privileged role that supports the participant's needs.
- Sessions have a seven-day absolute expiry. Sign out when finished, especially on a shared device.
- Family Owners/Admins can remove members; removal ends access to that family on subsequent requests.
- There is no self-service account-deletion flow during this beta. Account-deletion requests are reviewed manually by the owner. Do not assume that deleting a family and deleting a Google account are the same operation.
- Backup and disaster-recovery arrangements are not represented as a complete production-grade service for this beta.

## Support and reporting problems

Contact the beta owner through WhatsApp using the contact details already shared with you. If WhatsApp is unavailable or you prefer email, write to **vtr.ravikumar@gmail.com**.

Please report suspected unauthorized access, exposed information, unexpected changes or data loss promptly. Include the approximate time and timezone, the affected family/workflow, what you tried and what happened. A screenshot can help, but remove unrelated personal information first.

Never send passwords, Google verification codes, session cookies, invitation links or API credentials in a support report.

For account-deletion requests, or help with family deletion, email **vtr.ravikumar@gmail.com**. The owner will verify the requester and review family ownership and continuity before taking any action. Do not expect immediate deletion or assume shared family data will be deleted by default.

## What we ask from beta participants

- Use the application for normal family-history tasks, within the role assigned to you.
- Tell us when something is confusing, incorrect, inaccessible or unexpectedly editable.
- Report suspected cross-family visibility or permission problems immediately and stop using the affected workflow until the owner responds.
- Do not deliberately test destructive actions or attempt to access another family's information.
- Share feedback through the support route above. Please avoid sending family records or sensitive personal details unless specifically necessary and agreed.

## Owner release checklist — not participant instructions

Before invitations are sent, the owner must:
- [x] Owner approved this participant note as the staged beta plan on 2026-11-25; the companion privacy/lifecycle wording remains subject to Control 17 closure.
- [x] Confirmed initial cohort: close family, siblings and selected relatives; all initially Viewer-only.
- [x] Support route approved: WhatsApp with the owner; email fallback vtr.ravikumar@gmail.com.
- [x] Owner approved participant-facing privacy/lifecycle wording on 2026-11-26.
- [ ] Verify Control 17's first scheduled cleanup execution before sending invitations. Production Worker deployment succeeded on 2026-11-27 ([run 46004637576](https://github.com/vtrravikumar/family-tree/actions/runs/46004637576)); no D1 migrations were pending or applied. The first post-deployment cron execution is expected 2026-11-28 at 07:47 IST.
- [x] Conditional GO approved for a manually managed, gradual invitation sequence after Control 17 closes. The owner will send invitations personally; no automated or bulk invitation campaign.

**Current release state:** Staged beta plan approved; invitations are not yet authorized. The owner will send invitations manually and gradually only after Control 17 is closed. This document does not authorize automated invitations or bulk rollout.


## Privacy and lifecycle disclosure — owner approved 2026-11-26

The owner approved the following participant-facing disclosures for the bounded Friends & Family beta:

- Google sign-in by itself does not grant access to any family; access requires membership in that family.
- Family information is shared with members authorized for that family. Vansvriksh is not an end-to-end encrypted private vault.
- Participants should not enter passwords, financial details, government identity numbers, medical records or other highly sensitive information that is not needed for family history.
- Participants should obtain appropriate consent before adding personal details about living relatives.
- Sessions have a seven-day absolute expiry. Participants should sign out when finished, especially on shared devices.
- Invitations are intended for the invited email identity, expire after seven days and should not be forwarded.
- Family Owners/Admins can remove members; removal ends access to that family on subsequent requests.
- Account deletion is not self-service during this beta. Requests are manually reviewed by the owner at vtr.ravikumar@gmail.com; no immediate-deletion guarantee is made.
- Important family records should not be kept only in Vansvriksh. Participants should retain their own appropriate copies.
- Backup and disaster-recovery arrangements are not represented as a complete production-grade service for this beta.

This approval covers the participant-facing wording only. The migration-free production Worker deployment completed successfully on 2026-11-27 ([run 46004637576](https://github.com/vtrravikumar/family-tree/actions/runs/46004637576)); the remote D1 check reported no migrations to apply and production API health reported the database connected. This does not close Control 17 or authorize invitations. Control 17 remains open until the first scheduled production cleanup execution is observed and recorded. The first post-deployment cron execution is expected 2026-11-28 at 07:47 IST.
