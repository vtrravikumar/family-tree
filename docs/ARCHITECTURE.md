# Architecture

## Goals

Keep the product modular, secure and inexpensive to operate initially while supporting many independent family workspaces.

## System components

- **Web:** React, TypeScript and Vite; deployed to Cloudflare Pages.
- **API:** TypeScript Cloudflare Worker; owns authentication/session validation, authorization and business rules.
- **Database:** Cloudflare D1 for relational application data.
- **Object storage:** Cloudflare R2 for profile photographs, documents and generated exports.
- **Shared package:** TypeScript contracts shared by frontend and API.
- **Future collaboration:** Durable Objects and WebSockets, introduced only when real-time editing is required.

## Architectural boundaries

1. The relationship domain model must not depend on the tree visualization library.
2. Person profiles, application users and family workspaces are separate concepts.
3. The API is the authority for all authorization and domain invariants.
4. The frontend must not be trusted to enforce profile immutability or workspace access.
5. Media objects are private by default and accessed through authorized API flows.
6. Database changes are versioned migrations.

## Initial request flow

Browser -> Cloudflare Pages frontend -> Cloudflare Worker API -> D1/R2.

Google Identity Services supplies an identity token. The API validates it with Google's supported verification mechanism, maps the identity to an application user, and issues a secure session. Do not store Google access or ID tokens as the application's long-lived session.

## Environments

Maintain separate development, staging and production configuration. D1 databases, R2 buckets, secrets and allowed origins must not be shared across environments.

### Current and intended web routing

- The development Pages project is `vansvriksh-web-dev.pages.dev`; proposed signed-in development frontend: `https://dev.vansvriksh.vtrrk.in`.
- Current development API: `https://api-dev.vtrrk.in`; proposed development API: `https://api-dev.vansvriksh.vtrrk.in`. Add the new API Custom Domain and keep the current host until sign-in, CORS and session cookies work through the new frontend/API pair.
- Temporary current mapping: `https://vansvriksh.vtrrk.in` serves the development frontend and calls the development API.
- Intended production mapping: keep the Pages development address dedicated to development and route `https://vansvriksh.vtrrk.in` to an isolated production frontend and API once its Worker, D1 database, secrets, allowed origins, and release process are ready and verified. This is the intended production web address until a dedicated product domain is selected.
- Proposed production API hostname: `https://api.vansvriksh.vtrrk.in`. Keep `https://api.vtrrk.in` assigned to TweetPilot during Vansvriksh setup. A future TweetPilot move to `https://api.tweetpilot.vtrrk.in` should be a separate migration; retain the old host until its clients and integrations have moved and been verified.
- Use `dev.vansvriksh.vtrrk.in` as the signed-in dev frontend so it is same-site with the proposed `api-dev.vansvriksh.vtrrk.in`. The app's session cookie is `SameSite=Lax`; the Pages `pages.dev` preview is a different site, so keep it as a preview and validate cookie behavior on the custom dev hostname.
- Do not switch the vanity hostname until the production frontend/API and data environment are ready; keep development accessible through its dedicated frontend and API.

### Hostname transition order

1. Add `dev.vansvriksh.vtrrk.in` as a custom domain on the existing development Pages project and authorize it in Google Identity Services.
2. Add `api-dev.vansvriksh.vtrrk.in` as a Worker Custom Domain and include the dev frontend origin in the API allowlist.
3. Set the development Pages `VITE_API_URL` to the new development API, then verify sign-in, session cookies and CORS.
4. Keep the old dev API alias until verification succeeds. Before the production web hostname moves to production, remove that production origin from the dev API allowlist.
5. For production, use `vansvriksh.vtrrk.in` with `api.vansvriksh.vtrrk.in`; keep `api.vtrrk.in` with TweetPilot.

## Tree layout

Use React Flow for interactive rendering and evaluate ELK.js for automatic graph layout. The domain layer produces a graph representation; the layout adapter translates it into visualization nodes and edges.

## Export

The current Excel-compatible family-data export is generated in the browser for Owner/Admin users. UI visibility does not enforce security because family members can read the source data through the API. Add a server-authorized export flow for Platform Super Admin access; require a reason, family scope and platform audit event. Generate presentation exports from the full graph/layout model, not a screenshot of the currently visible viewport. PNG generation should support high-resolution output and selected subgraphs.

## Deferred decisions

- Exact Google OAuth/session implementation details.
- D1 schema refinements after domain model review.
- R2 signed access strategy.
- Durable Object collaboration protocol.
- PDF/poster export implementation.
