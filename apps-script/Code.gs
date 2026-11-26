/**
 * DEED Vehicle Financing Campaign: lead capture for Google Sheets.
 *
 * Paste this into the spreadsheet's Extensions > Apps Script editor,
 * run setup() once, then Deploy > New deployment > Web app.
 * Full steps: docs/GOOGLE_SHEET_SETUP.md
 */

var SETTINGS = {
  LEAD_PREFIX: 'DEEDVFC-2026-',        // Lead IDs look like DEEDVFC-2026-0001 (match LEAD_PREFIX in public/config.js)
  NOTIFY_EMAILS: '',                   // Extra fixed recipients, e.g. 'coordinator@deed.example' (optional)
  // Who gets an email for every new lead is managed in the staff portal (Team > New lead emails).
  // This needs the Google account that owns this script to have access to the Firebase project.
  FIREBASE_PROJECT_ID: 'deed-car-financing',
  PORTAL_URL: 'https://arnoldocaya.github.io/deed-car-financing-campaign/portal/',
  CONTRIBUTION_PCT: 30,
  RAW_SHEET: 'Raw Submissions',
  TRACKER_SHEET: 'Lead Tracker',
  DASHBOARD_SHEET: 'Campaign Dashboard',
  LISTS_SHEET: 'Lists'
};

var RAW_HEADERS = [
  'Lead ID', 'Received At', 'Lead Type', 'Source', 'Full Name', 'Phone', 'Alt Phone',
  'Preferred Contact Method', 'Area', 'Vehicle', 'Make', 'Model', 'Year', 'Vehicle Price (UGX)',
  'Buying From Partner', 'Officer Attached', 'Can Raise 30%', 'Available Contribution (UGX)',
  'Purchase Timeline', 'Repayment Period', 'Income Source', 'Wants Officer Contact',
  'Preferred Contact Time', 'Questions', 'Consent', 'Submission ID', 'Page URL', 'Referrer',
  'Landed At', 'Client Time', 'User Agent', 'Partner Bond'
];

// Columns A–W follow the campaign plan; X–Z are extras for officers.
var TRACKER_HEADERS = [
  'Lead ID', 'Date Received', 'Customer Name', 'Phone Number', 'Alternative Phone', 'Area',
  'Vehicle Interested In', 'Vehicle Price', '30% Contribution', '70% Financing Estimate',
  "Customer's Available Contribution", 'Source / Car Bond', 'Preferred Contact Method',
  'Assigned Officer', 'Lead Status', 'Last Contact Date', 'Contact Attempts', 'Next Follow-Up Date',
  'Follow-Up Notes', 'Loan Application Started', 'Loan Application Reference', 'Final Outcome',
  'Closed / Lost Reason', 'Lead Type', 'Preferred Contact Time', 'WhatsApp Link'
];

var STATUSES = [
  'New Lead', 'Contact Attempted', 'Contacted', 'Interested', 'Documents Pending',
  'Application Started', 'Submitted for Assessment', 'Approved', 'Awaiting Customer Contribution',
  'Completed', 'Not Eligible', 'Lost', 'Follow-Up Later'
];
var OUTCOMES = ['Open', 'Financed', 'Not Eligible', 'Lost', 'Withdrawn'];
var LOST_REASONS = ['Could not raise contribution', 'Bought elsewhere', 'Not reachable', 'Changed mind', 'Did not qualify', 'Other'];
var OFFICERS = ['Officer 1', 'Officer 2', 'Officer 3']; // edit in the Lists tab after setup

/* ------------------------------------------------------------------ */
/* Web app                                                             */
/* ------------------------------------------------------------------ */

function doGet() {
  return json_({ ok: true, service: 'DEED vehicle financing leads' });
}

function doPost(e) {
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var err = validate_(data);
    if (err) return json_({ ok: false, error: err });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      // De-duplicate retries of the same submission.
      var cache = CacheService.getScriptCache();
      var seen = cache.get('sub_' + data.submission_id);
      if (seen) return json_({ ok: true, lead_id: seen, duplicate: true });

      var ss = SpreadsheetApp.getActiveSpreadsheet();
      ensureSheets_(ss);
      // When the portal (Firebase) already gave a reference, reuse it so both records match.
      var leadId = /^[A-Z]{2,10}-\d{4}-\d+$/.test(String(data.lead_ref || '')) ? String(data.lead_ref) : nextLeadId_();
      var now = new Date();

      appendRaw_(ss, leadId, now, data);
      appendTracker_(ss, leadId, now, data);
      SpreadsheetApp.flush();

      cache.put('sub_' + data.submission_id, leadId, 21600);
    } finally {
      lock.releaseLock();
    }

    notify_(leadId, data);
    return json_({ ok: true, lead_id: leadId });
  } catch (ex) {
    console.error(ex);
    return json_({ ok: false, error: 'Server error' });
  }
}

/* ------------------------------------------------------------------ */
/* Setup: run once from the editor                                     */
/* ------------------------------------------------------------------ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.rename('DEED Vehicle Financing Campaign – Lead Management');
  ensureSheets_(ss);
  buildLists_(ss);
  buildTrackerRules_(ss);
  buildDashboard_(ss);
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  SpreadsheetApp.getUi && toast_(ss, 'Setup complete. Now deploy as a web app.');
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

function validate_(d) {
  if (!d || typeof d !== 'object') return 'Invalid data';
  if (!d.submission_id || String(d.submission_id).length > 64) return 'Missing submission id';
  if (!d.full_name || String(d.full_name).trim().length < 2) return 'Name is required';
  if (!/^\+2567\d{8}$/.test(String(d.phone || ''))) return 'A valid Ugandan phone number is required';
  if (d.consent !== 'Yes') return 'Consent is required';
  if (d.lead_type === 'Application') {
    if (!d.vehicle) return 'Vehicle is required';
    if (!(Number(d.vehicle_price) > 0)) return 'Vehicle price is required';
  }
  return null;
}

function ensureSheets_(ss) {
  var raw = ss.getSheetByName(SETTINGS.RAW_SHEET) || ss.insertSheet(SETTINGS.RAW_SHEET, 0);
  if (raw.getLastRow() === 0) {
    raw.appendRow(RAW_HEADERS);
    styleHeader_(raw, RAW_HEADERS.length);
    raw.getRange('A1').setNote('Raw record of every submission. Do not edit or delete rows. Officers work in "Lead Tracker".');
  }
  var tr = ss.getSheetByName(SETTINGS.TRACKER_SHEET) || ss.insertSheet(SETTINGS.TRACKER_SHEET, 1);
  if (tr.getLastRow() === 0) {
    tr.appendRow(TRACKER_HEADERS);
    styleHeader_(tr, TRACKER_HEADERS.length);
    tr.setFrozenColumns(3);
  }
}

function styleHeader_(sh, n) {
  sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#282c69').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(1);
}

function nextLeadId_() {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('LEAD_COUNTER') || 0) + 1;
  props.setProperty('LEAD_COUNTER', String(n));
  return SETTINGS.LEAD_PREFIX + ('000' + n).slice(-Math.max(4, String(n).length));
}

/** Store as text and neutralise spreadsheet formulas in user input. */
function txt_(v) {
  if (v === null || v === undefined) return '';
  var s = String(v).trim().slice(0, 1000);
  if (s === '') return '';
  return "'" + s;
}
function num_(v) {
  var n = Number(v);
  return isFinite(n) && n > 0 ? Math.round(n) : '';
}

function appendRaw_(ss, id, now, d) {
  ss.getSheetByName(SETTINGS.RAW_SHEET).appendRow([
    id, now, txt_(d.lead_type), txt_(d.source), txt_(d.full_name), txt_(d.phone), txt_(d.alt_phone),
    txt_(d.contact_method), txt_(d.area), txt_(d.vehicle), txt_(d.vehicle_make), txt_(d.vehicle_model),
    txt_(d.vehicle_year), num_(d.vehicle_price), txt_(d.from_partner), txt_(d.attached_officer || d.salesperson),
    txt_(d.can_raise), d.available_contribution === 0 ? 0 : num_(d.available_contribution),
    txt_(d.timeline), txt_(d.repayment_period), txt_(d.income_source), txt_(d.wants_contact),
    txt_(d.contact_time), txt_(d.questions), txt_(d.consent), txt_(d.submission_id), txt_(d.page_url),
    txt_(d.referrer), txt_(d.landed_at), txt_(d.submitted_at_client), txt_(d.user_agent),
    txt_(d.partner_name || d.partner_id)
  ]);
}

function appendTracker_(ss, id, now, d) {
  var sh = ss.getSheetByName(SETTINGS.TRACKER_SHEET);
  var r = sh.getLastRow() + 1;
  var pct = SETTINGS.CONTRIBUTION_PCT / 100;
  var waNum = String(d.phone || '').replace(/\D/g, '');
  var row = [
    id, now, txt_(d.full_name), txt_(d.phone), txt_(d.alt_phone), txt_(d.area),
    txt_(d.vehicle), num_(d.vehicle_price),
    '=IF(H' + r + '="","",H' + r + '*' + pct + ')',
    '=IF(H' + r + '="","",H' + r + '*' + (1 - pct) + ')',
    d.available_contribution === 0 ? 0 : num_(d.available_contribution),
    txt_([d.partner_name || d.partner_id, d.source, d.attached_officer || d.salesperson].filter(String).join(' / ')),
    txt_(d.contact_method), '', 'New Lead', '', 0, '', '', 'No', '', 'Open', '',
    txt_(d.lead_type), txt_(d.contact_time),
    waNum ? '=HYPERLINK("https://wa.me/' + waNum + '","WhatsApp")' : ''
  ];
  sh.getRange(r, 1, 1, row.length).setValues([row]);
  sh.getRange(r, 2).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(r, 8, 1, 4).setNumberFormat('#,##0');
}

function buildLists_(ss) {
  var sh = ss.getSheetByName(SETTINGS.LISTS_SHEET) || ss.insertSheet(SETTINGS.LISTS_SHEET);
  sh.clear();
  var cols = [['Officers'].concat(OFFICERS), ['Lead Status'].concat(STATUSES), ['Final Outcome'].concat(OUTCOMES),
              ['Lost Reason'].concat(LOST_REASONS), ['Contact Method', 'Call', 'WhatsApp', 'Either'], ['Yes/No', 'Yes', 'No']];
  cols.forEach(function (c, i) {
    sh.getRange(1, i + 1, c.length, 1).setValues(c.map(function (v) { return [v]; }));
  });
  styleHeader_(sh, cols.length);
  sh.getRange('A1').setNote('Edit officer names here (add more rows below). Dropdowns in Lead Tracker update automatically.');
}

function buildTrackerRules_(ss) {
  var tr = ss.getSheetByName(SETTINGS.TRACKER_SHEET);
  var lists = ss.getSheetByName(SETTINGS.LISTS_SHEET);
  var max = tr.getMaxRows() - 1;
  function listRule(col) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(lists.getRange(2, col, 200, 1), true).setAllowInvalid(false).build();
  }
  tr.getRange(2, 13, max, 1).setDataValidation(listRule(5)); // M contact method
  tr.getRange(2, 14, max, 1).setDataValidation(listRule(1)); // N officer
  tr.getRange(2, 15, max, 1).setDataValidation(listRule(2)); // O status
  tr.getRange(2, 20, max, 1).setDataValidation(listRule(6)); // T app started
  tr.getRange(2, 22, max, 1).setDataValidation(listRule(3)); // V outcome
  tr.getRange(2, 23, max, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInRange(lists.getRange(2, 4, 200, 1), true).setAllowInvalid(true).build()); // W reason
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  tr.getRange(2, 16, max, 1).setDataValidation(dateRule).setNumberFormat('yyyy-mm-dd');
  tr.getRange(2, 18, max, 1).setDataValidation(dateRule).setNumberFormat('yyyy-mm-dd');

  // Highlight overdue follow-ups and new leads.
  var rules = tr.getConditionalFormatRules().filter(function () { return false; });
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($R2<>"",$R2<TODAY(),$V2="Open")')
    .setBackground('#fde2e1').setRanges([tr.getRange(2, 1, max, TRACKER_HEADERS.length)]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$O2="New Lead"')
    .setBackground('#fdeaea').setRanges([tr.getRange(2, 15, max, 1)]).build());
  tr.setConditionalFormatRules(rules);
}

function buildDashboard_(ss) {
  var sh = ss.getSheetByName(SETTINGS.DASHBOARD_SHEET) || ss.insertSheet(SETTINGS.DASHBOARD_SHEET, 2);
  sh.clear();
  var T = "'" + SETTINGS.TRACKER_SHEET + "'!";
  var contacted = '"Contacted","Interested","Documents Pending","Application Started","Submitted for Assessment","Approved","Awaiting Customer Contribution","Completed","Not Eligible","Lost","Follow-Up Later"';
  var rows = [
    ['Metric', 'Value', 'What it tells management'],
    ['Total Leads', '=COUNTA(' + T + 'A2:A)', 'Total customers captured'],
    ['Leads Contacted', '=SUMPRODUCT(COUNTIF(' + T + 'O2:O,{' + contacted + '}))', 'Leads officers have reached'],
    ['Leads Not Contacted', '=COUNTIF(' + T + 'O2:O,"New Lead")+COUNTIF(' + T + 'O2:O,"Contact Attempted")', 'Work backlog'],
    ['Interested Customers', '=SUMPRODUCT(COUNTIF(' + T + 'O2:O,{"Interested","Documents Pending","Application Started","Submitted for Assessment","Approved","Awaiting Customer Contribution","Completed"}))', 'Genuine prospects'],
    ['Applications Started', '=COUNTIF(' + T + 'T2:T,"Yes")', 'Customers in formal loan processing'],
    ['Applications Submitted', '=COUNTIF(' + T + 'O2:O,"Submitted for Assessment")', 'Awaiting assessment'],
    ['Loans Approved', '=SUMPRODUCT(COUNTIF(' + T + 'O2:O,{"Approved","Awaiting Customer Contribution","Completed"}))', 'Approved customers'],
    ['Vehicles Financed', '=COUNTIF(' + T + 'O2:O,"Completed")', 'Completed financing transactions'],
    ['Total Vehicle Value (UGX)', '=SUMIF(' + T + 'O2:O,"Completed",' + T + 'H2:H)', 'Value of vehicles purchased'],
    ['Total Financing Value (UGX)', '=SUMIF(' + T + 'O2:O,"Completed",' + T + 'J2:J)', 'Amount financed by DEED'],
    ['Conversion Rate', '=IFERROR(B9/B2,0)', 'Leads that became completed transactions'],
    ['Overdue Follow-ups', '=COUNTIFS(' + T + 'R2:R,"<"&TODAY(),' + T + 'V2:V,"Open")', 'Customers past their follow-up date'],
    ['Call-back Requests', '=COUNTIF(' + T + 'X2:X,"Call-back request")', 'People who asked to be called']
  ];
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  styleHeader_(sh, 3);
  sh.getRange('B10:B11').setNumberFormat('#,##0');
  sh.getRange('B12').setNumberFormat('0.0%');
  sh.getRange('A2:A' + rows.length).setFontWeight('bold');

  sh.getRange('E1').setValue('Leads by Source');
  sh.getRange('E2').setFormula('=IFERROR(QUERY(' + T + 'A2:Z,"select L, count(A) where A is not null group by L order by count(A) desc label L \'Source\', count(A) \'Leads\'",0),"No leads yet")');
  sh.getRange('H1').setValue('Leads by Officer');
  sh.getRange('H2').setFormula('=IFERROR(QUERY(' + T + 'A2:Z,"select N, count(A), sum(Q) where A is not null and N is not null group by N label N \'Officer\', count(A) \'Leads\', sum(Q) \'Attempts\'",0),"No assigned leads yet")');
  sh.getRange('L1').setValue('Leads by Status');
  sh.getRange('L2').setFormula('=IFERROR(QUERY(' + T + 'A2:Z,"select O, count(A) where A is not null group by O label O \'Status\', count(A) \'Leads\'",0),"No leads yet")');
  sh.getRange('O1').setValue('Daily Leads');
  sh.getRange('O2').setFormula('=IFERROR(QUERY(' + T + 'A2:Z,"select toDate(B), count(A) where A is not null group by toDate(B) order by toDate(B) label toDate(B) \'Day\', count(A) \'Leads\'",0),"No leads yet")');
  ['E1', 'H1', 'L1', 'O1'].forEach(function (a) { sh.getRange(a).setFontWeight('bold').setFontColor('#282c69'); });
  sh.setColumnWidth(1, 220); sh.setColumnWidth(3, 300);
}

// Recipients = the list the admin keeps in the portal + any fixed NOTIFY_EMAILS. Cached for 5 minutes.
function notifyEmails_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('notify_emails');
  var fromPortal = [];
  if (cached !== null) {
    fromPortal = cached ? cached.split(',') : [];
  } else if (SETTINGS.FIREBASE_PROJECT_ID) {
    try {
      var url = 'https://firestore.googleapis.com/v1/projects/' + SETTINGS.FIREBASE_PROJECT_ID +
        '/databases/(default)/documents/settings/notify';
      var res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        var f = JSON.parse(res.getContentText()).fields || {};
        var vals = (f.emails && f.emails.arrayValue && f.emails.arrayValue.values) || [];
        fromPortal = vals.map(function (v) { return String(v.stringValue || '').trim(); }).filter(String);
        cache.put('notify_emails', fromPortal.join(','), 300);
      } else {
        console.warn('Could not read portal email list: HTTP ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 200));
      }
    } catch (ex) {
      console.warn('Could not read portal email list', ex);
    }
  }
  var all = fromPortal.concat(String(SETTINGS.NOTIFY_EMAILS || '').split(','))
    .map(function (e) { return e.trim().toLowerCase(); })
    .filter(function (e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); });
  return all.filter(function (e, i) { return all.indexOf(e) === i; });
}

function notify_(id, d) {
  var to = notifyEmails_();
  if (!to.length) return;
  try {
    var price = Number(d.vehicle_price) || 0;
    var lines = [
      'New ' + (d.lead_type || 'lead') + ': ' + id,
      '',
      'Name: ' + d.full_name,
      'Phone: ' + d.phone,
      'Contact: ' + (d.contact_method || '-') + ', ' + (d.contact_time || '-'),
      'Area: ' + (d.area || '-'),
      'Vehicle: ' + (d.vehicle || '-') + (price ? ' at UGX ' + price.toLocaleString() : ''),
      'Can raise 30%: ' + (d.can_raise || '-') + (d.available_contribution ? ' (has UGX ' + Number(d.available_contribution).toLocaleString() + ')' : ''),
      'Partner bond: ' + (d.partner_name || d.partner_id || '-'),
      'Officer attached: ' + (d.attached_officer || 'none (a manager will assign it)'),
      d.entered_by ? 'Entered in the portal by: ' + d.entered_by : 'Source: ' + (d.source || 'direct'),
      '',
      'Staff portal: ' + SETTINGS.PORTAL_URL,
      'Lead Tracker sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl()
    ];
    MailApp.sendEmail(to.join(','), 'New vehicle financing lead ' + id + ' · ' + (d.full_name || ''), lines.join('\n'));
  } catch (ex) {
    console.error('Email failed', ex);
  }
}

function toast_(ss, msg) {
  try { ss.toast(msg, 'DEED Campaign', 8); } catch (e) {}
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run from the editor to check the web app path without the website. */
function testSubmission() {
  var res = doPost({ postData: { contents: JSON.stringify({
    lead_type: 'Application', source: 'test', submission_id: 'test-' + Date.now(),
    full_name: 'Test Customer', phone: '+256772000000', contact_method: 'WhatsApp', area: 'Kampala',
    vehicle: 'Toyota Harrier', vehicle_price: 30000000, from_partner: 'Yes', can_raise: 'Partially',
    available_contribution: 7000000, timeline: 'Within 1 month', income_source: 'Employed',
    wants_contact: 'Yes', contact_time: 'Morning', consent: 'Yes'
  }) } });
  console.log(res.getContent());
}

// Run this from the editor to check who gets the new-lead emails (and send them a test).
function testEmail() {
  var to = notifyEmails_();
  console.log('New-lead emails go to: ' + (to.join(', ') || 'nobody yet. Add emails in the portal: Team > New lead emails.'));
  if (to.length) MailApp.sendEmail(to.join(','), 'DEED test: new lead emails work', 'You will get an email like this for every new vehicle financing lead.\n\nStaff portal: ' + SETTINGS.PORTAL_URL);
}
