/**
 * IMP — Signups collector (Google Apps Script)
 * ---------------------------------------------
 * Appends/updates one row per person in a Google Sheet, live.
 *
 * SETUP (one time, ~2 minutes):
 *  1. Create a new Google Sheet (sheets.new) while signed in as
 *     romhaparnass@gmail.com. Name it e.g. "IMP Signups".
 *  2. Extensions ▸ Apps Script. Delete any code, paste THIS whole file, Save.
 *  3. Deploy ▸ New deployment ▸ (gear) Web app.
 *        - Description: IMP signups
 *        - Execute as: Me
 *        - Who has access: Anyone
 *     Deploy, authorise when prompted.
 *  4. Copy the Web app URL (it ends in /exec).
 *  5. Paste that URL into SIGNUP_ENDPOINT in BOTH lounge.html and script.js,
 *     then push. Done — new signups land in the sheet in real time.
 *
 * To test: open the /exec URL in a browser — you should see
 * {"ok":true,"msg":"IMP signups endpoint live"}.
 */

var SHEET_NAME = 'Signups';
var HEADERS = ['Email', 'Name', 'WhatsApp', 'First Seen', 'Last Seen',
               'Events', 'Latest Score', 'Target Universities', 'Last Source', 'User Agent'];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);

    var d = JSON.parse(e.postData.contents);
    var email = (d.email || '').toString().trim().toLowerCase();
    if (!email) return json({ ok: false, error: 'no email' });
    var now = new Date();

    // Find an existing row for this email (one clean row per person)
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
      row[4] = now;                                  // Last Seen
      row[5] = (parseInt(row[5], 10) || 0) + 1;      // Events count
      if (d.score != null && d.score !== '') row[6] = d.score;  // Latest Score
      if (d.targets) row[7] = d.targets;
      if (d.source) row[8] = d.source;
      if (d.user_agent) row[9] = d.user_agent;
      sheet.getRange(rowIndex, 1, 1, HEADERS.length).setValues([row]);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, msg: 'IMP signups endpoint live' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
