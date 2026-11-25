# Invitation email delivery

Family invitations are delivered through Resend from the API Worker. The invitation itself remains a seven-day, single-use token: only its SHA-256 hash is stored in D1, and acceptance still requires the invited person to sign in with the matching verified Google email.

## Required Worker configuration

Configure each environment independently:

- `RESEND_API_KEY`: Resend API key, stored as a Cloudflare Worker secret.
- `INVITATION_FROM_EMAIL`: sender identity verified in Resend, stored as a Worker secret/setting. Example format: `Vansvriksh <invites@your-verified-domain.example>`.
- `PUBLIC_APP_URL`: set in `wrangler.toml` for the matching environment. Development points to `https://dev.vansvriksh.vtrrk.in`; production points to `https://vansvriksh.vtrrk.in`.

Before sending real invitations, add and verify the sending domain in Resend and use a sender address on that verified domain. Do not use the example address literally.

### Configure development

From `workers/api`:

```sh
pnpm exec wrangler secret put RESEND_API_KEY --env dev
pnpm exec wrangler secret put INVITATION_FROM_EMAIL --env dev
```

Enter the Resend API key and the verified sender identity when prompted. Deploy the development Worker after the secrets are configured.

### Configure production

Production configuration is a separate owner-approved operation. Only after explicitly approving production email activation:

```sh
pnpm exec wrangler secret put RESEND_API_KEY --env production
pnpm exec wrangler secret put INVITATION_FROM_EMAIL --env production
```

Then deploy the production Worker through the approved release process. Do not copy development secrets into production.

## Delivery and fallback behavior

- The invitation record and audit entry are committed before the email provider is called.
- A provider error does not delete or invalidate the invitation. The API returns `emailSent: false`, and the Owner/Admin can still copy or share the secure link.
- Successful provider acceptance returns `emailSent: true`. This confirms Resend accepted the request, not that the recipient opened or read the message.
- The UI retains Copy Link and WhatsApp sharing as alternatives.
- The invitation code is included only in the recipient's email and the authenticated inviter's response/UI for manual sharing. Do not log it or include it in analytics.
- Email provider response bodies are intentionally not returned to the browser or written to application logs.

## Verification

The API unit tests cover missing configuration, successful provider submission, provider rejection and network failure. CI runs these with the existing Worker tests, typecheck and build.
