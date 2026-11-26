# Drive Your Dream. Pay 30%.

Campaign landing page for **DEED Microfinance × partner car bond** vehicle financing.

A visitor at the car bond scans a QR code, sees the 30% / 70% offer, tries the calculator,
applies in about 2 minutes, and lands in a Google Sheet lead tracker for DEED officers to follow up.
Every QR code carries its own `?source=` so each lead shows where it came from.

## What's in it

| Path | What it does |
| --- | --- |
| `public/index.html` | Landing page: hero, how it works, UGX calculator with readiness check, 4-step application, WhatsApp, call-back, call, share. |
| `public/portal/` | **Staff portal** (`/portal/`): Google sign-in, dashboard, leads, assignment, follow-ups and notes, team roles, partner bonds with printable QR codes, CSV export. |
| `firestore.rules` | Who can see and change what for each role. Tested in `tests/` (52 checks). |
| `public/config.js` | Contact numbers, partner bond names, lead prefix, repayment terms. |
| `public/firebase-config.js` | Firebase web app settings. Empty = preview mode with sample data. |
| `apps-script/Code.gs` | Optional backup copy of every lead into a DEED Google Sheet. |
| `firebase.json`, `.github/workflows/` | Hosting settings and auto-deploy on every push. |

No frameworks and no build step. Firebase's code loads only when needed, so the landing page stays fast.

## Roles

- **Admin**: everything, plus adds staff and partner bonds.
- **Director**: sees all leads and the dashboard (view only).
- **Marketing Manager**: sees all leads and assigns them to credit officers.
- **Marketing Officer**: sees all leads and the dashboard (view only).
- **Credit Officer**: sees only the leads assigned to them; calls, WhatsApps, logs attempts, updates status and follow-ups.

Every staff member must have a phone number on the system.

## Go live

Follow [docs/GO_LIVE.md](docs/GO_LIVE.md). Everything is created in **DEED's Google account**, so DEED owns the data.
Until then, open `/portal/` to preview it with sample data, and the landing page form runs in demo mode.

## QR source tracking

Every QR points to the same page with the partner bond and the placement, for example:

```
https://<your-site>/?bond=banda_bond&source=main_entrance
https://<your-site>/?bond=banda_bond&source=vehicle_sticker
https://<your-site>/?bond=banda_bond&source=salesperson_01
https://<your-site>/?source=facebook
```

Make and print them from the portal: **Partner bonds > QR codes**.

The page stores the bond and source for the visit and sends them with the lead, so the customer never types it.
People who arrive through the share button are tagged `shared`; anyone with no source is `direct`.

## Preview locally

```bash
cd public && python3 -m http.server 8080
# landing page: http://localhost:8080/?bond=banda_bond&source=test
# portal preview: http://localhost:8080/portal/
```

## Disclaimers on the page

Figures are an illustrative split of the vehicle price, not a loan quotation. Financing is subject to
DEED's assessment, terms and approval. The consent wording is taken from the campaign plan; have DEED
confirm it matches their privacy policy before launch.
