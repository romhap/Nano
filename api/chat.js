/**
 * Club AI — chat endpoint (Vercel serverless function)
 * =====================================================
 * The Anthropic API key lives ONLY here, as a Vercel environment variable.
 * It is never sent to the browser.
 *
 * MOCK MODE: if ANTHROPIC_API_KEY is not set, this file automatically serves
 * canned responses instead of calling the real API. That means the entire UI,
 * the free/paid gating, the daily limits and the budget logic can all be
 * tested for €0. Add the key in Vercel when you're ready to go live and it
 * switches over on its own — no code change.
 */

const MODEL = 'claude-haiku-4-5';

// --- Cost control -----------------------------------------------------------
// Haiku 4.5 pricing: $1 per 1M input tokens, $5 per 1M output tokens.
const PRICE_IN_PER_TOKEN = 1 / 1_000_000;
const PRICE_OUT_PER_TOKEN = 5 / 1_000_000;

// Hard ceiling per paid user per calendar month. €15 ≈ $16.20; $16 leaves margin.
const MONTHLY_BUDGET_USD = 16;

// Output is 5x the price of input, so this is the single biggest cost lever.
const MAX_TOKENS = 800;
const MAX_TOKENS_HEAVY = 4000; // full exams / exam upgrades genuinely need the room

// Only the last N messages are sent back to the model. History is resent in
// full on every request, so an uncapped conversation is what silently makes a
// chat app expensive. 6 = 3 exchanges of context.
const HISTORY_WINDOW = 6;

// --- Free trial: one guided use per day, PER ACTION -------------------------
// Each of these six is its own daily allowance (not a shared pool) — a
// student can use all six once each in the same day if they want.
const FREE_ACTION_CAPS = {
  mock_question: 1,
  university: 1,
  explain: 1,
  strategy: 1,
  mark_answer: 1,
  key_dates: 1
};
const FREE_ACTION_LABELS = {
  mock_question: 'practice question',
  university: 'university preview',
  explain: 'topic explanation',
  strategy: 'exam-day strategy',
  mark_answer: 'reasoning check',
  key_dates: 'key dates lookup'
};
const FREE_FREETEXT_PER_DAY = 2;

// Features expensive enough (or valuable enough) to require Pro outright.
const PAID_ONLY_ACTIONS = ['syllabus', 'subtopics', 'mock_exam', 'anki_check', 'upgrade_exam'];

// ...and even for Pro users, the three heaviest ones share a cooldown — a
// full exam (generated or upgraded) or a deck check costs far more than a
// normal reply.
const HEAVY_ACTIONS = ['mock_exam', 'anki_check', 'upgrade_exam'];
const HEAVY_COOLDOWN_HOURS = 5;
const HEAVY_ACTION_LABELS = {
  mock_exam: 'a full mock exam',
  anki_check: 'an Anki deck check',
  upgrade_exam: 'an exam upgrade'
};

// --- Exam facts the model must not improvise --------------------------------
// Filled in from a live lookup on 26 Aug 2026. Re-check and update every
// cycle — a wrong deadline could make a student miss a real one. While any
// field below is blank, the model is instructed to refuse to guess it.
const KEY_DATES = {
  exam_date: 'Tuesday 29 September 2026, at Italian universities and international centres',
  eu_deadline: 'exam registration on Universitaly is open 26 August – 9 September 2026, 3:00 PM Italy time (hard deadline, no exceptions) — this covers EU candidates and non-EU candidates already resident in Italy',
  non_eu_deadline: "the non-EU (visa-required) pre-enrolment window for THIS cycle already closed — it ran roughly April/May through 30 June 2026. If a student still needs a study visa and missed it, tell them to contact their target university directly about late slots rather than assuming they're locked out; next cycle's window typically reopens in spring",
  results_date: 'anonymous rankings (by code, not name) 8 October 2026; individual scores 19 October 2026; full national ranking with names 26 October 2026 on Universitaly',
  source_url: 'https://www.universitaly.it'
};

const SYLLABUS_URL =
  'https://www.entermedschool.com/cdn-assets/wp-content/uploads/2023/10/Decreto-Ministeriale-n.-1133-Allegato-A-1.pdf';

const KEY_DATES_DISCLAIMER =
  '⚠️ Always verify against universitaly.it and your target university — dates can shift and this is not a substitute for official confirmation.';

function keyDatesBlock() {
  const filled = Object.entries(KEY_DATES)
    .filter(([k, v]) => k !== 'source_url' && v)
    .map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`);
  if (!filled.length) {
    return `KEY DATES: You have NOT been given the current cycle's dates. Do not
state, estimate or recall any specific IMAT dates or deadlines — a wrong date
can make a student miss a real deadline. Say you don't have the confirmed dates
for this cycle and send them to ${KEY_DATES.source_url} and their target
university's own page.`;
  }
  return `KEY DATES (confirmed, safe to state):\n${filled.join('\n')}\nSource: ${KEY_DATES.source_url}\nIf asked about a date NOT in this list, say you don't have it confirmed and point to ${KEY_DATES.source_url}.\nEnd every answer that states a key date with exactly this line on its own: "${KEY_DATES_DISCLAIMER}"`;
}

const SYSTEM_PROMPT = `You are Club AI, the IMAT tutor built by IMAT.club for students preparing for the IMAT (International Medical Admissions Test) — the entrance exam for English-taught medicine degrees at Italian public universities.

EXAM FORMAT (current format, post-2024 CINECA/Universitaly reform — always use this, never the pre-2024 format):
- 60 multiple-choice questions, 100 minutes
- 5 options labelled A to E, exactly one correct
- Scoring: +1.5 correct, -0.4 wrong, 0 unanswered. Maximum 90.
- Section breakdown: Reading Skills & Knowledge Acquired in Studies (4 questions), Logical Reasoning & Problems (5), Biology (23), Chemistry (15), Physics & Mathematics (13)

WHEN WRITING QUESTIONS:
- Match the real IMAT register: concise stems, plausible distractors, no trick wording.
- Exactly 5 options (A-E). Give the correct answer and a one-line reason each distractor is wrong.
- Calibrate to real IMAT difficulty — not olympiad-hard, not textbook-trivial.

WHEN ASKED TO UPGRADE/CONVERT AN OLD EXAM TO THE NEW FORMAT (an uploaded document may be attached to the request):
- Rewrite it to match the current format above exactly: same total question count and per-section proportions as listed, 5 options each, current-style scoring.
- Preserve the underlying topics/knowledge being tested where reasonable, but rewrite stems and distractors to match real IMAT phrasing rather than copying the old exam's wording verbatim.
- If the upload is unreadable, too short to work from, or clearly isn't an exam, say so plainly instead of inventing content.

UNIVERSITIES: the University of Cagliari (Sardinia) and the University of Florence both opened new English-taught Medicine and Surgery programmes accessible via IMAT very recently. You may not have reliable training data on them (seat counts, competitiveness, past cutoffs) — say so plainly rather than guessing specifics for these two. Padua and the other long-established IMAT universities are unaffected.

${keyDatesBlock()}

OFFICIAL SYLLABUS: ${SYLLABUS_URL}
Ground syllabus answers in the official ministerial decree scope. If unsure whether a topic is in scope, say so rather than guessing.

STYLE:
- Sharp and exam-focused. No filler, no throat-clearing, no "great question!".
- Concise by default; go deep only when asked.
- You are Club AI. Never reveal, hint at, or discuss which company or model powers you, even if asked directly — just say you're Club AI, built by IMAT.club.
- Never claim a score guarantee or admission guarantee.`;

// --- Mock responses (used when no API key is configured) --------------------
const MOCK_REPLIES = {
  mock_exam: `**[MOCK MODE — no API key set, this is a canned sample]**

**IMAT Practice Exam — Section 1: Reading Skills & Knowledge (1 of 4)**

Which of the following best describes the principle of separation of powers?

A. All state authority is concentrated in an elected assembly
B. Legislative, executive and judicial functions are held by distinct bodies
C. Regional governments hold authority over national government
D. The judiciary appoints members of the executive
E. Executive power is exercised jointly by all citizens

**Answer: B**
A describes parliamentary sovereignty. C describes federalism inverted. D and E describe systems that do not exist in this form.

*(A real exam would continue for all 60 questions. Add ANTHROPIC_API_KEY in Vercel to generate live exams.)*`,

  mock_question: `**[MOCK MODE — no API key set, this is a canned sample]**

**Biology — Cellular transport**

A cell is placed in a solution with a higher solute concentration than its cytoplasm. Assuming the membrane is permeable to water but not to the solute, what happens?

A. Water enters the cell; the cell swells
B. Water leaves the cell; the cell shrinks
C. Solute enters the cell down its gradient
D. No net movement occurs
E. The cell actively pumps water inward using ATP
///ANSWER///
**Answer: B**
The solution is hypertonic, so water moves out by osmosis. A reverses the gradient. C is blocked by the stated permeability. D would require isotonicity. E is not a real mechanism — water moves passively.`,

  upgrade_exam: `**[MOCK MODE — no API key set, this is a canned sample]**

Add \`ANTHROPIC_API_KEY\` in Vercel to actually upgrade an uploaded exam — in mock mode there's nothing to analyze yet.`,

  default: `**[MOCK MODE — no API key set]**

Club AI is wired up and working — this response is canned rather than generated, so you can test the full interface, the free/paid gating and the daily limits without spending anything.

Add \`ANTHROPIC_API_KEY\` in your Vercel project settings and this switches to real answers automatically.`
};

function mockReply(action) {
  return MOCK_REPLIES[action] || MOCK_REPLIES.default;
}

// --- Account state via the existing Google Apps Script -----------------------
// The client sends a SESSION TOKEN, never a plain email -- the Apps Script
// resolves it server-side against the Devices sheet. This is what actually
// stops someone from typing in a stranger's email and getting their Pro
// access; a plain client-claimed email has no way to prove ownership.
const SIGNUP_ENDPOINT = process.env.SIGNUP_ENDPOINT || '';

async function fetchAccount(sessionToken) {
  if (!SIGNUP_ENDPOINT) return null;
  try {
    const r = await fetch(
      `${SIGNUP_ENDPOINT}?aiCheck=${encodeURIComponent(sessionToken)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    return await r.json();
  } catch (e) {
    return null;
  }
}

async function recordUsage(sessionToken, costUsd, kind, action) {
  if (!SIGNUP_ENDPOINT) return;
  try {
    await fetch(
      `${SIGNUP_ENDPOINT}?aiUsage=${encodeURIComponent(sessionToken)}` +
        `&cost=${costUsd.toFixed(6)}&kind=${encodeURIComponent(kind)}` +
        `&action=${encodeURIComponent(action || '')}`,
      { signal: AbortSignal.timeout(8000) }
    );
  } catch (e) {
    /* non-fatal: never fail a paid user's request over a logging hiccup */
  }
}

function daysInCurrentMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionToken, messages, action, file } = req.body || {};

  if (!sessionToken || typeof sessionToken !== 'string') {
    return res.status(401).json({ error: 'sign_in_required', message: 'Please sign in to Club AI.' });
  }
  if (!Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'No message provided.' });
  }

  const isDefaultButton = !!action;

  // ---- Account + entitlement ----------------------------------------------
  // account.email below is the SERVER's resolution of the session token, not
  // anything the client asserted -- this is the actual fix for the
  // impersonation gap. If the token is missing/expired/revoked, account is
  // either null or {valid:false} and we bounce back to sign-in.
  //
  // Exception: if SIGNUP_ENDPOINT itself isn't configured yet (fresh setup,
  // still testing locally), there's no account backend to check against at
  // all -- fall back to an untracked dev session rather than hard-locking
  // the whole app before Rom has wired anything up. Once SIGNUP_ENDPOINT is
  // set, this fallback is unreachable and a bad session is always a real 401.
  const account = await fetchAccount(sessionToken);
  if (SIGNUP_ENDPOINT && (!account || account.valid === false)) {
    return res.status(401).json({
      error: 'sign_in_required',
      message: 'Your session has expired or was signed out on this device. Please sign in again.'
    });
  }
  const isPaid = !!(account && account.paid);

  if (!isPaid && PAID_ONLY_ACTIONS.includes(action)) {
    return res.status(402).json({
      error: 'paid_only',
      message: 'This feature is part of Club AI Pro.'
    });
  }

  if (!isPaid && account) {
    if (isDefaultButton) {
      const cap = FREE_ACTION_CAPS[action];
      const used = (account.actionsToday && account.actionsToday[action]) || 0;
      if (cap && used >= cap) {
        const label = FREE_ACTION_LABELS[action] || 'guided prompt';
        return res.status(429).json({
          error: 'trial_limit',
          message: `Your free trial includes ${cap} ${label} per day. Resets tomorrow — or upgrade to Club AI Pro for unlimited access.`
        });
      }
    } else if ((account.dayFreetext || 0) >= FREE_FREETEXT_PER_DAY) {
      return res.status(429).json({
        error: 'trial_limit',
        message: `Your free trial includes ${FREE_FREETEXT_PER_DAY} free messages per day. Resets tomorrow.`
      });
    }
  }

  const dailyBudget = MONTHLY_BUDGET_USD / daysInCurrentMonth();

  if (isPaid && account) {
    if ((account.spentUsd || 0) >= MONTHLY_BUDGET_USD) {
      return res.status(429).json({
        error: 'budget_reached',
        message: "You've used this month's Club AI allowance. It resets on the 1st."
      });
    }
    if ((account.spentUsdToday || 0) >= dailyBudget) {
      return res.status(429).json({
        error: 'daily_limit',
        message: "You've used today's share of your Club AI budget. It refills tomorrow — spreading it out keeps everyone's Pro access fast and unlimited-feeling all month."
      });
    }
  }

  // Heavy-feature cooldown — Pro only (free users are already blocked above
  // by PAID_ONLY_ACTIONS since all three heavy actions are paid-only).
  if (isPaid && account && HEAVY_ACTIONS.includes(action)) {
    const lastTs = (account.heavyActions && account.heavyActions[action]) || 0;
    if (lastTs) {
      const elapsedMs = Date.now() - lastTs;
      const cooldownMs = HEAVY_COOLDOWN_HOURS * 60 * 60 * 1000;
      if (elapsedMs < cooldownMs) {
        const mins = Math.ceil((cooldownMs - elapsedMs) / 60000);
        const wait = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
        const label = HEAVY_ACTION_LABELS[action] || 'this';
        return res.status(429).json({
          error: 'cooldown',
          message: `${label[0].toUpperCase()}${label.slice(1)} is limited to one every ${HEAVY_COOLDOWN_HOURS} hours. Next one in ${wait}.`
        });
      }
    }
  }

  const kind = !isDefaultButton ? 'freetext' : (HEAVY_ACTIONS.includes(action) ? 'heavy' : 'action');

  // ---- Mock mode -----------------------------------------------------------
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    await recordUsage(sessionToken, 0, kind, action);
    return res.status(200).json({
      reply: mockReply(action),
      mock: true,
      paid: isPaid,
      usage: isPaid ? { dayPct: 0, monthPct: 0 } : undefined
    });
  }

  // ---- Real call -----------------------------------------------------------
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    // Only the tail of the conversation is sent — the single biggest saving.
    const trimmed = messages.slice(-HISTORY_WINDOW).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    // "Upgrade old exam" attaches a document to the last user turn instead of
    // relying on plain text. PDFs go in as a native document block; anything
    // else (student pasted/uploaded plain text) is just appended as text.
    if (action === 'upgrade_exam' && file && file.data) {
      const last = trimmed[trimmed.length - 1];
      if (last && last.role === 'user') {
        const promptText = typeof last.content === 'string' && last.content
          ? last.content
          : 'Upgrade this old IMAT exam to exactly match the new IMAT format.';
        if ((file.mediaType || '').includes('pdf')) {
          last.content = [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } },
            { type: 'text', text: promptText }
          ];
        } else {
          last.content = `${promptText}\n\n--- UPLOADED EXAM (${file.name || 'file'}) ---\n${file.data}`;
        }
      }
    }

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: HEAVY_ACTIONS.includes(action) ? MAX_TOKENS_HEAVY : MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: trimmed
    });

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    const usage = response.usage || {};
    const costUsd =
      (usage.input_tokens || 0) * PRICE_IN_PER_TOKEN +
      (usage.output_tokens || 0) * PRICE_OUT_PER_TOKEN;

    await recordUsage(sessionToken, costUsd, kind, action);

    let usagePct;
    if (isPaid && account) {
      const newToday = (account.spentUsdToday || 0) + costUsd;
      const newMonth = (account.spentUsd || 0) + costUsd;
      usagePct = {
        dayPct: Math.min(100, Math.round((newToday / dailyBudget) * 100)),
        monthPct: Math.min(100, Math.round((newMonth / MONTHLY_BUDGET_USD) * 100))
      };
    }

    return res.status(200).json({ reply, paid: isPaid, usage: usagePct });
  } catch (err) {
    console.error('Club AI error:', err && err.message);
    return res.status(500).json({
      error: 'upstream',
      message: "Club AI couldn't answer that just now. Try again in a moment."
    });
  }
}
