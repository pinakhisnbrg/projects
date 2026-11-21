# Sakshi & Pinak — WhatsApp + Google Sheets RSVP

**Wedding only — 27 January 2027.** This repository contains the Vercel RSVP site and a Google Apps Script backend. **Google Sheets is the single source of truth. No standalone database is required.**

## Existing Google Sheets workbook

[Pinak Wedding Guest List](https://docs.google.com/spreadsheets/d/1ArjWx2O7oWBgavf0UL86EmEE2kxDp9V6CEDxxDoiYCY/edit), new tab: **Wedding RSVP Register** (16 columns). The existing `Wedding`, `All`, and other planning tabs are preserved.

Enter one row per invitation/household with **Guest / Household Name**, **WhatsApp Number (+country code)**, **Maximum Guests** and **Opt-in / Permission = Yes** if the invitee has agreed to receive WhatsApp messages. The original Wedding worksheet has names and headcounts arranged in separate groups; **do not assume its numeric counts are telephone numbers.** Review/transfer contacts manually until a reliable phone-number source is identified.

The service fills Invite ID, unique secret Invitation Token, RSVP URL, and statuses. Invited guests provide ONLY (1) RSVP Yes/No and (2) how many people if Yes. Their household name is displayed automatically; no typing names or phone numbers on the website.

## Step 1 — Install Sheets endpoint (owner action)

1. Open the linked Google spreadsheet.
2. Choose **Extensions > Apps Script**. Replace the default Code.gs with [google-apps-script/Code.gs](google-apps-script/Code.gs) from this repository.
3. Open **Project Settings > Script Properties**. Define:
   - `RSVP_WEBHOOK_SECRET`: a securely generated random secret at least 32 characters. Do not use the same value as the Vercel ADMIN_SECRET.
   - `RSVP_PUBLIC_URL`: the protected website's intended canonical URL, currently `https://pinak-sakshi-wedding.vercel.app`. **Update before sending invitations.**
4. Deploy > New deployment > Web app > Execute as **Me**; Who has access: **Anyone**. Copy the HTTPS `https://script.google.com/macros/s/.../exec` URL. It is safe to leave POST functionality restricted by the private server-to-server shared secret. Apps Script web-app URLs cannot be kept entirely private by IP, so use rotating high-entropy secrets and enforce rate limits at Vercel.
5. Set three **server-side** Vercel environment variables:
   - `GOOGLE_APPS_SCRIPT_WEBAPP_URL`: deployment URL
   - `RSVP_WEBHOOK_SECRET`: identical to Script Properties
   - `ADMIN_SECRET`: different random 32+ character administrator secret, kept private
6. Redeploy Vercel from GitHub (preview first). Do **not** store keys in GitHub, frontend code, Google Sheets cells, or browser localStorage.

## Step 2 — Prepare personalized links

Populate and review names, E.164 numbers, and maximum invited guests in **Wedding RSVP Register**. Use the private `/admin.html` dashboard to click **Generate private links** (not a send action). Each row receives a random token and a named URL, without exposing anyone else's data. Test a single Yes and No response and confirm that the sheet updates, then verify QR PNG downloads and check-in code validation. Verify duplicate submissions and limits.

## Step 3 — WhatsApp Business integration (owner action)

Official bulk, business-initiated WhatsApp messages require a configured Meta WhatsApp Business Platform sender, the relevant recipient permissions/opt-ins, and an **approved message template**. A personal WhatsApp account or automated browser scripting is not suitable for a reliable campaign.

Template example (Meta review may classify as marketing):

```
Hello {{1}}, you are warmly invited to the wedding celebration of Sakshi & Pinak on 27 January 2027. Please RSVP here: {{2}}.
```

Template has exactly two BODY placeholders: name and unique RSVP URL. Configure in Apps Script Script Properties:

- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_WHATSAPP_TEMPLATE_LANGUAGE` (e.g. `en`)

Then mark **Opt-in / Permission = Yes** only where consent is documented; generate links; click **Queue opted-in contacts** in /admin.html. **Queueing does not send anything**. After testing a single contact and approving the campaign, run `installWhatsAppQueueTrigger()` once from the bound Apps Script editor; it installs a 5-minute time-driven job that attempts up to 10 queued messages per run. Use `stopWhatsAppQueueTrigger()` to stop. Only eligible queued rows will be sent; accepted message IDs, send times and failures are recorded. “Sent” means the provider **accepted** the API request, not delivery/reading.

A second option for a controlled one-person test is `/admin.html` > Send one (requires the separate Vercel META_* environment variables and a valid consented record). Do not enable both bulk workers simultaneously.

## Guest experience

1. WhatsApp message contains the guest/household's name and private link.
2. Guest visits a personalized Save the Date site with fixed floral monogram.
3. Guest selects **Yes/No**, and if Yes selects **number of attending people** within the allocated maximum.
4. Same Google Sheet row is updated: RSVP, confirmed count, updated timestamp and individual opaque QR entry credentials.
5. Guest can save a PNG pass per reserved entry slot, although the title shows the household name (no individual guest names requested).
6. Venue check-in uses existing /checkin.html (administrator-only manual scanned QR text).

## Security/operating notes

- The Google Sheet holds all the RSVP and QR secrets. Restrict sheet sharing to trusted owners, enable account MFA, and do not publish the spreadsheet.
- A private URL acts as a bearer token; anyone forwarded a household's link could alter that RSVP until check-in. For stronger assurances, add phone verification.
- Apps Script and Sheets have quotas and latency limits. Test high-concurrency updates and batch sends before opening to 700 people.
- Limit editor and dashboard access to administrators, with per-user login/MFA as a future requirement. Protect Vercel deployment until approved.
- Enable version history and **automatic independent encrypted exports/backups** of the Google Sheet; a spreadsheet is not a substitute for recoverable backups.
- The former Supabase project is no longer referenced by the application but **has not been deleted**. Its existence does not imply RSVP data is being stored there.
- No WhatsApp messages have been sent by this repository change. Sending requires explicit account configuration, consent, approved templates, and activation.
- Native Apple Wallet / Google Wallet passes are not issued. Guests can save a PNG QR ticket to Photos.
- Do not invite real guests until the complete end-to-end system has been tested and approved.
