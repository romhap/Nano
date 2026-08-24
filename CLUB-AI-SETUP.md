# Club AI — setup

Stealth URL: **`https://www.imat.club/club-ai.html`**
Not linked from any menu, and marked `noindex` so search engines skip it.

---

## Right now: it works for €0

There is **no API key configured**, so the endpoint automatically serves
canned responses. You can click every button, hit the trial limits, see the
Pro upsell and test the whole interface without spending anything. Replies
are prefixed `[MOCK MODE]` so you always know what you're looking at.

The moment you add the key in Vercel, it switches to real answers — no code
change needed.

---

## Going live (3 steps)

### 1. Add the API key to Vercel
Vercel → your project → **Settings → Environment Variables**:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from console.anthropic.com |
| `SIGNUP_ENDPOINT` | your Apps Script `/exec` URL (same one already in `script.js`) |

Redeploy after adding them.

> `SIGNUP_ENDPOINT` is what makes accounts, trial limits and the spend cap
> actually work. Without it the AI still answers, but **nothing is enforced** —
> every user is treated as an unlimited trial user. Set it before launch.

### 2. Update the Apps Script
Paste the current `google-sheet-signups.gs` into your Apps Script editor,
Save, then **Deploy → Manage deployments → edit → New version → Deploy**.

A new **`ClubAI`** tab appears in your sheet on the first request.

### 3. Mark paying users
When someone subscribes via the Club AI Stripe link
(`buy.stripe.com/fZu14nb6i3J64Y01q1gw004`), open the **ClubAI** tab, find
their row, set **Paid** to `TRUE`. That's the only manual step — same flow you
already use for mentorship subscribers.

---

## Limits, as built

| | Trial | Pro |
|---|---|---|
| Guided prompts | 1 / day | unlimited¹ |
| Free-typed messages | 2 / day | unlimited¹ |
| Full mock exam | locked | **1 / day** |
| Anki deck check | locked | **1 per 3 hours** |

¹ Capped by a **$16/month spend ceiling** (≈ €15). Daily counters, the
monthly total and both cooldowns reset themselves — nothing to clear by hand.

Mock exams and deck checks are rate-limited even on Pro because a full
60-question exam costs roughly 6x a normal reply. Both limits are enforced
server-side, so clearing browser storage doesn't bypass them.

---

## How the token budget is protected

Output tokens cost **5× input** on this model, so that's where the control
matters most. Four levers are already in place:

1. **`max_tokens: 800`** on normal replies — the single biggest lever.
   Mock exams get 4000 because 60 questions genuinely need the room.
2. **Rolling 6-message history.** Full history is re-sent on every request,
   so an uncapped conversation is what quietly makes a chat app expensive.
   Only the last 3 exchanges are sent.
3. **Lean system prompt** (~400 tokens) — it's re-sent every call, so every
   word costs on every message.
4. **Hard per-user monthly ceiling**, enforced server-side.

**Measured result:** a typical exchange costs **~$0.003**. A €15 allowance is
roughly **5,000 messages/month per user** — far beyond what a real student
uses. A full mock exam costs ~$0.018, so even 100 of them is under $2.

### On prompt caching
Not used, deliberately. Caching only pays off above a 1024-token prefix and
with repeat traffic inside 5 minutes; this system prompt is ~400 tokens, so
caching would add complexity for no saving. If the prompt grows past ~1000
tokens later, revisit it.

### On photos
The code accepts text only right now. Images are technically possible but
cost **~1,500 tokens each** — roughly 5 normal messages, before any reply.
If you enable them, expect the per-user cost to rise sharply and consider a
separate daily image cap.

---

## ⚠️ Two things to fix before promoting this

### Key dates will refuse to answer — on purpose
The model has a training cutoff and **cannot know the current cycle's
deadlines**. Rather than let it guess (a wrong deadline could make a student
miss a real application window), it's instructed to say it doesn't have
confirmed dates and point to universitaly.it.

To switch the "Key dates" button on properly, fill in `KEY_DATES` at the top
of `api/chat.js` with the confirmed dates, and update it each cycle.

### The syllabus link isn't fetched, only cited
The model is told the official decree URL and told to stay within its scope,
but it does **not** read the PDF at runtime — it works from training
knowledge. It's good on IMAT structure, weaker on fine syllabus edges. If you
want genuine fidelity, the next step is pasting the decree's topic list
directly into the system prompt.

The same applies to your offer of past IMAT papers: pasting whole exams into
every request would be very expensive. The better use is to distil them into
a short style guide (question phrasing, distractor patterns, difficulty) and
add that to the system prompt once.

---

## The buttons

Built as requested: full mock exam (Pro), single practice question, topic
explainer, university preview, key dates, syllabus, Anki check (Pro).

Four added on top:

- **♟️ Exam-day strategy** — timing and when guessing beats the −0.4 penalty
- **✍️ Mark my reasoning** — student pastes their working, gets marked like
  an examiner. This is the one that most feels like real mentorship.
- Topic and university pickers so students don't have to phrase things

Others worth considering later: "Compare two universities side by side",
"Build me a 14-day plan", "Turn this into Anki cards".

The interface follows the same shape as Claude/Gemini: a centred greeting
with the composer in the middle, which collapses to a bottom bar once the
first message is sent. Suggestion chips instead of a button wall, message
bubbles for the student, clean full-width answers, and a "New chat" reset.

---

## Branding

The model is instructed never to reveal or discuss what powers it — it is
Club AI by IMAT.club, and it refuses that question even when asked directly.
Worth knowing: no system prompt is a hard guarantee against a determined
jailbreak. It holds for normal use.
