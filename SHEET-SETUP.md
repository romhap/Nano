# Live signup collection → Google Sheet

Every lounge login, score analysis, and enrollment application is sent to a
Google Sheet **you own**, in real time. Open the sheet anytime to see who's
coming through. The same sheet also gates who's allowed into the lounge —
see **Lounge access (Paid column)** below.

## What you get (one clean row per person)

| Email | Name | WhatsApp | First Seen | Last Seen | Events | Latest Score | Target Universities | Last Source | User Agent | Paid |
|-------|------|----------|------------|-----------|--------|--------------|---------------------|-------------|------------|------|

- **Events** counts how many times they've come back (engagement signal).
- **Latest Score** + **Target Universities** fill in once they run a diagnostic.
- **Last Source** tells you where it came from:
  - `lounge_signup` — first ever login to the lounge
  - `lounge_login` — a returning login
  - `lounge_score` — they ran a score analysis
  - `application` — they submitted the enrollment form (heading to Stripe)
- **Paid** — see below. This is the one column that gates lounge access.

## Lounge access (Paid column)

The lounge login only asks for a first name + email — there's no password
anymore. To stop people sharing the link with non-subscribers, the login
checks this sheet: **an email can only enter the lounge once its "Paid" cell
is set to `TRUE`.**

Nothing sets this automatically. When someone actually pays (you already
message every new subscriber on WhatsApp yourself — do this at the same
moment):

1. Open the Signups sheet
2. Find their row (they'll usually already have one from applying, or one
   will appear the first time they try the lounge and get turned away)
3. Set their **Paid** cell to `TRUE`

Their next login attempt succeeds immediately. To revoke access later (e.g.
a cancellation), set it back to `FALSE`.

This is a manual step by design — it avoids handling your Stripe secret key
anywhere in this codebase. If you later want it fully automatic (a Stripe
webhook flips the cell the instant a payment lands), that's a bigger build —
ask for it whenever you want to move to that.

## Setup (one time, ~2 minutes)

1. Go to **sheets.new** while signed in as **romhaparnass@gmail.com**. Name it
   "IMAT.club Signups".
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

**Already had the sheet running before the Paid column existed?** Just
re-paste the updated `google-sheet-signups.gs` into the same Apps Script
project and redeploy (see "If you ever redeploy" below) — it detects the
missing column and adds it to the header row automatically, without
touching any existing rows.

## Test it

Open the `/exec` URL in your browser. You should see:

```json
{"ok":true,"msg":"IMAT.club signups endpoint live"}
```

Then log into the lounge with a test email — a row should appear within a second
or two, and the login should be refused until you flip its Paid cell to TRUE.

## Notes

- **Privacy:** you're collecting emails. Your Terms already cover data handling;
  the lounge login already shows a one-line note that emails are stored.
- **Until the URL is set**, the lounge can't verify anyone and login is blocked
  entirely with a "message us on WhatsApp" fallback — it fails closed, not open.
- If you ever redeploy the script, the `/exec` URL stays the same as long as you
  use **Manage deployments ▸ Edit ▸ Version: New version** (don't create a brand
  new deployment, or you'll get a new URL to paste again).
