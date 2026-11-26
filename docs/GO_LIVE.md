# Go live (about 30 minutes, once)

Everything below is created **while signed in to DEED's Google account**, so DEED owns the
website, the leads and the staff portal. Staff then sign in to the portal with their own Google accounts.

All of it runs on Firebase's free **Spark** plan: no credit card needed.

When you're done:

- Landing page: `https://<project-id>.web.app/?bond=banda_bond&source=vehicle_sticker`
- Staff portal: `https://<project-id>.web.app/portal/`
- Every push to GitHub updates both automatically.

---

## 1. Create the Firebase project

1. Sign in to Google as **DEED** and open <https://console.firebase.google.com>.
2. **Create a project**. Name: `deed-car-financing`. Note the **Project ID** it shows (it may add a few letters).
3. Google Analytics: off is fine. **Create project**.

## 2. Register the website

1. On the project home page click the **Web** icon (`</>`).
2. Nickname: `DEED campaign`. Tick **Also set up Firebase Hosting**. Click **Register app**.
3. It shows a block of code with `firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ... }`.
   Copy those values into `public/firebase-config.js` (or send them to Claude to do it).
   These values are meant to be public; the data is protected by the security rules.
4. Click through the remaining screens; you don't need to run the commands shown.

## 3. Turn on Google sign-in (for staff)

1. Left menu **Build > Authentication > Get started**.
2. **Sign-in method** tab > **Google** > **Enable**. Choose DEED's email as the support email. **Save**.

## 4. Create the database

1. Left menu **Build > Firestore Database > Create database**.
2. Location: **africa-south1 (Johannesburg)** (closest to Uganda). This can't be changed later.
3. Choose **Start in production mode**. **Create**.

## 5. Set the first admin

Open `firestore.rules` and replace `admin@example.com` with the Google email the admin (Arnold)
will sign in with, in lowercase. Only this email can make itself admin; after that the admin adds
everyone else from the portal's **Team** page.

## 6. Let GitHub publish the site

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts> and pick the project at the top.
2. **Create service account**, name `github-deploy`, **Create and continue**.
3. Add three roles: **Firebase Hosting Admin**, **Firebase Rules Admin**, **API Keys Viewer**. **Done**.
4. Click the account > **Keys** > **Add key > Create new key > JSON**. A file downloads. Keep it private.
5. GitHub repo > **Settings > Secrets and variables > Actions**:
   - **Secrets** tab > **New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = the whole JSON file.
   - **Variables** tab > **New repository variable**: name `FIREBASE_PROJECT_ID`, value = your Project ID.
6. Delete the JSON file from your computer.
7. Put the same Project ID in `.firebaserc`.

## 7. Publish

Commit the changes from steps 2, 5 and 6.7 to `main` (or ask Claude to). Then GitHub > **Actions** >
**Deploy to Firebase Hosting**. When it's green, the site and portal are live.

## 8. First sign-in and setup

1. Open `https://<project-id>.web.app/portal/` and **Continue with Google** with the admin email from step 5.
2. Add your own phone number when the red bar asks. Then **Team**: add the Director, Marketing Managers, Marketing Officers
   and Credit Officers with their Google email and phone number. They can sign in straight away.
3. **Partner bonds**: add **Banda Bond** (link code `banda_bond`) and any others.
4. On each bond click **QR codes**, adjust the placements, and print. Each code carries the bond and the placement,
   so the dashboard shows which bond and which spot brings leads.

## Who can do what

| | Admin | Director | Marketing Manager | Marketing Officer | Credit Officer |
| --- | :-: | :-: | :-: | :-: | :-: |
| See dashboard | All leads | All leads | All leads | All leads | Own leads |
| See leads and notes | All | All | All | All | Only assigned to them |
| Assign / reassign leads | ✓ | | ✓ | | |
| Update status, follow-up, notes | ✓ | | ✓ | | Own leads |
| Export CSV | ✓ | ✓ | ✓ | ✓ | |
| Add staff, change roles | ✓ | | | | |
| Add partner bonds, QR codes | ✓ | | | | |
| Delete a lead | ✓ | | | | |

Every team member must have a Ugandan phone number on the system; the portal and the database both refuse a
staff record without one. After the first admin signs in, the portal asks them to add their own number.

The rules are enforced by the database itself (`firestore.rules`), not just hidden in the screen,
and are covered by automated tests in `tests/`.

## Optional

- **Backup copy in Google Sheets**: see [GOOGLE_SHEET_SETUP.md](GOOGLE_SHEET_SETUP.md). Do it in DEED's account too.
- **Own domain** (e.g. `drive.deedmicrofinance.co.ug`): Firebase console > Hosting > **Add custom domain**, add the two DNS
  records it shows. Then Authentication > Settings > **Authorized domains** > add the same domain so staff sign-in works there.

## Free plan limits

Spark allows 50,000 database reads and 20,000 writes per day, and 10 GB of hosting transfer a month.
A campaign with a few thousand leads and a handful of staff stays well inside that.

## If something fails

- **Deploy job skipped**: the `FIREBASE_PROJECT_ID` variable isn't set.
- **Permission denied in the deploy**: the service account is missing one of the three roles in step 6.3.
- **Form says "No connection"** on the live site: check `public/firebase-config.js` matches the console, and that step 4 was done.
- **"Access needed" after sign-in**: that email isn't in Team yet (or, for the first admin, doesn't match step 5 exactly).
