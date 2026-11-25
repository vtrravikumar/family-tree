# Production edge/security verification

## Purpose

Run a read-only check against the deployed production API from a GitHub-hosted runner. This avoids relying on a developer workstation's DNS/network path and does not require production credentials.

## Run

1. Open GitHub Actions for this repository.
2. Select **Production edge security verification**.
3. Click **Run workflow** on `main`.
4. Confirm the job passes.

## What it checks

- HTTPS/TLS certificate validation using curl's default certificate verification (the workflow does not disable TLS verification).
- Production API health reports `environment=production` and `database=connected`.
- Health response includes `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.
- The production frontend origin receives credentialed CORS permission for the required POST preflight.
- An unapproved origin receives no `Access-Control-Allow-Origin` grant.
- A state-changing request from an unapproved origin is rejected with HTTP 403 and the generic `origin_not_allowed` error.

The workflow uses only GET, OPTIONS and a deliberately rejected POST. It does not authenticate, read family records, mutate production data, change secrets or deploy resources.

## Evidence limitations

- Session cookie attributes are source-verified in `workers/api/src/index.ts`: the login response sets `HttpOnly; Secure; SameSite=Lax`, and logout clears the cookie with the same attributes. A live authenticated cookie issuance is not exercised by this unauthenticated workflow.
- The generic API error handler returns a stable error code/message and does not include request bodies or exception details. Deployed Cloudflare log contents and retention are not inspected by this workflow.
- A passing workflow is evidence for the tested edge paths at the time it ran; it is not a penetration test or a complete v1.0 security certification.

Record the workflow run URL and date in `docs/BETA_READINESS_TRACKER.md` only after the workflow succeeds and the remaining evidence limitations have been reviewed.
