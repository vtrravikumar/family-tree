# Family Tree

A collaborative family heritage platform. Product branding is intentionally undecided; the repository name is `family-tree`.

## Project status

- Product specification: baseline v0.1
- Current milestone: production-readiness hardening (M3.3 complete; live development D1 verification remains pending)
- Market: India initially; architecture intended to support international use
- Hosting target: Cloudflare Pages + Workers
- Working product name: Vansvriksh (provisional)
- Development frontend: `https://vansvriksh-web-dev.pages.dev`
- Development API: `https://api-dev.vtrrk.in`
- M3.2 development deployment: reported deployed with CI passing; latest baseline CI was verified green on `9766744`
- Production environment, database, secrets and deployment are not configured or approved

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
