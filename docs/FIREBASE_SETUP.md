# Put the page live on Firebase (free)

Firebase Hosting's free **Spark** plan is enough for this campaign: free HTTPS, a free
`https://<project>.web.app` address, and pages served from Google's global network.
No credit card is needed for Hosting.

Once this is set up, **every change pushed to GitHub goes live automatically** within about a minute.

You do this once. It takes about 10 minutes.

---

## Step 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and sign in with the Google account DEED will own the site with.
2. Click **Create a project**. Name it `deed-car-financing` (Firebase may add a few letters to make it unique; note the final **Project ID**).
3. Google Analytics: you can turn it off. Click **Create project**.
4. In the left menu open **Build > Hosting** and click **Get started**. Click **Next** through the screens (you don't need to run the commands it shows).

## Step 2. Give GitHub permission to deploy

This creates a "deploy key" that GitHub uses to publish the site. Browser only, nothing to install.

1. Open <https://console.cloud.google.com/iam-admin/serviceaccounts> and pick your Firebase project at the top.
2. **Create service account**. Name: `github-deploy`. Click **Create and continue**.
3. Add these roles: **Firebase Hosting Admin** and **API Keys Viewer**. Click **Done**.
4. Click the new account > **Keys** tab > **Add key > Create new key > JSON**. A file downloads. Keep it private; never put it in the repo.
5. In GitHub open the repo > **Settings > Secrets and variables > Actions**, **Secrets** tab >
   **New repository secret**: name `FIREBASE_SERVICE_ACCOUNT`, value = paste the whole contents of the JSON file.
6. Delete the downloaded JSON file from your computer.

## Step 3. Tell GitHub which project to deploy to

GitHub repo > **Settings > Secrets and variables > Actions > Variables** tab > **New repository variable**:

- Name: `FIREBASE_PROJECT_ID`
- Value: your Project ID from step 1 (e.g. `deed-car-financing`)

Also update `.firebaserc` in the repo to the same Project ID if it differs.

## Step 4. Deploy

GitHub > **Actions** tab > **Deploy to Firebase Hosting** > **Run workflow**. When it's green, open
`https://<your-project-id>.web.app`.

From now on every push to `main` redeploys.

## Optional: your own domain

Firebase console > Hosting > **Add custom domain** (e.g. `drive.deedmicrofinance.co.ug`). It shows
two DNS records to add at your domain provider. HTTPS is set up for free.

## If something fails

- **Job skipped**: the `FIREBASE_PROJECT_ID` variable isn't set (step 3).
- **Permission denied / 403**: the service account is missing a role. Add **Firebase Hosting Admin**
  again, and if it still fails, also add **Cloud Run Viewer** and **Firebase Authentication Admin**.
- **Project not found**: the Project ID is misspelled.
