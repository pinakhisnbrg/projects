# Wedding RSVP security checklist — Google Sheets edition

The wedding RSVP system uses Google Sheets as the **only** source of guest data. **Do not send real WhatsApp invitations until each launch gate passes.**

## Guest data
- The "Pinak Wedding Guest List" workbook is private. Do not share it publicly or publish any tab to the web.
- Use only the dedicated "Wedding RSVP Register" for RSVP writes; leave the source Wedding and All planning tabs unchanged.
- Guest names, phones, invitation tokens, pass codes and webapp shared secrets must never be checked into GitHub or embedded in browser JavaScript.
- Require multifactor authentication on all Google, Meta, GitHub and Vercel accounts; limit spreadsheet editors.
- Put the bound Apps Script Web App behind a strong shared secret in Script Properties and Vercel encrypted environment variables. Restrict its doPost actions to trusted server requests.
- RSVP links use 64-character random tokens; they are bearer credentials. Sending a link to someone else grants access to that household's RSVP until a stronger phone-verification flow is implemented.
- Do not publish invitation tokens or QR codes publicly.
- Google Apps Script daily quotas and spreadsheet concurrency need load testing; LockService protects RSVP writes but cannot eliminate all operational risks.

## WhatsApp
- Use the official Meta WhatsApp Business Platform rather than browser automation or consumer WhatsApp.
- Business-initiated conversations require the appropriate approved template. Confirm actual marketing/utility classification with Meta and account pricing.
- Do not send without documented permission/opt-in. The sheet defaults permission to **Unknown**, not Yes.
- Correctly format numbers in E.164 format (`+91...`).
- The bot is **not** activated just by committing code. Verify your approved sender/template and test with a single permissioned phone.
- Queue only reviewed rows. A time-driven Google Apps Script worker must be intentionally installed. Stop with `stopWhatsAppQueueTrigger()` if needed.
- Track API accepted IDs, failures and actual delivery via Meta webhooks if delivery confirmation is required. A provider-accepted send does not guarantee delivery.

## Website and passes
- Keep Vercel Authentication enabled until the wedding website is ready for invitation holders.
- `ADMIN_SECRET` is a temporary admin password. Long-term admin login with per-user MFA and check-in roles would be more secure.
- Guest RSVP accepts only yes/no and confirmed count, bounded by the household's allocation.
- For event entry, each confirmed slot gets a distinct opaque QR value. If a family reduces its attendance, existing extra QR credentials must be invalidated.
- Restrict QR check-in to approved staff and block re-use on arrival.
- Test repeated submits, lost connection recovery, check-in conflicts and normal operation on iOS/Android.

## Data durability
- Google Sheets version history alone is insufficient as disaster recovery. Configure and test independent encrypted daily backups, held in a separate restricted location.
- Test at least one full restore before inviting real guests.
- Export a controlled encrypted offline roster shortly before the event.
- Define a retention/deletion policy after the wedding and do not keep phone numbers indefinitely.

## Operational launch gates
- [ ] Verify 215 imported Wedding RSVP draft rows against original planning lists; confirm whether all ~700 attendees are represented
- [ ] Add and validate recipient phone numbers; review party allocations
- [ ] Document consent/permission (currently Unknown by default)
- [ ] Configure and deploy the bound Google Apps Script Web App
- [ ] Add its URL and shared secret to Vercel
- [ ] Configure ADMIN_SECRET in Vercel
- [ ] Test real RSVP updates and QR generation with a test record
- [ ] Test website load and fail-closed behavior under invalid or missing credentials
- [ ] Configure official WhatsApp Business sender + template; verify pricing
- [ ] Send one permissioned test WhatsApp; inspect both WhatsApp status and Google Sheet
- [ ] Install the queue trigger only after approval
- [ ] Configure daily backups and test restore
- [ ] Remove Vercel Authentication only when approved for guests
