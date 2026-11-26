# Drive Your Dream. Pay 30%.

Campaign landing page for **DEED Microfinance × partner car bond** vehicle financing.

A visitor at the car bond scans a QR code, sees the 30% / 70% offer, tries the calculator,
applies in about 2 minutes, and lands in a Google Sheet lead tracker for DEED officers to follow up.
Every QR code carries its own `?source=` so each lead shows where it came from.

## What's in it

| Path | What it does |
| --- | --- |
| `public/index.html` | The landing page: hero, how it works, UGX calculator with readiness check, 4-step application form, WhatsApp, call-back request, call, share. |
| `public/config.js` | **The one file to edit**: Google Sheet URL, WhatsApp/phone numbers, partner name, repayment terms. |
| `public/qr.html` | Staff tool: makes printable QR codes, one per placement (`/qr.html` on the live site). |
| `apps-script/Code.gs` | Google Apps Script that writes leads into the Sheet and builds the Lead Tracker and Dashboard. |
| `firebase.json` | Firebase Hosting settings. |
| `.github/workflows/` | Auto-deploy to Firebase on every push; optional GitHub Pages backup. |

No frameworks, no build step. The whole page is under 80 KB before compression.

## Go live checklist

1. **Leads to Google Sheet**: follow [docs/GOOGLE_SHEET_SETUP.md](docs/GOOGLE_SHEET_SETUP.md), then paste the web app URL into `SHEET_ENDPOINT` in `public/config.js`.
2. **Real contact details**: set `WHATSAPP_NUMBER`, `CALL_NUMBER`, `PARTNER_NAME` and `REPAYMENT_OPTIONS` in `public/config.js`.
3. **Hosting**: follow [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md). After that, every push to `main` goes live.
4. **QR codes**: open `https://<your-site>/qr.html`, adjust the placements, print or download each as SVG.
5. **Test**: scan one QR with a phone, submit the form, check the row in the Lead Tracker.

Until `SHEET_ENDPOINT` is set the form runs in **demo mode**: it works but saves nothing, and says so.

## QR source tracking

Every QR points to the same page with a different source, for example:

```
https://<your-site>/?source=main_entrance
https://<your-site>/?source=vehicle_sticker
https://<your-site>/?source=salesperson_01
https://<your-site>/?source=facebook
```

The page stores the source for the visit and sends it with the lead, so the customer never types it.
People who arrive through the share button are tagged `shared`; anyone with no source is `direct`.

## Preview locally

```bash
cd public && python3 -m http.server 8080
# open http://localhost:8080/?source=test
```

## Disclaimers on the page

Figures are an illustrative split of the vehicle price, not a loan quotation. Financing is subject to
DEED's assessment, terms and approval. The consent wording is taken from the campaign plan; have DEED
confirm it matches their privacy policy before launch.
