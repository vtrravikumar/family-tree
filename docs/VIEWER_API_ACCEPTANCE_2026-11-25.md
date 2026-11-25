# Development Viewer API Acceptance — 2026-11-25

## Environment and identity

- Frontend: `https://dev.vansvriksh.vtrrk.in`
- API: `https://api-dev.vansvriksh.vtrrk.in`
- Test identity: Ravi Kumar, signed in with the Viewer role.
- Family: Komal Family
- Family ID: `d5933c41-b147-44d3-9398-cc352e156fbd`
- Scope: development only. No production data or configuration was changed.

## UI acceptance

Owner-confirmed Viewer screenshot shows the explicit **READ-ONLY FAMILY VIEW**, with the family tree and family summary visible. Per the product interaction model, selecting a person in the tree only focuses/selects that person; it does not open edit/delete actions for any role. People management and relationship management are separate areas and are unavailable to Viewers. Member and invitation management controls are also not presented in the Viewer experience.

## Live API results

Requests were made from the signed-in development browser using `credentials: "include"`.

| Request | HTTP | Observed result |
|---|---:|---|
| `GET /v1/families/{familyId}/identity` | 200 | `canReview: false`, `canDirectClaim: false` |
| `GET /v1/families/{familyId}/members` | 403 | `Viewer access cannot view the family member roster` |
| `GET /v1/families/{familyId}/invitations` | 403 | `Only a family owner or admin can view invitations` |

All three results match the expected Viewer authorization policy. The requests were read-only and did not create, update or delete data.

## Limits of this evidence

- This verifies these three live API endpoints for the Viewer role in development only.
- It does not establish exhaustive route-by-route authorization coverage.
- Editor negative API checks, additional cross-family/resource-ID probes, identity-claim edge cases and production role acceptance remain outstanding.
- This evidence does not authorize or imply a production change.

## Readiness scoring

This evidence supplements the existing partial evidence for route authorization and end-to-end role acceptance. It does not by itself complete either control or justify a score increase. Keep the beta readiness score at **65.0/100** until the remaining matrix and operational gates have evidence.
