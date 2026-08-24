/**
 * IMAT.club — Signups collector + lounge access gate (Google Apps Script)
 * -------------------------------------------------------------------------
 * Appends/updates one row per person in a Google Sheet, live. Also answers
 * "has this email paid?" for the lounge login gate — see the PAID COLUMN
 * section below, this is the part that needs YOUR manual action per signup.
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
 *
 * PAID COLUMN — how lounge access is gated:
 * Every row gets a "Paid" column, defaulting to FALSE. The lounge login
 * checks this column before letting someone in — so signing up for the
 * lounge with any email does NOT grant access by itself. When someone
 * actually pays (you already personally message every new subscriber on
 * WhatsApp per your own workflow — do this at the same moment):
 *   1. Open the Signups sheet
 *   2. Find their row, set the "Paid" column to TRUE
 * That's it — their next lounge login attempt (or the one already loading)
 * will succeed. If you ever need to revoke access (e.g. someone cancels),
 * set their "Paid" cell back to FALSE.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['Email', 'Name', 'WhatsApp', 'First Seen', 'Last Seen',
               'Events', 'Latest Score', 'Target Universities', 'Last Source', 'User Agent', 'Paid'];

// Column index (0-based) of "Paid" — kept as a constant since it's read from
// several places below.
var PAID_COL = HEADERS.indexOf('Paid'); // 10

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  } else {
    // Migration: an older deployment of this sheet may be missing newer
    // trailing columns (e.g. "Paid" added later). Extend the header row
    // in place rather than touching any existing data.
    var existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (existingHeaders.length < HEADERS.length) {
      sheet.getRange(1, existingHeaders.length + 1, 1, HEADERS.length - existingHeaders.length)
        .setValues([HEADERS.slice(existingHeaders.length)]);
    }
  }
  return sheet;
}

function findRow(sheet, email) {
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  var emails = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < emails.length; i++) {
    if ((emails[i][0] || '').toString().trim().toLowerCase() === email) return i + 2;
  }
  return -1;
}

function processData(d) {
  var sheet = getSheet();
  var email = (d.email || '').toString().trim().toLowerCase();
  if (!email) return;
  var now = new Date();

  var rowIndex = findRow(sheet, email);

  if (rowIndex === -1) {
    sheet.appendRow([
      email, d.name || '', d.whatsapp || '', now, now, 1,
      (d.score != null ? d.score : ''), d.targets || '', d.source || '', d.user_agent || '',
      false // Paid — defaults to unpaid; you flip this to TRUE manually per subscriber
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
    // Column 11 (Paid) is intentionally left untouched here — only you
    // editing the sheet by hand changes it, never an automatic signup event.
    sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
  }
}

function checkAccess(email) {
  email = (email || '').toString().trim().toLowerCase();
  if (!email) return { authorized: false };
  var sheet = getSheet();
  var rowIndex = findRow(sheet, email);
  if (rowIndex === -1) return { authorized: false };
  var paidVal = sheet.getRange(rowIndex, PAID_COL + 1).getValue();
  var authorized = paidVal === true || /^(true|yes|y|1)$/i.test(String(paidVal).trim());
  return { authorized: authorized };
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
  if (e.parameter.checkAccess) {
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      return json(checkAccess(e.parameter.checkAccess));
    } catch (err) {
      return json({ authorized: false, error: String(err) });
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
