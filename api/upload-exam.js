/**
 * Club AI — exam-file upload endpoint (Vercel Blob client uploads)
 * ====================================================================
 * "Upgrade old exam" needs to accept PDFs well beyond Vercel serverless
 * functions' hard, unconfigurable 4.5MB request-body limit (confirmed
 * against Vercel's own docs -- not something a constant in this codebase
 * can raise past). The fix: never send the file's bytes through a
 * serverless function at all. The browser uploads DIRECTLY to Vercel Blob
 * storage using a short-lived client token minted here, then sends only
 * the resulting blob URL (a short string) to /api/chat, which fetches the
 * file server-side and deletes the blob once it's done with it.
 *
 * Gated to signed-in, PAID accounts only -- same rule as "Upgrade old
 * exam" itself (api/chat.js's PAID_ONLY_ACTIONS). Without this check,
 * this endpoint would hand out free Vercel Blob upload tokens to anyone
 * who found the URL, bypassing Club AI's own gating entirely.
 *
 * Requires the Vercel Blob store to be enabled on this project once
 * (Vercel dashboard -> Storage -> Create Database -> Blob), which
 * auto-injects BLOB_READ_WRITE_TOKEN as an environment variable -- no
 * manual token copying needed, same as any other Vercel-managed store.
 */
import { handleUpload } from '@vercel/blob/client';

const SIGNUP_ENDPOINT = process.env.SIGNUP_ENDPOINT || '';

async function isPaidSession(sessionToken) {
  if (!SIGNUP_ENDPOINT) return true; // no account backend wired up yet (dev/testing) -- don't hard-block
  if (!sessionToken) return false;
  try {
    const r = await fetch(
      `${SIGNUP_ENDPOINT}?aiCheck=${encodeURIComponent(sessionToken)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    const data = await r.json();
    return !!(data && data.valid && data.paid);
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const paid = await isPaidSession(clientPayload);
        if (!paid) throw new Error('Sign in with a Club AI Pro account to upload an exam.');
        return {
          allowedContentTypes: ['application/pdf', 'text/plain'],
          maximumSizeInBytes: 20 * 1024 * 1024, // 20MB -- comfortably covers a scanned past paper, far beyond what any serverless function's own body limit could ever handle
          addRandomSuffix: true
        };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
