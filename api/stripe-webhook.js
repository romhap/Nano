/**
 * Stripe webhook — Club AI auto-activation (Vercel serverless function)
 * =======================================================================
 * Stripe calls this the moment a Club AI subscription payment completes.
 * It verifies the request really came from Stripe, then tells the Apps
 * Script sheet to flip that customer's "Paid" flag in the ClubAI tab --
 * the same thing you'd otherwise do by hand. Nothing else changes: the
 * mentorship Stripe Payment Link is untouched and still has no webhook.
 *
 * Required Vercel environment variables (Settings -> Environment Variables):
 *   STRIPE_SECRET_KEY            Dashboard -> Developers -> API keys
 *   STRIPE_WEBHOOK_SECRET        shown once the webhook endpoint (below) exists
 *   STRIPE_CLUB_AI_PAYMENT_LINK_ID   the Club AI payment link's ID (plink_...),
 *                                    so a mentorship purchase never triggers this
 *   SIGNUP_ENDPOINT              same Apps Script /exec URL used everywhere else
 *   CLUB_AI_WEBHOOK_SECRET       a password you invent -- must match the
 *                                'WEBHOOK_SECRET' Script Property in the
 *                                Apps Script project (Project Settings ->
 *                                Script Properties). This is what stops
 *                                anyone else from calling the sheet's
 *                                markPaid endpoint directly, since that
 *                                endpoint's base URL is public (it's embedded
 *                                in client-side JS across the site).
 *
 * See STRIPE-WEBHOOK-SETUP.md for the step-by-step Stripe Dashboard setup.
 */

import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeSecretKey || !webhookSecret) {
    // Not configured yet -- ack quietly rather than erroring Stripe's retries.
    return res.status(200).json({ ok: false, reason: 'not_configured' });
  }

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    return res.status(400).json({ error: `Signature verification failed: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    // Only act on the Club AI payment link -- the mentorship Payment Link
    // fires this same event type, and must never grant Club AI Pro.
    const clubAiLinkId = process.env.STRIPE_CLUB_AI_PAYMENT_LINK_ID;
    if (clubAiLinkId && session.payment_link !== clubAiLinkId) {
      return res.status(200).json({ ok: true, skipped: 'not_club_ai' });
    }

    const email = (session.customer_details && session.customer_details.email) || session.customer_email;
    const endpoint = process.env.SIGNUP_ENDPOINT;
    const secret = process.env.CLUB_AI_WEBHOOK_SECRET;

    if (email && endpoint && secret) {
      const url = endpoint + '?markPaid=' + encodeURIComponent(email) + '&secret=' + encodeURIComponent(secret);
      try {
        await fetch(url);
      } catch (e) {
        // Stripe retries failed webhooks on its own; nothing more to do here.
      }
    }
  }

  return res.status(200).json({ received: true });
}
