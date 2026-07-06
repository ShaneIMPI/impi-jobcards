# IMPI Job Cards — Setup Guide

This is Phase 1 of the job card system: the database, and the staff-facing
app for signing in/out of sites with notes. It works offline and syncs
automatically. HR and Admin dashboards are Phase 2 (not built yet).

Follow these steps in order. None of them require you to write code —
you're pasting things into two dashboards (Supabase and GitHub) and
clicking buttons.

## Step 1 — Create the Supabase project

1. Go to https://supabase.com, sign in (or create a free account).
2. Click **New Project**. Name it `impi-jobcards`, choose a strong database
   password (save it somewhere safe — a password manager), pick a region
   close to South Africa (e.g. `eu-west` if there's no `af` region), and
   create it. Wait a minute or two for it to finish provisioning.

## Step 2 — Run the database schema

1. In your new Supabase project, open **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Open the file `supabase/schema.sql` from this project, copy its entire
   contents, and paste into the SQL editor.
4. Click **Run**. You should see "Success. No rows returned."

## Step 3 — Turn on email sign-in

1. Go to **Authentication → Providers**.
2. Make sure **Email** is enabled.
3. Go to **Authentication → Sign In / Providers** settings and, under Email,
   you can leave "Confirm email" on or off — either works fine with magic
   links, but leaving it off makes the first-time login slightly smoother.

## Step 4 — Get your API keys

1. Go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key. You'll need these
   in Step 6. Keep this tab open.

## Step 5 — Push this code to GitHub

1. Create a new repository on GitHub called `impi-jobcards` (or whatever
   you prefer — just remember the name, you'll need it below).
2. Using GitHub's web interface: click **Add file → Upload files**, then
   drag in every file and folder from this project (keeping the folder
   structure intact — `.github/workflows/deploy.yml`, `src/`, `supabase/`,
   `package.json`, `vite.config.js`, `index.html`, `.gitignore`,
   `.env.example`).
3. **Important:** if your repository name is not `impi-jobcards`, open
   `vite.config.js` in GitHub's editor and change every occurrence of
   `/impi-jobcards/` to `/your-actual-repo-name/`.
4. Commit directly to the `main` branch.

## Step 6 — Add your Supabase keys as GitHub secrets

The app needs your Supabase URL and key to run, but we never put these
directly in the code (so they're not visible to the public). Instead:

1. In your GitHub repo, go to **Settings → Secrets and variables →
   Actions**.
2. Click **New repository secret**. Name: `VITE_SUPABASE_URL`. Value:
   the Project URL from Step 4. Save.
3. Click **New repository secret** again. Name: `VITE_SUPABASE_ANON_KEY`.
   Value: the anon public key from Step 4. Save.

## Step 7 — Turn on GitHub Pages

1. In your repo, go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.
3. Go to the **Actions** tab in your repo — you should see a workflow
   run start automatically (triggered by your Step 5 commit). Wait for
   it to finish (green checkmark, a few minutes).
4. Once it's done, go back to **Settings → Pages** — your live URL will
   be shown at the top, something like:
   `https://YOUR-GITHUB-USERNAME.github.io/impi-jobcards/`

## Step 8 — Point Supabase at your live URL

1. Back in Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your GitHub Pages URL from Step 7.
3. Under **Redirect URLs**, add that same URL.
4. Save.

## Step 9 — Add your sites

1. In Supabase, go to **Table Editor → sites**.
2. Click **Insert row** for each site you want in the dropdown, e.g.
   "Menlyn Park Shopping Centre", "Nasonti / Goedehoop Mine". You can add
   more any time — staff can also type a one-off site name if it's not
   in the list yet.

## Step 10 — Make yourself Admin

1. Open the app at your GitHub Pages URL, enter your email, and tap the
   magic link sent to you. This creates your profile automatically
   (as a regular "staff" role for now).
2. Back in Supabase, go to **SQL Editor** and run (replace with your
   real email):
   ```sql
   update profiles set role = 'admin' where email = 'shane@impi-secure.co.za';
   ```
3. Do the same with `role = 'hr'` for your HR contact's email, once
   they've logged in once too.

## You're live

From here, any manager can go to the app URL, sign in with their email,
select a site, tap "Sign in now," and tap "Sign out of this site" when
they leave — with notes in between. It works with no signal and syncs
automatically once back online.

## What's next (Phase 2 — not built yet)

- **HR dashboard**: read-only view of all staff visits for the month.
- **Admin panel**: manage staff list and site list from inside the app
  (right now, adding sites is done via Supabase directly, and role
  changes are done via SQL).
- **Monthly export**: a one-click report generator producing a
  letterheaded Word/PDF document per staff member or consolidated,
  ready to email to HR — following the same document pipeline used for
  your other IMPI reports.

Let me know when you're ready for Phase 2 and we'll build it the same way.
