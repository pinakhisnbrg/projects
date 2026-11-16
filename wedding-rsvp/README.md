# Sakshi & Pinak — Private Wedding RSVP

Target: **700 wedding attendees**, **27 January 2027**. Reception excluded.

This is a deployable implementation (not yet a deployed website) for a personalized WhatsApp → RSVP → QR-pass workflow. Source lives in the `wedding-rsvp/` folder of your existing GitHub `projects` repository on a feature branch.

## Website pages

- `/` — personalized guest RSVP (requires a private household invitation token).
- `/editor.html` — front-page design studio: colors, headline, text, layout, preview, JSON import/export and authorized **Publish**.
- `/admin.html` — private headcount dashboard and invitation-link creation.
- `/ticket.html` — personal QR pass with **Download PNG**.
- `/checkin.html` — administrator-controlled entry verification (manual QR scan value, not camera scanning yet).

## Deploy to Vercel and Supabase

1. In Vercel, import the GitHub repo and select the branch with this project. Configure **Root Directory: wedding-rsvp** and deploy using Framework Preset **Other**.
2. Create a Supabase project. Execute `sql/schema.sql` in its SQL editor. Do not disable row-level security.
3. Configure server-only Vercel environment variables listed in `.env.example`. Generate `ADMIN_SECRET` with at least 32 random characters. Never commit real keys or guest lists to GitHub.
4. Configure `APP_BASE_URL` to your live HTTPS domain, then redeploy.
5. Open `/admin.html`, enter the admin secret and add a **test** household with a seat allocation; copy its unique WhatsApp link.
6. Test confirmation, changing the guest count, decline, reopening a pass, PNG download, and entering its QR code on `/checkin.html`.
7. Visit `/editor.html`, preview adjustments and **Publish**. The design is saved to Supabase and subsequent guest visits read the new settings.
8. Optionally enable a Google Sheets mirror: create a spreadsheet tab named `Guests`, enable Sheets API for a service account, share the spreadsheet with its email address as Editor and configure its three Vercel variables. The admin Sync button forces a full refresh; RSVP submissions also attempt a best-effort sync.

## Security limitations / before launch
- Your private invitation URLs are bearer tokens. Anyone who obtains a link can edit that household's RSVP; use unique random links and send carefully.
- Guest names and QR codes must never be committed or logged publicly.
- The system needs production testing, rate limiting, abuse protection, and a privacy/data-deletion policy before inviting 700 people.
- The single administrator secret should eventually be replaced with separate staff check-in accounts.
- No native signed Apple or Google Wallet pass is issued: this is **Option A**, a PNG QR ticket saved to Photos; Wallet photo-import is device dependent.
- Your exact supplied Marathi monogram is not yet included as a binary asset; the site uses an editable text stand-in.
- No live domain, database, service account, or hosting connection has been provisioned by these GitHub commits.

## Development

Node.js 20+; run `npm install` and `npx vercel dev` in this folder. Set environment variables for backend operations.

Vercel serverless API route: `/api/index?action=design|invite|rsvp|passes|qr|admin|create-invite|checkin|sync`.

Public repository contains only source code; keep guest data in the Supabase database. 
