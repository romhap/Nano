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
      return json(aiCheck(e.parameter.aiCheck, e.parameter.whatsapp || ''));
    } catch (err) {
      return json({ paid: false, error: String(err) });
    } finally {
      lockA.releaseLock();
    }
  }
  if (e.parameter.aiUsage) {
    var lockB = LockService.getScriptLock();
    lockB.waitLock(20000);
    try {
      aiRecordUsage(
        e.parameter.aiUsage,
        parseFloat(e.parameter.cost || '0') || 0,
        e.parameter.kind || 'freetext'
      );
      return json({ ok: true });
    } catch (err) {
      return json({ ok: false, error: String(err) });
    } finally {
      lockB.releaseLock();
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
var WEBINAR_TITLE = 'Maximize your IMAT score in under 14 days';
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
 */

var AI_SHEET_NAME = 'ClubAI';
var AI_HEADERS = ['Email', 'WhatsApp', 'Paid', 'Spent USD (month)', 'Month',
                  'Buttons Today', 'Freetext Today', 'Day', 'First Seen', 'Last Seen'];

function getAiSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(AI_SHEET_NAME) || ss.insertSheet(AI_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(AI_HEADERS);
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

/** Returns the caller's current entitlement + usage, creating the row if new. */
function aiCheck(email, whatsapp) {
  email = (email || '').toString().trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return { paid: false };

  var sheet = getAiSheet();
  var now = new Date();
  var mKey = aiMonthKey(now);
  var dKey = aiDayKey(now);
  var row = aiFindRow(sheet, email);

  if (row === -1) {
    sheet.appendRow([email, whatsapp || '', false, 0, mKey, 0, 0, dKey, now, now]);
    return { paid: false, spentUsd: 0, dayButtons: 0, dayFreetext: 0, isNew: true };
  }

  var vals = sheet.getRange(row, 1, 1, AI_HEADERS.length).getValues()[0];
  var paid = aiTruthy(vals[2]);
  var spent = parseFloat(vals[3]) || 0;
  var storedMonth = String(vals[4] || '');
  var buttons = parseInt(vals[5], 10) || 0;
  var freetext = parseInt(vals[6], 10) || 0;
  var storedDay = String(vals[7] || '');

  // Self-resetting counters
  if (storedMonth !== mKey) { spent = 0; vals[3] = 0; vals[4] = mKey; }
  if (storedDay !== dKey) { buttons = 0; freetext = 0; vals[5] = 0; vals[6] = 0; vals[7] = dKey; }
  if (!vals[1] && whatsapp) vals[1] = whatsapp;
  vals[9] = now;
  sheet.getRange(row, 1, 1, AI_HEADERS.length).setValues([vals]);

  return { paid: paid, spentUsd: spent, dayButtons: buttons, dayFreetext: freetext };
}

/** Adds one request's cost and bumps the right daily counter. */
function aiRecordUsage(email, costUsd, kind) {
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
  if (String(vals[7] || '') !== dKey) { vals[5] = 0; vals[6] = 0; vals[7] = dKey; }

  vals[3] = (parseFloat(vals[3]) || 0) + (parseFloat(costUsd) || 0);
  if (kind === 'button') vals[5] = (parseInt(vals[5], 10) || 0) + 1;
  else vals[6] = (parseInt(vals[6], 10) || 0) + 1;
  vals[9] = now;

  sheet.getRange(row, 1, 1, AI_HEADERS.length).setValues([vals]);
}
