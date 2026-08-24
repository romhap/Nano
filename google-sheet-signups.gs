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

function processData(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

  var email = (d.email || '').toString().trim().toLowerCase();
  if (!email) return;
  var now = new Date();

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
      email, d.name || '', d.whatsapp || '', now, now, 1,
      (d.score != null ? d.score : ''), d.targets || '', d.source || '', d.user_agent || ''
    ]);
  } else {
    var row = sheet.getRange(rowIndex, 1, 1, HEADERS.length).getValues()[0];
    if (!row[1] && d.name) row[1] = d.name;
    if (!row[2] && d.whatsapp) row[2] = d.whatsapp;
    row[4] = now;
    row[5] = (parseInt(row[5], 10) || 0) + 1;
    if (d.score != null && d.score !== '') row[6] = d.score;
    if (d.targets) row[7] = d.targets;
    if (d.source) row[8] = d.source;
    if (d.user_agent) row[9] = d.user_agent;
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
  if (!email) return;
  var sheet = getWebinarSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < emails.length; i++) {
      if ((emails[i][0] || '').toString().trim().toLowerCase() === email) return; // already logged
    }
  }
  sheet.appendRow([email, name || '', new Date(), false]);
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
