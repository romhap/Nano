# Live signup collection → Google Sheet

Every lounge login, score analysis, and enrollment application is sent to a
Google Sheet **you own**, in real time. Open the sheet anytime to see who's
coming through.

## What you get (one clean row per person)

| Email | Name | WhatsApp | First Seen | Last Seen | Events | Latest Score | Target Universities | Last Source | User Agent |
|-------|------|----------|------------|-----------|--------|--------------|---------------------|-------------|------------|

- **Events** counts how many times they've come back (engagement signal).
- **Latest Score** + **Target Universities** fill in once they run a diagnostic.
- **Last Source** tells you where it came from:
  - `lounge_signup` — first ever login to the lounge
  - `lounge_login` — a returning login
  - `lounge_score` — they ran a score analysis
  - `application` — they submitted the enrollment form (heading to Stripe)

## Setup (one time, ~2 minutes)

1. Go to **sheets.new** while signed in as **romhaparnass@gmail.com**. Name it
   "IMP Signups".
2. **Extensions ▸ Apps Script**. Delete the placeholder code, paste the entire
   contents of [`google-sheet-signups.gs`](./google-sheet-signups.gs), and Save.
3. **Deploy ▸ New deployment ▸** click the gear ▸ **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and authorise.
4. Copy the **Web app URL** (it ends in `/exec`).
5. Paste that URL into `SIGNUP_ENDPOINT` in **both** files:
   - `lounge.html` (near the top of the `<script>`: `const SIGNUP_ENDPOINT = '';`)
   - `script.js` (top of the file: `const SIGNUP_ENDPOINT = '';`)
6. Commit & push. New signups now appear in the sheet live.

## Test it

Open the `/exec` URL in your browser. You should see:

```json
{"ok":true,"msg":"IMP signups endpoint live"}
```

Then log into the lounge with a test email — a row should appear within a second
or two.

## Notes

- **Privacy:** you're collecting emails. Your Terms already cover data handling;
  if you want, add a one-line note near the lounge login that emails are stored.
- **Until the URL is set**, signups are still saved in each user's browser as
  before — they simply aren't sent to you. Nothing breaks if it's left blank.
- If you ever redeploy the script, the `/exec` URL stays the same as long as you
  use **Manage deployments ▸ Edit ▸ Version: New version** (don't create a brand
  new deployment, or you'll get a new URL to paste again).
