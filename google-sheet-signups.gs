/**
 * IMAT.club — Signups collector (Google Apps Script)
 * ---------------------------------------------
 * Appends/updates one row per person in a Google Sheet, live.
 *
 * SETUP (one time, ~2 minutes):
 *  1. Create a new Google Sheet (sheets.new) while signed in as
 *     romhaparnass@gmail.com. Name it e.g. "IMAT.club Signups".
 *  2. Extensions ▸ Apps Script. Delete any code, paste THIS whole file, Save.
 *  3. Deploy ▸ New deployment ▸ (gear) Web app.
 *        - Description: IMAT.club signups
 *        - Execute as: Me
 *        - Who has access: Anyone
 *     Deploy, authorise when prompted.
 *  4. Copy the Web app URL (it ends in /exec).
 *  5. Paste that URL into SIGNUP_ENDPOINT in BOTH lounge.html and script.js,
 *     then push. Done — new signups land in the sheet in real time.
 *
 * To test: open the /exec URL in a browser — you should see
 * {"ok":true,"msg":"IMAT.club signups endpoint live"}.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['Email', 'Name', 'WhatsApp', 'First Seen', 'Last Seen',
               'Events', 'Latest Score', 'Target Universities', 'Last Source', 'User Agent'];

// --- Input hardening -----------------------------------------------------
// This endpoint is public (anyone can call it, by design -- the site's own
// pages need to reach it with no login). Two things are worth guarding
// against on the way in: (1) Sheets "formula injection" -- a cell whose text
// starts with =, +, -, or @ can be interpreted as a formula when the sheet
// is opened, which is a known abuse vector for any public form that writes
// into a spreadsheet; (2) unbounded string length, so a malicious or buggy
// caller can't bloat every cell with megabytes of junk.
var MAX_FIELD_LENGTH = 300;
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sanitizeCell(v) {
  var s = (v == null ? '' : String(v)).slice(0, MAX_FIELD_LENGTH);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralize potential formula
  return s;
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(email) && email.length <= MAX_FIELD_LENGTH;
}

function processData(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  var email = (d.email || '').toString().trim().toLowerCase();
  if (!isValidEmail(email)) return;
  var now = new Date();

  var name = sanitizeCell(d.name);
  var whatsapp = sanitizeCell(d.whatsapp);
  var targets = sanitizeCell(d.targets);
  var source = sanitizeCell(d.source);
  var userAgent = sanitizeCell(d.user_agent);
  var score = (d.score != null && d.score !== '' && !isNaN(d.score)) ? Number(d.score) : '';

  var lastRow = sheet.getLastRow();
  var rowIndex = -1;
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if ((emails[i][0] || '').toString().trim().toLowerCase() === email) {
        rowIndex = i + 2;
        break;
      }
    }
  }

  if (rowIndex === -1) {
    sheet.appendRow([
      email, name, whatsapp, now, now, 1,
      score, targets, source, userAgent
    ]);
  } else {
    var row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
    if (!row[1] && name) row[1] = name;
    if (!row[2] && whatsapp) row[2] = whatsapp;
    row[4] = now;
    row[5] = (parseInt(row[5], 10) || 0) + 1;
    if (score !== '') row[6] = score;
    if (targets) row[7] = targets;
    if (source) row[8] = source;
    if (userAgent) row[9] = userAgent;
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    processData(d);
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e.parameter.aiCheck) {
    var lockA = LockService.getScriptLock();
    lockA.waitLock(20000);
    try {
      return json(aiCheck(e.parameter.aiCheck)); // param is now a session token, not an email
    } catch (err) {
      return json({ valid: false, error: String(err) });
    } finally {
      lockA.releaseLock();
    }
  }
  if (e.parameter.aiUsage) {
    var lockB = LockService.getScriptLock();
    lockB.waitLock(20000);
    try {
      aiRecordUsage( // param is now a session token, not an email
        e.parameter.aiUsage,
        parseFloat(e.parameter.cost || '0') || 0,
        e.parameter.kind || 'freetext',
        e.parameter.action || ''
      );
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockB.releaseLock();
    }
  }
  if (e.parameter.magicRequest) {
    var lockM = LockService.getScriptLock();
    lockM.waitLock(20000);
    try {
      return json(requestMagicLink(e.parameter.magicRequest, e.parameter.whatsapp || ''));
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockM.releaseLock();
    }
  }
  if (e.parameter.magicVerify) {
    var lockV = LockService.getScriptLock();
    lockV.waitLock(20000);
    try {
      return json(verifyMagicLink(e.parameter.magicVerify, e.parameter.deviceId || '', e.parameter.deviceLabel || ''));
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockV.releaseLock();
    }
  }
  if (e.parameter.listDevices) {
    var lockL = LockService.getScriptLock();
    lockL.waitLock(20000);
    try {
      return json(listDevices(e.parameter.listDevices));
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockL.releaseLock();
    }
  }
  if (e.parameter.revokeDevice) {
    var lockR = LockService.getScriptLock();
    lockR.waitLock(20000);
    try {
      return json(revokeDevice(e.parameter.revokeDevice, e.parameter.targetDeviceId || ''));
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockR.releaseLock();
    }
  }
  if (e.parameter.webinarSignup) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      addWebinarAttendee(e.parameter.webinarSignup, e.parameter.name || '');
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lock.releaseLock();
    }
  }
  if (e.parameter.data) {
    var lock2 = LockService.getScriptLock();
    lock2.waitLock(20000);
    try {
      var d = JSON.parse(e.parameter.data);
      processData(d);
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lock2.releaseLock();
    }
  }
  return json({ ok: true, msg: 'IMAT.club signups endpoint live' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ============================================================
 * WEBINAR ZOOM-LINK REMINDER — no third-party service needed
 * ============================================================
 * How it works:
 *  1. After paying, buyers land on webinar-success.html and enter their
 *     email. That calls this endpoint (?webinarSignup=email) which logs
 *     them into a dedicated "WebinarAttendees" tab below — NOT the main
 *     Signups sheet, so it's easy to manage per-event.
 *  2. Before each session, fill in WEBINAR_ZOOM_LINK, WEBINAR_TITLE, and
 *     WEBINAR_DATE_LABEL just below, then run sendWebinarReminders() —
 *     either by hand (Apps Script editor ▸ select the function in the
 *     dropdown ▸ Run) about an hour before the session, or fully
 *     automatically:
 *       Apps Script editor ▸ Triggers (clock icon, left sidebar) ▸
 *       Add Trigger ▸ Function: sendWebinarReminders ▸ Time-driven ▸
 *       pick the exact date and time (1 hour before the webinar) ▸ Save.
 *     That one-time trigger fires itself at that moment, then is done —
 *     no ongoing schedule to maintain.
 *  3. It emails everyone marked "not yet reminded" and marks them
 *     reminded, so re-running it (e.g. if you add stragglers) never
 *     double-sends.
 *  4. For your NEXT webinar: update the three constants below, and
 *     either clear the "Reminded" column for old rows you want to
 *     reuse, or just let fresh signups accumulate — only unreminded
 *     rows get emailed.
 */

var WEBINAR_ZOOM_LINK = 'https://unipd.zoom.us/j/81414142293?pwd=SwdULyYers3tv08Eb7of4z4Uix9PaI.1';
var WEBINAR_MEETING_ID = '814 1414 2293';
var WEBINAR_PASSCODE = '286595';
var WEBINAR_TITLE = 'From Maybe to Mastery — Everything You Need to Pass the IMAT';
var WEBINAR_DATE_LABEL = 'September 4 at 1PM Italy time'; // shown in the reminder email

// Custom sender name WITHOUT changing your Google Account's real name.
// One-time setup in Gmail (same account this script runs from):
//   Settings (gear) > See all settings > Accounts and Import >
//   "Send mail as" > Add another email address > Name: WEBINAR_SENDER_NAME
//   below, Email: your own Gmail address (the one in WEBINAR_SENDER_EMAIL).
//   No verification needed since you already own that address.
// Until you've done that AND filled in WEBINAR_SENDER_EMAIL below, this
// automatically falls back to sending under your account's real name.
var WEBINAR_SENDER_NAME = 'Rom from IMAT.club';
var WEBINAR_SENDER_EMAIL = 'romhaparnass+imatclub@gmail.com';

var WEBINAR_SHEET_NAME = 'WebinarAttendees';
var WEBINAR_HEADERS = ['Email', 'Name', 'Purchased At', 'Reminded'];

function getWebinarSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(WEBINAR_SHEET_NAME) || ss.insertSheet(WEBINAR_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(WEBINAR_HEADERS);
  return sheet;
}

function addWebinarAttendee(email, name) {
  email = (email || '').toString().trim().toLowerCase();
  if (!isValidEmail(email)) return;
  var sheet = getWebinarSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if ((emails[i][0] || '').toString().trim().toLowerCase() === email) return; // already logged
    }
  }
  sheet.appendRow([email, sanitizeCell(name), new Date(), false]);
}

function sendWebinarReminders() {
  var sheet = getWebinarSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var rows = sheet.getRange(2, 1, lastRow - 1, WEBINAR_HEADERS.length).getValues();
  var sentCount = 0;

  for (var i = 0; i < rows.length; i++) {
    var email = rows[i][0];
    var name = rows[i][1];
    var reminded = rows[i][3];
    if (!email || reminded === true) continue;

    var greeting = name ? ('Hey ' + name + ',') : 'Hey,';
    var body = greeting + '\n\n' +
      'Your live IMAT.club webinar — "' + WEBINAR_TITLE + '" — starts ' + WEBINAR_DATE_LABEL + '.\n\n' +
      'Join here:\n' + WEBINAR_ZOOM_LINK + '\n\n' +
      'Meeting ID: ' + WEBINAR_MEETING_ID + '\n' +
      'Passcode: ' + WEBINAR_PASSCODE + '\n\n' +
      'Can\'t make it live? A recording will be sent to you afterward.\n\n' +
      'See you there.\nRom & Maya';

    var subject = 'Your Zoom link — starting soon';
    if (WEBINAR_SENDER_EMAIL) {
      try {
        // Uses a registered Gmail "Send As" identity -- Gmail honors this
        // name reliably (including Gmail-to-Gmail), unlike MailApp's name
        // option below, which Gmail can silently override.
        GmailApp.sendEmail(email, subject, body, { name: WEBINAR_SENDER_NAME, from: WEBINAR_SENDER_EMAIL });
      } catch (sendErr) {
        // WEBINAR_SENDER_EMAIL isn't a registered "Send As" identity yet --
        // fall back rather than silently skip this person.
        MailApp.sendEmail({ to: email, subject: subject, body: body, name: WEBINAR_SENDER_NAME });
      }
    } else {
      MailApp.sendEmail({ to: email, subject: subject, body: body, name: WEBINAR_SENDER_NAME });
    }

    sheet.getRange(i + 2, 4).setValue(true); // mark Reminded
    sentCount++;
  }

  Logger.log('Sent ' + sentCount + ' webinar reminder(s).');
}

/**
 * ============================================================
 * CLUB AI — accounts, trial limits and spend tracking
 * ============================================================
 * Lives in its own "ClubAI" tab, separate from Signups and
 * WebinarAttendees.
 *
 * The "Paid" column is the switch: set it to TRUE when someone
 * subscribes via the Club AI Stripe link, FALSE (or blank) for
 * trial users. Nothing sets it automatically — same manual flow
 * you already use for new subscribers.
 *
 * Day and month counters reset themselves, so you never need to
 * clear them by hand.
 *
 * NOTE: this schema changed shape (Buttons Today -> Actions Today,
 * Last Mock Exam Day -> Last Heavy Action, + Spent USD (day)). If a
 * ClubAI tab already exists from before this change, delete it —
 * it'll be recreated fresh on the next request. Safe to do since this
 * is still pre-launch (no real paying users depend on the old columns).
 */

var AI_SHEET_NAME = 'ClubAI';
// 'Actions Today' and 'Last Heavy Action' are small JSON objects (not one
// column per action) so adding/removing a free action or a heavy feature
// later never requires another header migration:
//   Actions Today     = {"mock_question":1,"university":0,...}  (free daily caps)
//   Last Heavy Action = {"mock_exam":1699999999999,...}         (Pro 5hr cooldowns)
var AI_HEADERS = ['Email', 'WhatsApp', 'Paid', 'Spent USD (month)', 'Month',
                  'Actions Today', 'Freetext Today', 'Day', 'First Seen', 'Last Seen',
                  'Last Heavy Action', 'Spent USD (day)'];

function getAiSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AI_SHEET_NAME) || ss.insertSheet(AI_SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(AI_HEADERS);
  } else {
    // Migration: extend the header row in place if newer columns were added
    // after this sheet was first created. Existing data is untouched.
    var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existing.length < AI_HEADERS.length) {
      sheet.getRange(1, existing.length + 1, 1, AI_HEADERS.length - existing.length)
        .setValues([AI_HEADERS.slice(existing.length)]);
    }
  }
  return sheet;
}

function aiMonthKey(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
}
function aiDayKey(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function aiFindRow(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if ((emails[i][0] || '').toString().trim().toLowerCase() === email) return i + 2;
  }
  return -1;
}

function aiTruthy(v) {
  return v === true || /^(true|yes|y|1)$/i.test(String(v).trim());
}

function aiParseJson(v) {
  if (!v) return {};
  try {
    var parsed = JSON.parse(v);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) { return {}; }
}

/** Returns the caller's current entitlement + usage, creating the row if new.
 *  Internal helper -- callers must already have a verified email (from a
 *  resolved session), never a client-claimed one. See aiCheck() below for
 *  the actual public-facing, session-authenticated entry point. */
function aiCheckByEmail(email, whatsapp) {
  email = (email || '').toString().trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return { paid: false };

  var sheet = getAiSheet();
  var now = new Date();
  var mKey = aiMonthKey(now);
  var dKey = aiDayKey(now);
  var row = aiFindRow(sheet, email);

  if (row === -1) {
    sheet.appendRow([email, whatsapp || '', false, 0, mKey, '{}', 0, dKey, now, now, '{}', 0]);
    return { paid: false, spentUsd: 0, spentUsdToday: 0, actionsToday: {}, dayFreetext: 0,
             heavyActions: {}, today: dKey, isNew: true };
  }

  var vals = sheet.getRange(row, 1, 1, AI_HEADERS.length).getValues()[0];
  var paid = aiTruthy(vals[2]);
  var spent = parseFloat(vals[3]) || 0;
  var storedMonth = String(vals[4] || '');
  var actionsToday = aiParseJson(vals[5]);
  var freetext = parseInt(vals[6], 10) || 0;
  var storedDay = String(vals[7] || '');
  var spentToday = parseFloat(vals[11]) || 0;

  // Self-resetting counters
  if (storedMonth !== mKey) { spent = 0; vals[3] = 0; vals[4] = mKey; }
  if (storedDay !== dKey) {
    actionsToday = {}; freetext = 0; spentToday = 0;
    vals[5] = '{}'; vals[6] = 0; vals[7] = dKey; vals[11] = 0;
  }
  if (!vals[1] && whatsapp) vals[1] = whatsapp;
  vals[9] = now;
  sheet.getRange(row, 1, 1, AI_HEADERS.length).setValues([vals]);

  // Heavy-action cooldowns (Pro only): per-action epoch-ms timestamps, so the
  // serverless side can compare elapsed time without timezone ambiguity.
  var heavyActions = aiParseJson(vals[10]);

  return {
    paid: paid,
    spentUsd: spent,
    spentUsdToday: spentToday,
    actionsToday: actionsToday,
    dayFreetext: freetext,
    heavyActions: heavyActions,
    today: dKey
  };
}

/** Adds one request's cost, bumps the relevant daily counter, stamps heavy-
 *  action cooldowns. Internal helper -- takes an already-verified email,
 *  same rule as above.
 *  kind: 'freetext' | 'action' (one of the free-capped guided buttons) |
 *        'heavy' (mock_exam / anki_check / upgrade_exam -- 5hr cooldown) */
function aiRecordUsageByEmail(email, costUsd, kind, action) {
  email = (email || '').toString().trim().toLowerCase();
  if (!email) return;

  var sheet = getAiSheet();
  var row = aiFindRow(sheet, email);
  if (row === -1) return;

  var now = new Date();
  var vals = sheet.getRange(row, 1, 1, AI_HEADERS.length).getValues()[0];
  var mKey = aiMonthKey(now);
  var dKey = aiDayKey(now);

  if (String(vals[4] || '') !== mKey) { vals[3] = 0; vals[4] = mKey; }
  if (String(vals[7] || '') !== dKey) { vals[5] = '{}'; vals[6] = 0; vals[7] = dKey; vals[11] = 0; }

  vals[3] = (parseFloat(vals[3]) || 0) + (parseFloat(costUsd) || 0);
  vals[11] = (parseFloat(vals[11]) || 0) + (parseFloat(costUsd) || 0);

  if (kind === 'freetext') {
    vals[6] = (parseInt(vals[6], 10) || 0) + 1;
  } else if (kind === 'action' && action) {
    var actionsToday = aiParseJson(vals[5]);
    actionsToday[action] = (actionsToday[action] || 0) + 1;
    vals[5] = JSON.stringify(actionsToday);
  } else if (kind === 'heavy' && action) {
    var heavyActions = aiParseJson(vals[10]);
    heavyActions[action] = now.getTime();
    vals[10] = JSON.stringify(heavyActions);
  }

  vals[9] = now;
  sheet.getRange(row, 1, 1, AI_HEADERS.length).setValues([vals]);
}

/**
 * ============================================================
 * CLUB AI — magic-link sign-in + per-device sessions
 * ============================================================
 * Why this exists: without it, "who is this user" was just whatever email
 * string the browser sent -- anyone who knew a paying customer's email
 * could type it in and get free Pro access. This closes that gap.
 *
 * Two tabs:
 *   MagicLinks -- short-lived (30 min), single-use sign-in tokens, emailed
 *                 to the address the student typed in.
 *   Devices    -- one row per browser that has ever signed in. Holds that
 *                 device's current session token (the actual bearer secret
 *                 used on every request from then on), a human-readable
 *                 label, and a Revoked flag so a device can be signed out
 *                 remotely from any other device on the same account.
 *
 * Flow:
 *   1. Browser calls magicRequest(email, whatsapp) -> emails a link like
 *      club-ai.html?magic=TOKEN.
 *   2. Whichever browser opens that link calls magicVerify(token, deviceId,
 *      deviceLabel) -> token is single-use-checked, the ClubAI account row
 *      is created if new, and a session token is issued for that specific
 *      device (deviceId is a random id the browser generates once and
 *      keeps in localStorage -- it is NOT a secret, just a stable "this is
 *      the same browser as last time" marker).
 *   3. The browser stores the session token and sends it on every request
 *      from then on. aiCheck()/aiRecordUsage() below resolve it server-side
 *      -- the client can no longer just claim to be anyone by typing an
 *      email into a request.
 *   4. "Manage devices" calls listDevices(sessionToken) to see every device
 *      on the account, and revokeDevice(sessionToken, targetDeviceId) to
 *      sign one out. A revoked device's session token stops working
 *      immediately; that browser has to sign in again via a fresh link.
 */

var MAGIC_SHEET_NAME = 'MagicLinks';
var MAGIC_HEADERS = ['Token', 'Email', 'WhatsApp', 'Created', 'Expires', 'Used'];
var MAGIC_LINK_TTL_MS = 30 * 60 * 1000;      // link expires 30 min after request
var MAGIC_REQUEST_COOLDOWN_MS = 60 * 1000;   // 1 request per email per minute (anti-spam)

var DEVICE_SHEET_NAME = 'Devices';
var DEVICE_HEADERS = ['DeviceId', 'Email', 'Label', 'SessionToken', 'Created', 'LastSeen', 'Revoked'];

function getMagicSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(MAGIC_SHEET_NAME) || ss.insertSheet(MAGIC_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(MAGIC_HEADERS);
  return sheet;
}

function getDeviceSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(DEVICE_SHEET_NAME) || ss.insertSheet(DEVICE_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(DEVICE_HEADERS);
  return sheet;
}

// Utilities.getUuid() is a cryptographically random RFC4122 v4 UUID (122
// bits of entropy) -- far beyond guessable either for a 30-minute magic
// link or a long-lived session. Session tokens use two, for margin, since
// they don't expire on their own.
function genMagicToken() { return Utilities.getUuid().replace(/-/g, ''); }
function genSessionToken() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }

function findRowByExact(sheet, col, value) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var vals = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '') === value) return i + 2;
  }
  return -1;
}

// Reuses the same Gmail "Send As" identity already set up for webinar
// reminders (WEBINAR_SENDER_NAME/EMAIL above) -- one alias serves both.
function sendFromClub(to, subject, body) {
  if (WEBINAR_SENDER_EMAIL) {
    try {
      GmailApp.sendEmail(to, subject, body, { name: WEBINAR_SENDER_NAME, from: WEBINAR_SENDER_EMAIL });
      return;
    } catch (sendErr) { /* fall through */ }
  }
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: WEBINAR_SENDER_NAME });
}

/** Emails a one-time sign-in link. Returns {ok:false, error:'rate_limited'}
 *  if this email requested one in the last minute. */
function requestMagicLink(email, whatsapp) {
  email = (email || '').toString().trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: 'invalid_email' };

  var sheet = getMagicSheet();
  var now = new Date();

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var rows = sheet.getRange(2, 1, lastRow - 1, MAGIC_HEADERS.length).getValues();
    for (var i = rows.length - 1; i >= 0; i--) {
      if (String(rows[i][1] || '').toLowerCase() === email) {
        var created = rows[i][3] instanceof Date ? rows[i][3] : new Date(rows[i][3]);
        if (now.getTime() - created.getTime() < MAGIC_REQUEST_COOLDOWN_MS) {
          return { ok: false, error: 'rate_limited' };
        }
        break;
      }
    }
  }

  var token = genMagicToken();
  var expires = new Date(now.getTime() + MAGIC_LINK_TTL_MS);
  sheet.appendRow([token, email, sanitizeCell(whatsapp), now, expires, false]);

  var link = 'https://www.imat.club/club-ai.html?magic=' + token;
  var subject = 'Your Club AI sign-in link';
  var body = 'Tap to sign in to Club AI:\n\n' + link +
    '\n\nThis link works once and expires in 30 minutes. If you did not request it, you can ignore this email.';
  sendFromClub(email, subject, body);

  return { ok: true };
}

/** Consumes a magic link token and issues a session for the requesting device. */
function verifyMagicLink(token, deviceId, deviceLabel) {
  token = (token || '').toString().trim();
  deviceId = sanitizeCell(deviceId);
  if (!token) return { ok: false, error: 'missing_token' };
  if (!deviceId) return { ok: false, error: 'missing_device' };

  var sheet = getMagicSheet();
  var row = findRowByExact(sheet, 1, token);
  if (row === -1) return { ok: false, error: 'invalid_token' };

  var vals = sheet.getRange(row, 1, 1, MAGIC_HEADERS.length).getValues()[0];
  var email = String(vals[1] || '').toLowerCase();
  var whatsapp = String(vals[2] || '');
  var expires = vals[4] instanceof Date ? vals[4] : new Date(vals[4]);
  var used = vals[5] === true;

  if (used) return { ok: false, error: 'used' };
  if (new Date().getTime() > expires.getTime()) return { ok: false, error: 'expired' };

  sheet.getRange(row, 6).setValue(true); // single-use

  aiCheckByEmail(email, whatsapp); // creates the ClubAI account row if new
  var sessionToken = upsertDevice(deviceId, email, sanitizeCell(deviceLabel));

  return { ok: true, sessionToken: sessionToken, email: email };
}

/** Creates or refreshes the Devices row for this deviceId, returns a fresh
 *  session token. Re-authenticating on a known device reuses its row
 *  (so "manage devices" shows one entry per browser, not one per login). */
function upsertDevice(deviceId, email, label) {
  var sheet = getDeviceSheet();
  var row = findRowByExact(sheet, 1, deviceId);
  var sessionToken = genSessionToken();
  var now = new Date();

  if (row === -1) {
    sheet.appendRow([deviceId, email, label || 'Unknown device', sessionToken, now, now, false]);
  } else {
    var vals = sheet.getRange(row, 1, 1, DEVICE_HEADERS.length).getValues()[0];
    vals[1] = email;
    if (label) vals[2] = label;
    vals[3] = sessionToken;
    vals[5] = now;
    vals[6] = false;
    sheet.getRange(row, 1, 1, DEVICE_HEADERS.length).setValues([vals]);
  }
  return sessionToken;
}

/** Resolves a session token to {email, deviceId}, or null if missing/revoked.
 *  Bumps LastSeen on every successful check -- this is what makes "recognize
 *  the device" and device-list timestamps actually reflect real usage. */
function resolveSession(sessionToken) {
  sessionToken = (sessionToken || '').toString().trim();
  if (!sessionToken) return null;
  var sheet = getDeviceSheet();
  var row = findRowByExact(sheet, 4, sessionToken);
  if (row === -1) return null;
  var vals = sheet.getRange(row, 1, 1, DEVICE_HEADERS.length).getValues()[0];
  if (vals[6] === true) return null; // revoked
  sheet.getRange(row, 6).setValue(new Date());
  return { email: String(vals[1] || '').toLowerCase(), deviceId: String(vals[0] || '') };
}

/** Public, session-authenticated entry point -- this is what api/chat.js
 *  actually calls. Replaces the old email-trusting aiCheck(). */
function aiCheck(sessionToken) {
  var session = resolveSession(sessionToken);
  if (!session) return { valid: false };
  var state = aiCheckByEmail(session.email, '');
  state.valid = true;
  state.email = session.email;
  return state;
}

/** Session-authenticated usage recording -- replaces the old email-trusting
 *  version. Without this, anyone could forge spend/cooldown records for an
 *  arbitrary email by calling the endpoint directly. */
function aiRecordUsage(sessionToken, costUsd, kind, action) {
  var session = resolveSession(sessionToken);
  if (!session) return;
  aiRecordUsageByEmail(session.email, costUsd, kind, action);
}

/** All non-revoked devices on the caller's account, oldest first. Never
 *  returns raw session tokens -- deviceId is the only identifier exposed,
 *  and it is not a bearer credential. */
function listDevices(sessionToken) {
  var session = resolveSession(sessionToken);
  if (!session) return { ok: false, error: 'invalid_session' };

  var sheet = getDeviceSheet();
  var lastRow = sheet.getLastRow();
  var out = [];
  if (lastRow > 1) {
    var rows = sheet.getRange(2, 1, lastRow - 1, DEVICE_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1] || '').toLowerCase() !== session.email) continue;
      if (rows[i][6] === true) continue; // revoked, don't list
      var lastSeen = rows[i][5] instanceof Date ? rows[i][5] : new Date(rows[i][5]);
      out.push({
        deviceId: String(rows[i][0] || ''),
        label: String(rows[i][2] || 'Unknown device'),
        lastSeen: lastSeen.getTime(),
        isCurrent: String(rows[i][0] || '') === session.deviceId
      });
    }
  }
  out.sort(function (a, b) { return b.lastSeen - a.lastSeen; });
  return { ok: true, devices: out };
}

/** Signs a device out remotely. Only works on devices belonging to the
 *  caller's OWN account -- the caller's session proves which account that
 *  is, so one user can never revoke another's device. */
function revokeDevice(sessionToken, targetDeviceId) {
  var session = resolveSession(sessionToken);
  if (!session) return { ok: false, error: 'invalid_session' };

  var sheet = getDeviceSheet();
  var row = findRowByExact(sheet, 1, sanitizeCell(targetDeviceId));
  if (row === -1) return { ok: false, error: 'not_found' };

  var rowEmail = String(sheet.getRange(row, 2).getValue() || '').toLowerCase();
  if (rowEmail !== session.email) return { ok: false, error: 'not_yours' };

  sheet.getRange(row, 7).setValue(true); // Revoked
  return { ok: true };
}
