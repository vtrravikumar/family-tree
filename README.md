# Family Tree

A collaborative family heritage platform. Product branding is intentionally undecided; the repository name is `family-tree`.

## Project status

- Current focus: v1.0 friends-and-family release readiness.
- Production API: `https://api.vansvriksh.vtrrk.in`, Cloudflare Worker `family-tree-api-production`, separate D1 database `vansvriksh-production`. The owner verified production environment and connected database health.
- Production frontend: Cloudflare Pages project `vansvriksh-web-production`, production branch `production`, public address `https://vansvriksh.vtrrk.in`; Google sign-in and the shared sample family were confirmed.
- Development frontend/API remain separate at `https://dev.vansvriksh.vtrrk.in` and `https://api-dev.vansvriksh.vtrrk.in`.
- All ten migrations have been applied to production D1. The owner confirmed production Google sign-in, shared sample-family access, family creation, and workbook export/import. Full record-integrity reconciliation, role/invitation acceptance checks, operational alerts, and documented backup procedures remain outstanding. PRs #51 and #53 added sample-viewer family creation and biography-preserving workbook transfer to `production`; the owner has since confirmed family creation and workbook transfer work in production.
- PR #46 (dynamic environment banner) is merged to `production`; PR #47 is open to sync the same change to `main`.
- Production deployment is live for controlled friends-and-family verification. PR #54 is merged to `main`, enabling GitHub validation for `production` pushes and pull requests when that workflow change is present on the target branch. A formal v1.0 release has not yet been tagged or approved; see [Production Readiness](docs/PRODUCTION_READINESS.md) for status and blockers.
- Staged path: complete the beta safety gate, run a bounded Friends & Family beta, then close remaining v1 readiness work. See [Roadmap](docs/ROADMAP.md).
- The product name Vansvriksh remains provisional. `api.vtrrk.in` belongs to TweetPilot and must remain untouched.

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

The API uses the Wrangler `dev` environment (`family-tree-api-dev`). Its planned dev-only custom domains are `api-dev.vansvriksh.vtrrk.in` and `dev.vansvriksh.vtrrk.in`; do not attach production data stores or production domains to this deployment.
