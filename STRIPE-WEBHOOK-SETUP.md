# Stripe webhook — Club AI auto-activation

Automates the one manual step left in Club AI's setup: marking a customer
**Paid = TRUE** in the `ClubAI` sheet tab after they subscribe. Everything
below is in the Stripe Dashboard and Vercel — five short steps, all things
only you can do since they need your Stripe login.

The mentorship Stripe Payment Link is untouched by any of this — it still
works exactly as it does today, no webhook, no automation.

---

## 1. Find the Club AI payment link's ID

Stripe Dashboard → **Payment links** → open the Club AI one
(`buy.stripe.com/fZu14nb6i3J64Y01q1gw004`) → its ID is shown at the top,
looks like `plink_1AbCdEfGhIjKlMnOp`. Copy it — this is what stops a
mentorship purchase (a different payment link) from ever triggering Club AI
Pro by accident.

## 2. Create the webhook endpoint

Stripe Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL:** `https://www.imat.club/api/stripe-webhook`
- **Events to send:** select just `checkout.session.completed`
- Save.

Once created, open the endpoint and click **Reveal** next to **Signing
secret** — copy it (starts with `whsec_`). This proves requests really came
from Stripe, not someone else pinging the URL.

## 3. Get your Stripe secret key

Dashboard → **Developers → API keys → Secret key**. Copy it (starts with
`sk_live_...`). Treat this like a password — it can move money.

## 4. Invent a shared secret for the sheet side

Make up any random password string yourself (a password generator is fine).
This is **not** something Stripe gives you — you're creating it so the
Vercel function and the Apps Script sheet can prove requests to each other
are legitimate, since the sheet's URL is otherwise public. Call it whatever
you like; the steps below refer to it as `CLUB_AI_WEBHOOK_SECRET`.

## 5. Set the four Vercel environment variables

Vercel → your project → **Settings → Environment Variables**, add:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | from step 3 |
| `STRIPE_WEBHOOK_SECRET` | from step 2 |
| `STRIPE_CLUB_AI_PAYMENT_LINK_ID` | from step 1 |
| `CLUB_AI_WEBHOOK_SECRET` | your own password from step 4 |

(`SIGNUP_ENDPOINT` should already be set from the earlier Club AI setup —
this webhook reuses it.) Redeploy after saving.

## 6. Add the matching Script Property in Apps Script

Open the Apps Script project → gear icon **Project Settings** → **Script
Properties → Add script property**:

- **Property:** `WEBHOOK_SECRET`
- **Value:** the *same* password you invented in step 4

This is the check `markClubAiPaid()` in `google-sheet-signups.gs` makes
before touching the sheet — no matching secret, no write. Then redeploy the
Apps Script (**Deploy → Manage deployments → edit → New version → Deploy**)
if you haven't already pasted the current file in.

---

## Test it

Stripe Dashboard → your webhook endpoint → **Send test webhook** →
`checkout.session.completed`. Check the endpoint's **Recent events** log for
a `200` response. For a real end-to-end test, use
[Stripe's test mode](https://docs.stripe.com/testing) with a test payment
link before going live, or just watch the `ClubAI` tab after your first real
subscriber.

If something's wrong, Stripe's webhook log shows the exact response your
endpoint sent back, including any error message — that's the fastest way to
diagnose a bad secret or a typo'd env var.
