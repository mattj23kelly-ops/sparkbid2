# SparkBid — Setup Guide

SparkBid is an AI-powered estimating and bidding workspace for electrical contractors. Upload a blueprint, get a structured take-off and a priced estimate in minutes, then turn that estimate into a bid on a job posted to the marketplace.

Follow these steps in order to get the app running locally and deployed to Vercel.

---

## 1. Install Node.js

If you don't have Node.js installed:

- Download from https://nodejs.org (choose the LTS version).
- Install it, then open a Terminal and confirm it works:
  ```
  node -v
  ```

---

## 2. Create a Supabase project

1. Go to https://supabase.com and sign up for a free account.
2. Click **New Project**, give it a name (e.g. "sparkbid"), choose a region close to you.
3. Save the database password somewhere safe — you won't need it for day-to-day work, but you'll want it eventually.
4. Wait ~1 minute for it to finish provisioning.

---

## 3. Run the database schema

SparkBid ships with four SQL files under `supabase/`. Run them **in order** in the Supabase SQL Editor:

1. `schema.sql` — base tables: profiles, projects, bids, reviews.
2. `schema_v2.sql` — estimator tables: takeoffs, estimates, estimate_line_items, price_catalog, project_files (and seeds a default electrical price catalog).
3. `schema_v3.sql` — license verification fields, admin flag, and the notification log.
4. `schema_v4.sql` — per-user notification preferences (`user_settings` table + trigger to seed defaults on signup).

For each file:

- In your Supabase dashboard, open **SQL Editor → New query**.
- Paste the entire file and click **Run**.
- Confirm "Success" before moving to the next one.

`seed.sql` is optional — it contains example projects you can uncomment and insert once you have a GC account.

---

## 4. Get your Supabase keys

From **Project Settings → API**, copy:

- **Project URL** — `https://xxxx.supabase.co`
- **anon public** key — long string starting with `eyJ…`
- **service_role** key — also starts with `eyJ…`. **Keep this secret** — it bypasses row-level security and is used only in server-side code.

---

## 5. Get an Anthropic API key

The blueprint take-off and estimator routes call Claude. Without a key they'll fail.

1. Sign in at https://console.anthropic.com.
2. Create an API key and copy it (starts with `sk-ant-…`).

---

## 6. Set up Resend (transactional emails)

SparkBid emails GCs when a new bid lands, emails the winning EC when a job is awarded, and emails ECs about license-verification decisions. Those emails go through [Resend](https://resend.com).

1. Create a free Resend account.
2. Verify a sending domain (or use the sandbox domain `onboarding@resend.dev` for local testing).
3. Copy your API key from the dashboard (starts with `re_…`).

If you skip this step, the app still runs — outbound emails just become no-ops and log a warning to the server console.

---

## 7. Configure environment variables

1. In the `sparkbid/` folder, copy `.env.local.example` to a new file called `.env.local`.
2. Fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
   SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
   ANTHROPIC_API_KEY=sk-ant-YOUR_KEY
   RESEND_API_KEY=re_YOUR_KEY
   RESEND_FROM_EMAIL=SparkBid <no-reply@your-verified-domain.com>
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

`NEXT_PUBLIC_APP_URL` is used to build absolute links inside outbound emails — set it to `http://localhost:3000` locally and your real URL in production.

---

## 8. Install dependencies and run

From the `sparkbid/` folder:

```bash
npm install
npm run dev
```

Open **http://localhost:3000** — you should land on the marketing page, with links to sign up and log in.

---

## 9. Make yourself the first admin

The license-verification admin queue lives at `/admin/verifications`. Only users with `is_admin = TRUE` can access it. To promote yourself:

1. Sign up through the app (pick either EC or GC — doesn't matter for admin access).
2. In the Supabase dashboard → **SQL Editor → New query**:
   ```sql
   UPDATE public.profiles SET is_admin = TRUE WHERE id = auth.uid();
   ```
   (Run this while logged into the Supabase dashboard as your own user, or replace `auth.uid()` with your profile's UUID from the `profiles` table.)
3. Reload the app and visit `/admin/verifications` — you should see any pending EC licenses.

To also test the full EC flow as yourself, you can self-approve:
```sql
UPDATE public.profiles
  SET verification_status = 'approved', verified_at = NOW()
  WHERE id = auth.uid();
```

---

## 10. Smoke-test the full loop

1. Sign up as a GC → post a project at `/gc/post`.
2. Sign up (in a different browser) as an EC, submit a license number. Your EC profile lands in `verification_status = 'pending'`.
3. As the admin, visit `/admin/verifications`, approve the EC.
4. As the EC, open `/browse`, find your project, and submit a bid. The GC should receive an email.
5. As the GC, open `/gc/bids/[projectId]`, click **Award job**. The EC should receive an email.

If any email step silently does nothing, check the server logs for a `[email] RESEND_API_KEY missing` warning, and confirm your Resend domain is verified.

---

## 11. Deploy to Vercel

1. Push the `sparkbid/` folder to a Git repo (GitHub, GitLab, Bitbucket).
2. Go to https://vercel.com → **New Project** → import the repo.
3. In the project settings, add the same environment variables from step 7. Update `NEXT_PUBLIC_APP_URL` to your deployed URL (e.g. `https://sparkbid.vercel.app`).
4. Deploy.

### 11a. Supabase auth redirect URLs

Password reset and Google sign-in both redirect back to your app. Supabase needs to know which URLs are allowed:

- In Supabase → **Authentication → URL Configuration**:
  - **Site URL** → set to your production URL (e.g. `https://sparkbid.vercel.app`).
  - **Redirect URLs** → add all of the following, one per line:
    - `http://localhost:3000/**`
    - `https://sparkbid.vercel.app/**` (your production URL)

Without this, password reset emails will send users to the wrong place.

---

## The app at a glance

SparkBid leads with estimating. The flow for an electrician is:

1. **Sign up** and pick "Electrician." License verification is triggered automatically.
2. Land on the **EC dashboard** (`/ec`) — shortcuts to New Estimate, My Estimates, Browse Projects.
3. **New Estimate** (`/estimator`) — upload a blueprint PDF/image, Claude runs a structured take-off, you pick a pricing strategy, you get a line-item estimate.
4. **My Estimates** (`/estimates`) — list of saved estimates.
5. Once your license is approved, browse open projects on the **Marketplace** (`/browse`) and submit a bid at `/bid/[projectId]`.

General contractors get the full posting + bid-management flow at `/gc`, `/gc/post`, `/gc/projects`, and `/gc/bids/[projectId]`.

Admins access the verification queue at `/admin/verifications`.

---

## What's been built

| Area | Status |
|------|--------|
| Landing page (estimator-first) | Done |
| Auth (login, signup with role picker, Google OAuth, forgot + reset password) | Done |
| Electrician dashboard | Done |
| GC dashboard | Done |
| **Estimator — blueprint take-off + line-item pricing** | Done |
| **Estimates list + detail view** | Done |
| Browse projects (marketplace) | Done |
| Project detail | Done |
| AI bid flow | Done |
| Post project (GC) | Done |
| Bid manager (GC) | Done |
| **License verification — DB state, admin queue, RLS gate, pending banner** | Done |
| **Transactional emails — new bid, bid awarded, verification decision (via Resend)** | Done |
| Contractor profile | Done |
| Edit profile | Done |
| Settings | Done |
| Modern SaaS design system (AppShell sidebar, brand palette, utility classes) | Done |

---

## Roadmap

1. **Persist notification preferences** — `/settings` UI exists, wire it to a `user_settings` table so users can opt out of specific emails.
2. **Estimate → PDF export** — one-click, branded with the contractor's company/logo.
3. **Estimate → Bid** — seed a marketplace bid with the line items from a saved estimate.
4. **Price catalog editor** — let each EC tune their own material + labor rates.
5. **Take-off review step** — highlight where numbers came from in the uploaded blueprint.
6. **Team seats** — multiple users per company.
7. **Billing** — Stripe, tiered plans based on estimates per month.

---

## Design system notes

- Brand palette: indigo `brand.50`–`brand.900` (configured in `tailwind.config.js`).
- Layout: `components/ui/AppShell.jsx` provides the persistent left sidebar on desktop and a mobile top-bar + slide-out menu. Every authenticated route group has its own `layout.jsx` that fetches the profile and wraps children in `<AppShell>`.
- Primitives: `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.chip` defined in `app/globals.css`.
- Page titles: use `<PageHeader title="…" subtitle="…" action={…} />`.

---

## Optional: Enable Google Login

1. In Supabase → **Authentication → Providers** → enable **Google**.
2. Follow the instructions to create a Google OAuth app at https://console.cloud.google.com.
3. Add your Supabase callback URL: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`.
