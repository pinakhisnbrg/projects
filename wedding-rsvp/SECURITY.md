# Security and data recovery — prelaunch requirements

This application is **under development and NOT production approved**. Never send a real guest invitation until this checklist has been completed and verified.

## Source code and GitHub

- Keep real guest lists and invitation tokens out of this repository, including issues, screenshots, CI logs and sample data.
- Enable GitHub account 2FA/passkeys; review repository collaborators and installed apps.
- In GitHub Settings → Rules → Rulesets, protect the default branch. Require pull requests, at least one trusted review, passing wedding RSVP checks, no force pushes and no deletions.
- Turn on GitHub Dependabot alerts, dependency security updates and secret scanning wherever available under the repository's Security settings.
- GitHub protections and plan/visibility capabilities may vary; verify in the repository UI.

## Deployment and secrets

- Use Vercel for both the website and its serverless API. **GitHub Pages alone is NOT sufficient** for this design.
- Set `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SECRET` and optional Google service-account secret as Vercel **server-side environment variables**; do not prefix them with `VITE_` or `NEXT_PUBLIC_`.
- Use separate Supabase projects and deployment environments for testing and production.
- Never expose a Supabase service-role key in any browser page, API response or public build. Rotate any key that is exposed.
- Disable public deployment until end-to-end review and security tests pass.
- Restrict preview access to staff and administrators.
- Enable anti-abuse protection: endpoint rate limiting, CAPTCHA/challenge for suspicious requests, request-size limits and monitoring.
- Use verified HTTPS and a known custom domain if desired.
- The current administrator secret is shared, not per-user; replace with proper administrator login + MFA and scoped staff check-in roles before sending invitations.
- Invitation URLs are bearer tokens: anyone with a forwarded link can update a household RSVP. Consider one-time phone verification or confirmation workflow if tamper prevention is required.
- Do not use a guest's name or phone number as a QR credential.
- QR credentials must be independently random, opaque, validated server-side, and cannot imply access merely from looking legitimate.

## Database protection

- Supabase RLS must remain enabled on every guest-facing table. Only trusted server functions use service-role credentials.
- Validate seat allocations, guest input and repeat submissions at the database boundary.
- Restrict the database to the least required permissions and keep a private audit trail of administrative actions.
- Test duplicate submissions, concurrency, maximum seat allocation, HTML injection, malformed requests and repeated check-in attempts.
- The submitted prototype has not undergone penetration testing or a full security audit.

## Backups and recovery

**GitHub is NOT a database backup. Google Sheets is NOT a complete database backup.**

- The Supabase free plan does not automatically back up the database; confirm current plan documentation.
- Before live use, configure nightly *encrypted* PostgreSQL backups to a separate storage account with access restricted to the owner.
- Use a managed plan with daily backups if you don't want to operate your own backup job.
- Retain at least 14 daily backups and several weekly snapshots through the wedding, subject to privacy and retention needs.
- Conduct an actual restore into an isolated test database, then compare counts, RSVP changes, guest passes and QR check-in status.
- Export an encrypted offline copy shortly before the event, and a controlled guest roster for venue contingency.
- Confirm India-related privacy obligations and inform guests about purpose and retention. Delete unnecessary guest data after the event.

## Launch gates

- [ ] Hosting and API deployment configured and tested
- [ ] Database provisioned, RLS and stored procedure verified
- [ ] Admin login with MFA / role separation implemented
- [ ] Rate limits and anti-abuse controls implemented
- [ ] Backup schedule configured and restoration tested
- [ ] Source branch protection and CI verified
- [ ] End-to-end test using test invitations, not real guest data
- [ ] Real monogram asset integrated with explicit approval
- [ ] Security, accessibility, and mobile-browser test passed
- [ ] Owner approves launch
