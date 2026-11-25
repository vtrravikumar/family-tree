# Production and Beta Readiness Audit

**Date:** 2026-11-25
**Scope:** `main` branch at commit `93e780a` ("docs: define finite friends and family beta closure plan (#91)")
**Method:** Static review of the Worker API, D1 schema, frontend, CI and docs, plus local execution of typecheck, tests and dependency audit.

## 1. Summary

| Stage | Verdict |
|---|---|
| Friends & Family beta | **Not yet ready; close.** Roughly 1–2 focused weeks if the blockers below are closed. The tracker's 65/100 is credible. |
| Full v1.0 production | **Not ready.** Consistent with the 15/27 (56%) production checklist. |

### Verification performed

- `pnpm typecheck`: passes for `apps/web`, `packages/shared`, `workers/api`.
- Tests: 84 Worker unit, 19 D1 integration, 5 web. **108 passing.**
- `pnpm audit --prod`: no known vulnerabilities.
- `pnpm audit` (all): 53 advisories (7 low, 28 moderate, 15 high, 3 critical). All are in dev tooling (vitest, tinypool, vite, undici, sharp via wrangler); none are in production dependencies.

### Not performed

- **Live testing.** CORS, cookie attributes, TLS and security headers on the deployed hosts were not verified.
- **Git-history secrets scan.**
- **The `production` branch.** Confirm it carries the same code as `main`.
- Accessibility, rendering performance and visual QA.

## 2. Strengths

- Role checks are repeated inside the SQL of each write, and audit rows are gated on `changes()=1`, so stale roles cannot win a race.
- Composite foreign keys `(person_id, family_id)` enforce cross-family integrity in the schema. A partial unique index enforces one owner per family. Non-members receive 404.
- Session tokens and invite codes are 256-bit random values stored only as SHA-256 hashes. Cookies are HttpOnly, Secure, SameSite=Lax.
- Fixed-window rate limits on sign-in and invitations. Sample family is read-only server-side. Deceased profiles are immutable.
- Production build guard fails closed on a missing or development API URL.
- A disposable D1 restore rehearsal passed and a Time Travel bookmark was observed.
- Strong test culture for the API: race, rollback and write-time authorization cases are covered.

## 3. Findings

| # | Severity | Area | Finding |
|---|---|---|---|
| 1 | High | Import | Data loss and wrongful merges |
| 2 | High | Privacy | Family data embedded in public JS bundle |
| 3 | High | Access | Sign-in open to any Google account |
| 4 | Medium | Config | Frontend API fallback points at wrong host |
| 5 | Medium | Edge | No frontend security headers |
| 6 | Medium | Ops | No logging or error reporting; weak alert path |
| 7 | Medium | Cost/abuse | Hidden write load, no usage caps |
| 8 | Medium | Lifecycle | No ownership transfer, account deletion or session revoke-all |
| 9 | Low | Various | See section 3.9 |

### 3.1 Import loses data and can merge different people (High)

Location: `workers/api/src/index.ts`, `POST /v1/families/:familyId/import`.

- People are matched to existing records by normalized display name only. Distinct relatives with the same name silently merge.
- The normalizer is `toLocaleLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu," ")`. It strips combining marks, so Devanagari names can collide. Verified: "सीता" and "सुता" both normalize to "स त".
- New people are inserted with only exact birth/death dates. `birthDateKind === "exact" ? "exact" : "exact"` is a no-op. Year-only, approximate-year and range dates, plus `birth_place` and `birth_country`, are dropped. This conflicts with the product rule that historical dates are never fabricated or lost, and it makes export→import lossy.
- Matched existing people are never updated, except for a hard-coded special case: `sourceName === "Varsha" || "Bhoodevi"` with `gender === "female"` updates gender. This is dataset-specific logic inside a generic multi-tenant endpoint.
- Limits are 100 people, 250 relationships and a 64 KB body, while the workbook export has no limit. An oversized body returns a misleading `confirmation_required` error.
- Docs state the dev→prod transfer verified "memberships/roles". The import endpoint carries no membership data, so this claim could not be reconciled with the code.

**Fix:** carry all date-precision fields and place fields; require explicit matching by exported `person_id` (or show a preview and let the user confirm matches); remove the name special case; return accurate size errors; or, for beta, document the limits plainly.

### 3.2 Family data embedded in the public JS bundle (High)

`apps/web/src/ramanImportData.ts` holds gzip+base64 JSON (about 9 KB when decoded) of named people with parent/partner links. `App.tsx` imports it, so any visitor can decode it, and the repository is public. If these are real relatives, this contradicts "private by default".

**Fix:** remove it from the bundle; if it is real data, consider purging it from git history.

### 3.3 Sign-in is open to any Google account (High)

Any verified Google identity can register. Each user is attached to the sample family and can create unlimited families.

**Fix:** gate beta sign-up with an email allowlist or invite-only registration. Also check whether the Google OAuth consent screen is in Testing mode.

### 3.4 Frontend API fallback points at the wrong host (Medium)

`App.tsx` falls back to `https://api-dev.vtrrk.in`, not `https://api-dev.vansvriksh.vtrrk.in`. The README states the `vtrrk.in` API namespace belongs to TweetPilot. Any build without `VITE_API_URL` (local, Pages previews) would send Google credentials to the wrong host.

**Fix:** correct the host, or fail closed everywhere.

### 3.5 No frontend security headers (Medium)

`apps/web/public` has no `_headers` file: no CSP, frame-ancestors, Referrer-Policy or Permissions-Policy. HSTS depends on Cloudflare zone settings. The API sets only `x-content-type-options: nosniff` and `cache-control: no-store`. The CSP must allow the Google Identity Services script.

### 3.6 Observability (Medium)

- Every `catch` swallows errors and there is no application logging. `[observability]` is not enabled in `wrangler.toml`.
- Alerting is a 15-minute GitHub Actions cron. Scheduled workflows are best-effort and are disabled on inactive public repositories. The notification path is unverified. `/health` only runs `SELECT 1`.

**Fix:** enable Workers Logs without personal data; add an external uptime check with a verified notification path.

### 3.7 Hidden write load and no abuse limits (Medium)

- `currentSession` issues `UPDATE auth_sessions SET last_seen_at` on every authenticated request and is called twice per request (`authorize` and `api`). That is two D1 writes per call. On Workers Free, check against daily D1 write limits.
- No per-user caps on families, people or biography length, and no general API rate limit.
- The body-size check reads `Content-Length`; chunked requests bypass it and `request.json()` buffers the whole body.

### 3.8 Lifecycle gaps (Medium)

- Two error messages point to an ownership transfer workflow, but the route inventory has none. The owner cannot leave or be removed.
- No account deletion or revoke-all-sessions. Expired sessions and invitations are never cleaned up.
- Family deletion is a hard delete; recovery is only D1 Time Travel (7 days on Workers Free).

### 3.9 Smaller items (Low)

- Google ID token checks omit a nonce. The JWKS cache does not refetch on an unknown `kid`, so key rotation can break sign-in for up to an hour.
- The Origin check applies only when an `Origin` header is present. Consider also checking `Sec-Fetch-Site`.
- The dev API allowlist includes the production web origin, and dev and prod share one Google OAuth client ID.
- `PUT` person resets omitted fields (for example, birth data and biography) rather than leaving them unchanged.
- Platform user and family list endpoints are not written to the platform audit log. The single super-admin account (auto-bootstrapped by email on login) should have strong 2FA.
- No committed `pnpm-lock.yaml`; CI runs `pnpm install --no-frozen-lockfile`, so builds are not reproducible. `lint` is only `tsc`. No Dependabot or CODEOWNERS.
- A bare `wrangler deploy` (no `--env`) would deploy with development vars.
- `index.ts` is one large `api()` function with the ancestry-cycle SQL duplicated several times. `App.tsx` is about 56 KB of dense lines with almost no tests (web has 5 tests, all for the environment guard).
- Docs drift: README still says PR #47 is open; the 15/27 and 65/100 scores use different denominators; a typo in `ROUTE_AUTHORIZATION_AUDIT.md` ("`main)`"); the UI says "Vansvriksha" while docs say "Vansvriksh".

## 4. Beta readiness

### Already planned in `BETA_CLOSURE_PLAN.md`

Live role and cross-family matrix, SQL export to R2 with a disposable restore, production edge checks, alert delivery test, short privacy notice, support and rollback note, intended-account acceptance, and explicit go/no-go.

### Recommended additions to the beta gate

1. Gate sign-up (allowlist or invite-only) — 3.3
2. Fix the fallback API host — 3.4
3. Remove the embedded data and the name-specific import logic — 3.1, 3.2
4. Add a `_headers` file with CSP and framing protection — 3.5
5. Enable real logging — 3.6
6. Fix import fidelity, or document the limits (exact dates only, name-based merging, 100-person cap) — 3.1
7. Take an off-platform backup before inviting anyone

## 5. Production v1.0: gaps beyond beta

- Import preview, validation and duplicate handling
- Retention and cleanup jobs; account deletion; ownership transfer; revoke-all-sessions
- Pagination and per-user quotas; evaluate the paid Workers plan (longer Time Travel retention, higher limits)
- Frontend test coverage; committed lockfile; dependency update automation
- Release notes, rollback runbook and formal approval
- Privacy policy and terms covering living people's data. If users beyond close family are expected, review obligations under India's DPDP Act (this is not legal advice).
