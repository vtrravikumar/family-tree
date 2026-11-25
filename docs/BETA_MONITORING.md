# Beta health monitoring and alerts

## Current monitor

- GitHub Actions workflow: `.github/workflows/beta-health-monitor.yml`
- Runs every 15 minutes and can also be started manually.
- Checks both development and production API health endpoints.
- Requires `status=ok`, `database=connected` and the expected environment identity.
- Does not retrieve or store family records.

## Failure notification

When either health check fails, a separate notification job creates a GitHub issue assigned to the repository owner. The issue includes the workflow run link, branch and commit only. It does not include response bodies, credentials, request payloads or family data.

The notification job uses the repository-provided `GITHUB_TOKEN` with the minimum additional `issues: write` permission. No third-party monitoring account, API key or paid service is required for this beta alert path.

An open issue for the same workflow run is reused to avoid duplicate alerts on a rerun. Each distinct failed run gets its own issue.

## Controlled alert-path verification

After this workflow change is merged:

1. Open the repository's Actions tab.
2. Select **Beta API health monitor** and choose **Run workflow** on `main`.
3. Set **Simulate a monitor failure** to `true`.
4. Confirm the health job fails intentionally and the notification job succeeds.
5. Confirm a new `[Beta health alert]` issue is created and assigned to `vtrravikumar`.
6. Confirm the issue contains the run link but no API response body or personal data.
7. Close the test alert after recording the verification result.

The simulation flag defaults to false and is only available for manual dispatch. Scheduled and push-triggered runs cannot activate it.

## Operational limitation

This provides an actionable GitHub issue and repository notification. It is not an independent paging service and does not guarantee SMS or email delivery; those depend on the repository owner's GitHub notification settings. If a future beta requires out-of-band paging, select and approve that service separately.

## Readiness evidence

Do not mark beta readiness control 16 complete until the controlled failure test above has been run and the assigned issue has been observed.
