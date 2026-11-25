# Person Photo Management — Feature Design

**Status:** Design review; no implementation or infrastructure changes authorized by this document  
**Scope:** Family-tree person portraits and approved Google identity photos

## 1. Goals

Provide two independent photo sources for a person represented in a family:

1. **Family portrait** — an image uploaded for the family-tree person and managed by authorized family members.
2. **Google identity photo** — the profile image from the Google account associated with that person through an approved `person_identity_links` record.

The family portrait and Google identity photo must never overwrite or mutate one another. A person does not need a Google account to have a family portrait.

## 2. Confirmed product decisions

### Role permissions

| Family role | View photos | Upload/change family portrait | Remove family portrait |
|---|---:|---:|---:|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Editor | Yes | Yes | Yes |
| Viewer | Yes | No | No |

Authorization must be enforced by the API for every operation. Hiding controls in the frontend is not authorization.

### Display precedence and fallback

1. If a family portrait exists, display it as the primary portrait.
2. Otherwise, if the person has an approved Google identity link and that linked user's Google photo is available, display the Google photo.
3. Otherwise, display the existing initials avatar.

Removing a family portrait must reveal the Google photo when available, otherwise the initials avatar. Removing a portrait must not unlink the Google identity, withdraw a claim, or change family membership.

### Identity-link rules

- Only an approved `person_identity_links` association qualifies a person for a Google identity photo.
- Pending, rejected or withdrawn claims do not expose a Google photo as that person's photo.
- An unlinked person's Google account photo must not be inferred from matching names or email addresses.
- Unlinking an identity removes the Google-photo fallback but does not delete the family portrait.
- The current authenticated user's Google profile photo is already stored in `users.avatar_url` and refreshed from the verified Google sign-in credential. The person-photo API should obtain the Google photo through the approved identity link, not copy it into the person's portrait field.

## 3. Current architecture findings

The current repository already establishes:

- Cloudflare Worker API as the authorization and business-rule authority.
- D1 for relational data.
- Cloudflare R2 as the intended object store for profile photographs and other private media.
- Private-by-default media, accessed through authorized API flows.
- A `media` table with `family_id`, `person_id`, `object_key`, `media_type`, `content_type`, `byte_size`, metadata and uploader.
- `person_identity_links` joining a family-scoped person to a registered user.
- `users.avatar_url` containing the Google profile image URL.
- Existing family role checks in the API for Owner/Admin/Editor mutations.

Important gap: the current `workers/api/wrangler.toml` has D1 bindings but no R2 bucket binding in either dev or production. R2 is described in architecture but is not yet provisioned/configured in this Worker.

## 4. Recommended storage and access design

### R2

Use one private R2 bucket per environment, with separate bindings and credentials:

- Development: dedicated Vansvriksh development bucket.
- Production: dedicated Vansvriksh production bucket.

Do not share buckets between environments. Do not enable public bucket access or expose R2 object keys as public URLs.

Use opaque, unpredictable object keys scoped by family and person, for example:

`families/{familyId}/persons/{personId}/portraits/{randomId}`

The key must not contain a person's name, email, Google subject or other personal information.

### Upload flow

1. Authenticated Owner/Admin/Editor requests an upload for a person in a family they can access.
2. API verifies family membership, role, person/family association and upload constraints.
3. Browser sends the image to an authenticated API upload endpoint (or a short-lived upload URL only if a later design proves it necessary).
4. API validates actual file signature, supported media type and byte limit; do not trust the filename or browser-supplied Content-Type.
5. API writes the object to the environment's private R2 bucket.
6. API records the media metadata in D1 and makes the new portrait active.
7. API emits a safe audit event without storing image contents or sensitive metadata in the audit summary.

The D1 pointer must not be committed before the R2 write succeeds. If the D1 write fails after R2 succeeds, attempt to remove the orphaned object and log/handle cleanup failure safely.

### Read flow

- Return a same-origin/API-controlled photo URL or authenticated photo endpoint, not a public R2 URL.
- The read endpoint must verify current family membership before serving the object.
- Viewer can read; non-members and revoked members cannot.
- Use appropriate content type, `X-Content-Type-Options: nosniff`, private cache policy and safe response headers.
- Do not use a user-controlled object key directly. Resolve the object key from the authorized D1 media row.
- Avoid long-lived browser caching that would continue to expose a photo after membership is revoked. A short private cache lifetime or `no-store` is the conservative initial choice.

### Removal and replacement

- Removal deletes/deactivates only the family portrait record and its R2 object; it does not alter identity links or Google account data.
- Replacement must be safe against partial failure: upload and validate the new object first, atomically point the person to the new media row, then remove the old object. Failed cleanup should be retryable.
- Family/person deletion must not leave orphaned R2 objects. D1 cascade deletion alone cannot delete R2 objects; add an explicit cleanup strategy before enabling photo deletion flows.

## 5. Image validation and limits — proposal for approval

Recommended initial limits:

- Maximum upload size: **5 MiB**.
- Accepted formats: **JPEG, PNG and WebP**.
- Reject SVG, HTML, arbitrary binary files and animated formats.
- Validate file signatures (magic bytes), not just extension or declared MIME type.
- Generate a random object key; never use the uploaded filename as the storage key.
- Set a safe image response Content-Type from the validated format.
- Provide client-side preview and clear upload/replace/remove feedback.

Image dimensions and image re-encoding/metadata stripping need a deliberate implementation choice. Browser-side re-encoding can reduce size and remove some metadata but is not a security boundary. If server-side normalization is required, select and test a Cloudflare-compatible image-processing approach before implementation.

## 6. Google photo lifecycle and privacy

- The source is the linked user's existing `users.avatar_url`, which is updated when that user signs in with a verified Google credential.
- Do not permanently copy the Google image into R2 by default.
- Do not treat a Google photo URL as proof of identity; the approved database identity link is the authorization condition.
- A Google photo can change or become unavailable. The UI must gracefully fall back to initials when the URL is absent or the image fails to load.
- Direct browser loading of a Google-hosted image causes the viewer's browser to contact Google's image host. This is a privacy consideration. A same-origin image proxy could reduce direct browser disclosure but adds SSRF, host-validation, caching and operational complexity. Keep direct loading as the simpler initial option only after documenting this trade-off; evaluate a tightly allowlisted proxy separately if privacy requirements call for it.
- Never accept an arbitrary external image URL from a client and proxy it.

## 7. Data model proposal

The existing `media` table is a suitable starting point. Avoid adding a second photo table unless implementation review finds a concrete limitation.

Proposed convention:

- `media_type = 'person_portrait'` for the family-uploaded portrait.
- One active family portrait per person, enforced by a database uniqueness constraint or an explicit active-pointer model.
- Store only validated media metadata and the opaque R2 key.
- The effective display photo is derived at read time:
  - active family portrait, else
  - `person_identity_links` joined to `users.avatar_url`, else
  - initials generated by the frontend.

Do not store the computed Google URL redundantly on `persons`; it can become stale and could survive unlinking incorrectly.

A migration should be additive and preserve existing `media` rows used by historical sources and other features.

## 8. API surface proposal

Exact route names are subject to implementation review, but the API should support:

- Read person photo metadata/effective source for an authorized family member.
- Upload or replace a family portrait (Owner/Admin/Editor).
- Remove the family portrait (Owner/Admin/Editor).
- Serve the private image after rechecking family membership.

All operations must validate that the person belongs to the requested family. Mutations should write audit events such as `person.portrait_uploaded`, `person.portrait_replaced` and `person.portrait_removed`. Do not log image bytes, signed URLs or Google tokens.

## 9. UI proposal

Provide a consistent avatar component used in:

- Family tree nodes.
- Person details/profile.
- Family directory and relevant person lists.

For Owner/Admin/Editor, expose photo actions in the person's profile: upload, replace and remove. Viewer sees the photo but no mutation controls.

When both sources exist, the uploaded family portrait is the main avatar. The Google identity photo may be shown as a small secondary identity indicator, with a clear accessible label; avoid two competing large portraits.

If a photo cannot load, fall back in order to Google photo (if eligible and loadable), then initials.

## 10. Security and test requirements

Tests must cover:

- Owner/Admin/Editor can upload, replace and remove.
- Viewer can read but cannot mutate (API returns 403).
- Non-member cannot read or mutate.
- A person ID from another family cannot be used.
- Pending/unapproved identity claims do not expose a Google photo.
- Approved identity link enables Google photo fallback.
- Unlinking removes Google fallback but leaves family portrait intact.
- Removing family portrait reveals Google photo or initials.
- Failed Google image load falls back to initials.
- Invalid MIME/signature, oversized files and SVG are rejected.
- Object key is not guessable from user data and R2 is not publicly accessible.
- Upload/DB failure and replacement cleanup do not leave an active broken pointer.
- Family/person deletion and cleanup do not orphan R2 objects.
- Deceased-person policy is enforced consistently (see open decision below).
- Audit records contain no photo bytes, Google token or sensitive URL.

## 11. Rollout plan

1. Approve this design and resolve open decisions.
2. Add D1 migration and environment-specific R2 bindings/buckets, initially in development only.
3. Implement API upload/read/remove and tests.
4. Implement shared frontend avatar rendering and profile controls.
5. Test development end-to-end with Owner/Admin/Editor/Viewer accounts.
6. Review storage cleanup, privacy and operational cost.
7. Only then plan production R2 provisioning, migration and deployment with explicit approval.

No production R2 bucket, binding, migration, or application change is authorized by this design document.

## 12. Open decisions before implementation

1. **Deceased persons:** Should Owner/Admin/Editor still be allowed to upload/change/remove a portrait for a deceased person, or should the existing deceased-profile immutability rule also lock portraits?
2. **Upload limit and formats:** Approve the proposed 5 MiB JPEG/PNG/WebP limit, or specify another limit.
3. **Google photo presentation:** Approve direct Google-hosted image loading (simpler, but viewers' browsers contact Google), or require a same-origin proxy despite its added complexity.
4. **Image processing:** Is client-side resize/preview sufficient for the first release, or is server-side image normalization/metadata stripping required?
5. **Photo visibility:** This design assumes photos follow the existing private family membership boundary and are visible to every current family member, including Viewers. Confirm if this is correct.
