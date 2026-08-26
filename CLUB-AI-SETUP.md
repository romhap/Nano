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
> actually work. Without it the AI still answers, but **sign-in is skipped
> entirely** and every request is treated as an untracked dev session — this
> is what keeps mock-mode testing possible before any of this is wired up.
> Set it before launch.

### 2. Update the Apps Script
Paste the current `google-sheet-signups.gs` into your Apps Script editor,
Save, then **Deploy → Manage deployments → edit → New version → Deploy**.

Three new tabs appear on first use: **`ClubAI`** (accounts/spend),
**`MagicLinks`** (sign-in tokens), **`Devices`** (sessions).

> If a **`ClubAI`** tab already exists from before the per-action limits
> update, delete it — the column layout changed (daily counters moved into
> one compact JSON column so future limit changes don't need another sheet
> migration). It's recreated automatically, empty, on the next request. Safe
> to do since there are no real paying users on the old layout yet.

### 3. Mark paying users
When someone subscribes via the Club AI Stripe link
(`buy.stripe.com/fZu14nb6i3J64Y01q1gw004`), open the **ClubAI** tab, find
their row, set **Paid** to `TRUE`. That's the only manual step — same flow you
already use for mentorship subscribers.

---

## Sign-in: magic link, not passwords

There is no password anywhere. A student enters their email and gets a
one-time link by email — clicking it signs them in. This exists specifically to close a real gap the old version had: before,
"who is this user" was just whatever email string the browser sent, so anyone
who knew a paying customer's email could type it in and get free Pro access.
Now the server only trusts a session token issued after proving email
ownership via the clicked link — a plain email claim gets nowhere.

**Same-device persistence:** once verified, the browser stores that session
token and stays signed in — no re-verifying on every visit, the way you'd
expect from any normal app.

**Device recognition + management:** each browser gets a stable, non-secret
device ID kept in its own storage, so returning on the same device reuses the
same device row rather than creating a new one every sign-in. The **Devices**
button in the top bar lists every device signed in on the account, when each
was last active, and lets you sign any of them out remotely — revoking a
device invalidates its session immediately, even mid-conversation, and it has
to sign in again via a fresh link.

Everything is enforced **server-side** in the Apps Script (session lookup,
expiry, single-use tokens, revocation, and — critically — you can only ever
revoke a device that belongs to *your own* resolved account, never someone
else's). None of it can be bypassed by editing localStorage.

Magic links expire in 30 minutes, work once, and are rate-limited to one
request per email per minute so the sign-in email can't be used to spam
someone's inbox.

---

## Chat history

The **History** button in the top bar lists past conversations (title = the
first message, plus a "last updated" time) so a student can reopen one to
keep reading or continue it. Click a conversation to reload it into the
thread; delete any entry you don't want kept.

This is purely a client-side convenience — saved chats live in that
browser's `localStorage`, scoped to the signed-in email so a shared device
never mixes one person's history into another's list. It is **not** synced
across devices and it does not touch the Apps Script sheet at all.

Important: this does **not** break the "sterile AI" property. Reopening a
saved chat only replaces what's shown in the active thread and what gets
sent to the model *if you keep chatting in it* (same rolling 6-message
window as any other conversation) — past conversations are never merged
into each other, and "New chat" always starts from a genuinely empty
history. The model itself still has no memory across conversations and
nothing is stored server-side about what was discussed.

---

## Limits, as built

| | Trial | Pro |
|---|---|---|
| Practice question | 1 / day | unlimited¹ |
| University preview | 1 / day | unlimited¹ |
| Explain a topic | 1 / day | unlimited¹ |
| Exam-day strategy | 1 / day | unlimited¹ |
| Mark my reasoning | 1 / day | unlimited¹ |
| Key dates | 1 / day | unlimited¹ |
| Free-typed messages | 2 / day | unlimited¹ |
| Syllabus | locked | unlimited¹ |
| Break topic into subtopics | locked | unlimited¹ |
| Full mock exam | locked | **1 per 5 hours** |
| Upgrade an old exam | locked | **1 per 5 hours** |
| Anki deck check | locked | **1 per 5 hours** |

¹ Capped by a **$16/month spend ceiling** (≈ €15), further split into a
**daily share** (monthly ÷ days in the month) so one heavy day can't burn a
whole month's allowance — see "Pro's daily budget" below. All counters and
cooldowns reset themselves — nothing to clear by hand.

The six free-trial guided actions are each their own daily counter — a
student can use all six once each on the same day, not a shared pool of one.

Mock exams, exam upgrades and deck checks are rate-limited even on Pro
because each costs several times a normal reply. All limits are enforced
server-side, so clearing browser storage doesn't bypass them.

### Pro's daily budget
Pro's $16/month is divided by the number of days in the current calendar
month to get a daily share (~$0.53/day on a 30-day month). Hitting that share
blocks further messages until the next day with a **"today's budget used"**
message — the monthly ceiling still exists underneath as a backstop. The
plan chip's tooltip and a small line under the composer show the running
day/month percentage after every Pro reply, and a one-time heads-up card
appears the first time either crosses 80% in a session — mirroring the kind
of usage indicator Claude's own apps show, just lighter-weight (text + an
alert card rather than a full bar chart; easy to build out further later if
wanted).

---

## How the token budget is protected

Output tokens cost **5× input** on this model, so that's where the control
matters most. Four levers are already in place:

1. **`max_tokens: 800`** on normal replies — the single biggest lever.
   The three heavy actions (mock exam, exam upgrade, Anki check) get 4000
   because they genuinely need the room.
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

## ⚠️ One thing to keep fresh, one thing to consider

### Key dates — filled in, but re-check each cycle
`KEY_DATES` in `api/chat.js` is filled in from a live lookup done 26 Aug
2026 (exam date, EU registration window, non-EU pre-enrolment status,
results timeline). Every answer that states a date automatically ends with
a fixed disclaimer line pointing to universitaly.it. **Re-verify and update
`KEY_DATES` at the start of each new cycle** — if you ever clear a field
back to `''`, the model goes back to refusing to guess it rather than
stating something stale.

### The syllabus link isn't fetched, only cited
The model is told the official decree URL and told to stay within its scope,
but it does **not** read the PDF at runtime — it works from training
knowledge. It's good on IMAT structure, weaker on fine syllabus edges (now
Pro-only, so this only affects paying users). If you want genuine fidelity,
the next step is pasting the decree's topic list directly into the system
prompt.

The same goes for the new **"Upgrade old exam"** button — it currently
upgrades a student's uploaded exam using the exam-format facts already in
the system prompt, not literal reference papers. You offered to send the
real 2024 & 2025 IMAT papers — please do; a short distilled style guide
(question phrasing, distractor patterns, difficulty, quantity per topic)
added to the system prompt from those would sharpen both this button and
the "Full mock exam" generator. Pasting the whole papers into every request
would be too expensive — the distilled version is the right shape.

---

## The buttons

- **🎯 Practice question** — student picks a topic, then a subtopic, then
  gets **one question at a time**. The answer is hidden behind a "Reveal
  answer" button rather than shown immediately, so it actually works as
  practice instead of spoiling itself.
- **💡 Explain a topic** — topic/subtopic picker; the model is told to ask
  for a narrower sub-topic if what's picked is too broad to cover well.
- **📝 Full mock exam** (Pro) — generates a complete fresh 60-question exam
  in the current format and proportions.
- **⬆️ Upgrade old exam** (Pro, new) — student **uploads a file** (an old-format
  exam, PDF or plain text/markdown, 4MB max) and the model rewrites it to
  match the current format: same question count and per-section proportions,
  current-style options and scoring. The file is sent once for that request
  and is never saved into the student's chat history (would bloat
  `localStorage` and there's no reason to resend it).
- **🏛️ University preview** — picker now includes **Cagliari** and
  **Firenze**, the two genuinely new IMAT-accessible English medicine
  programmes for this cycle (Padova and the rest of the established list are
  unchanged). The model is told it may not have reliable training data on
  the two new ones and to say so rather than guess seat counts/cutoffs.
- **♟️ Exam-day strategy** — timing and when guessing beats the −0.4 penalty.
- **✍️ Mark my reasoning** — student pastes their working, gets marked like
  an examiner.
- **📅 Key dates** — see the dates section above; every dated answer ends
  with the verify-yourself disclaimer.
- **📚 Syllabus** (Pro) — moved behind Pro in this update.
- **🧩 Break a topic into subtopics** (Pro, new) — topic-only picker (no
  subtopic drill-down, since the point is generating that list), turns a
  vague syllabus topic into a concrete list of what to actually learn.
- **🗂️ Check my Anki deck** (Pro).

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
