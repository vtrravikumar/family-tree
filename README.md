# Family Tree

A collaborative family heritage platform. Product branding is intentionally undecided; the repository name is `family-tree`.

## Project status

- Product specification: baseline v0.1
- Current milestone: production-readiness hardening (M3.3 and shared sample family deployed to development; authenticated live authorization tests remain pending)
- Market: India initially; architecture intended to support international use
- Hosting target: Cloudflare Pages + Workers
- Working product name: Vansvriksh (provisional)
- Development Pages project: `vansvriksh-web-dev.pages.dev`; proposed signed-in development frontend: `https://dev.vansvriksh.vtrrk.in`.
- Current development API: `https://api-dev.vtrrk.in`; proposed development API: `https://api-dev.vansvriksh.vtrrk.in`.
- Temporary current routing (checked 2026-11-22): `https://vansvriksh.vtrrk.in` serves the development frontend bundle and calls the development API. This is not production today.
- Intended routing: retain `https://vansvriksh-web-dev.pages.dev` as the dedicated development frontend; move `https://vansvriksh.vtrrk.in` to the production frontend only after an isolated production frontend, Worker, database, secrets and API origin are configured and verified. This is the production web address until a dedicated product domain is chosen.
- `https://api.vtrrk.in` is currently used by TweetPilot and must remain untouched during Vansvriksh setup. Proposed production API hostname: `https://api.vansvriksh.vtrrk.in`. A future TweetPilot move to `https://api.tweetpilot.vtrrk.in` should be handled as a separate migration after its clients and integrations are updated.
- M3.3 PR #41: merged with CI passing; development Worker health and unauthenticated API authorization were verified on 2026-11-22
- The empty production D1 database is created and its Wrangler environment is staged in PR #44. No production migrations or deployment have run. The production Pages project and API route still need configuration; the branded domain remains on development.

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

The API uses the Wrangler `dev` environment (`family-tree-api-dev`). Do not attach production data stores or custom domains to this development deployment.
