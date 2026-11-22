# Family Tree

A collaborative family heritage platform. Product branding is intentionally undecided; the repository name is `family-tree`.

## Project status

- Product specification: baseline v0.1
- Current milestone: production-readiness hardening (M3.3 and shared sample family deployed to development; authenticated live authorization tests remain pending)
- Market: India initially; architecture intended to support international use
- Hosting target: Cloudflare Pages + Workers
- Working product name: Vansvriksh (provisional)
- Development Pages project: `vansvriksh-web-dev.pages.dev`. As of 2026-11-22, both `https://dev.vansvriksh.vtrrk.in` and `https://vansvriksh.vtrrk.in` are active custom domains on this same development project.
- Development API: `https://api-dev.vansvriksh.vtrrk.in`; its Worker Custom Domain is deployed. The owner confirmed Google sign-in and family loading from the development D1 database at the dev frontend on 2026-11-22.
- Important current boundary: the branded `https://vansvriksh.vtrrk.in` hostname still serves the development build and development API because it is attached to `vansvriksh-web-dev`. It is not production and must be moved to a separate production Pages project before inviting users to the production service.
- Intended routing: keep `https://vansvriksh-web-dev.pages.dev` and `https://dev.vansvriksh.vtrrk.in` for development, paired with `https://api-dev.vansvriksh.vtrrk.in`. Move `https://vansvriksh.vtrrk.in` to an isolated production Pages project only after the production Worker, database, API, and frontend are configured and verified. The branded address is the production web address until a dedicated product domain is chosen.
- `https://api.vtrrk.in` is currently used by TweetPilot and must remain untouched during Vansvriksh setup. Proposed production API hostname: `https://api.vansvriksh.vtrrk.in`. A future TweetPilot move to `https://api.tweetpilot.vtrrk.in` should be handled as a separate migration after its clients and integrations are updated.
- M3.3 PR #41: merged with CI passing; development Worker health and unauthenticated API authorization were verified on 2026-11-22
- The `vansvriksh-production` D1 database was created and all ten migrations, including the shared sample-family seed, were applied on 2026-11-22. Production Worker deployment is pending because the current token cannot create the new `family-tree-api-production` script. The production Pages project is not configured; the branded domain remains on the development project.

## Repository layout

- `apps/web` — React + TypeScript + Vite frontend
- `workers/api` — Cloudflare Workers API
- `packages/shared` — shared types and validation contracts
- `docs` — product and engineering documentation

## Prerequisites

- Node.js 22 or newer
- pnpm 10 or newer

## Getting started

```bash
corepack enable
pnpm install
pnpm dev
```

The frontend runs on http://localhost:5173. The API worker can be started separately with `pnpm --filter @family-tree/api dev`.

## Releases and versioning

Formal releases follow Semantic Versioning and are documented in [CHANGELOG.md](CHANGELOG.md). Each release has a matching `vX.Y.Z` Git tag and GitHub Release with user-facing notes, included commits, migration/upgrade guidance, breaking changes, and known limitations. Commits deployed to the development environment are not automatically considered releases.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Product rules to preserve

1. Family workspaces are private by default.
2. User accounts and person profiles are separate entities.
3. Living and deceased are explicit life statuses.
4. Deceased profiles are immutable through all ordinary profile-edit APIs, including for owners and admins.
5. Birth/death dates support exact, year-only, approximate, range and unknown values.
6. Unknown historical dates must never be fabricated.
7. All authorization is enforced server-side.

See [Product Specification](docs/PRODUCT_SPEC.md) and [Architecture](docs/ARCHITECTURE.md).

Track launch blockers and evidence in [Production Readiness](docs/PRODUCTION_READINESS.md) and the [Roadmap](docs/ROADMAP.md).


## Cloudflare development deployment

The `main` branch is configured to deploy the development frontend and API after CI passes.

One-time setup:
1. In Cloudflare, create a Pages project named `vansvriksh-web-dev` and set its production branch to `main`.
2. Create a Cloudflare API token with permission to deploy Workers and Pages for the target account.
3. In GitHub repository Settings → Secrets and variables → Actions, add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push to `main`. GitHub Actions will validate, build, and deploy the frontend and API.

The API uses the Wrangler `dev` environment (`family-tree-api-dev`). Its active development custom domain is `api-dev.vansvriksh.vtrrk.in`; the Pages project has active custom domains `dev.vansvriksh.vtrrk.in` and `vansvriksh.vtrrk.in`, and both currently serve the development build. Do not connect production data stores or treat the branded hostname as production until it is moved to a separate production Pages project.
