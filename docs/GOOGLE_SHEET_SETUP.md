# Optional: backup copy of leads in a Google Sheet

The staff portal is where leads are worked. If DEED also wants a spreadsheet copy of every submission,
this small Google Apps Script (free) writes each one into a Google Sheet with the same lead ID as the portal.
If Firebase isn't set up, the Sheet works on its own as the lead tracker. The script is in `apps-script/Code.gs`.

Do this **signed in to DEED's Google account** so the Sheet belongs to DEED.

It creates:

| Tab | What it is |
| --- | --- |
| **Raw Submissions** | Exact record of every submission. Don't edit or delete rows. |
| **Lead Tracker** | Officers' working sheet: columns A–W from the campaign plan, with Lead ID (`VFC-2026-0001`), 30%/70% formulas, dropdowns for officer, status, outcome, and a WhatsApp link. Overdue follow-ups turn red. |
| **Campaign Dashboard** | Totals, contacted, interested, approved, financed, values, conversion rate, overdue follow-ups, plus leads by source, officer, status and day. |
| **Lists** | Officer names and dropdown options. Edit officer names here. |

## Setup (about 10 minutes)

1. Signed in as DEED, create a new Google Sheet: <https://sheets.new>
2. Menu **Extensions > Apps Script**. Delete what's there and paste the full contents of `apps-script/Code.gs`.
3. Who gets new-lead emails is set in the portal (see "New lead emails" below).
4. Click **Save**, choose `setup` in the function dropdown, click **Run**. Approve the permissions
   (Google shows "unverified app" because it's your own script: **Advanced > Go to project**).
5. Click **Deploy > New deployment**, gear icon > **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends in `/exec`).
6. In the repo, open `public/config.js` and paste that URL into `SHEET_ENDPOINT`. Commit. The site redeploys.
7. Test: submit the form on the live page. A row should appear in both Raw Submissions and Lead Tracker.

"Anyone" access only lets people *send* a lead to the script. Nobody can read the sheet unless you share it.

## New lead emails (managed in the portal)

The admin chooses who gets an email for every new lead in the portal: **Team > New lead emails**.
The script reads that list from Firebase, so it needs two things once:

1. The Google account that owns the sheet (DEED) has access to the Firebase project: Firebase console >
   gear icon > **Users and permissions** > **Add member** > DEED's email, role **Owner** (or Editor).
2. The script has the right permissions: Apps Script > **Project Settings** (gear) > tick
   **Show "appsscript.json" manifest file in editor**. Back in the editor, open `appsscript.json` and replace it
   with the contents of `apps-script/appsscript.json`. **Save**.

Then choose `testEmail` in the function dropdown and click **Run** (approve the new permissions). It prints who gets
the emails and sends them a test. Finally publish the new version (below).

## Changing the script later

After editing the code: **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**.
The URL stays the same.

## Notes

- Lead IDs come from a counter in the script, so they never change when rows are sorted.
- Text that looks like a formula is stored as plain text, so the form can't inject formulas.
- Retries of the same submission are ignored (de-duplicated by submission ID).
- Bots that fill the hidden honeypot field are silently dropped by the page.
- Officer privacy: everyone with access to the sheet sees all leads. For per-officer access, the
  next step in the plan is an AppSheet app on top of this same sheet.
