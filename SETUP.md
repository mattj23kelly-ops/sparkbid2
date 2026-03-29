# SparkBid — Setup Guide

Follow these steps in order to get the app running locally.

---

## Step 1 — Install Node.js

If you don't have Node.js installed:
- Download from https://nodejs.org (choose the LTS version)
- Install it, then open a Terminal and confirm it works:
  ```
  node -v
  ```

---

## Step 2 — Create a Supabase project

1. Go to https://supabase.com and sign up for a free account
2. Click **New Project**, give it a name (e.g. "sparkbid"), choose a region close to you
3. Wait ~1 minute for it to be ready

---

## Step 3 — Run the database schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase/schema.sql` from this folder
4. Copy all the contents and paste into the SQL editor
5. Click **Run** — you should see "Success" messages

---

## Step 4 — Get your API keys

1. In Supabase dashboard → **Project Settings** → **API**
2. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 5 — Configure environment variables

1. In the `sparkbid/` folder, copy `.env.local.example` to a new file called `.env.local`
2. Fill in your values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
   ```

---

## Step 6 — Install dependencies and run

Open Terminal, navigate to the `sparkbid/` folder, then:

```bash
npm install
npm run dev
```

Open your browser to **http://localhost:3000** — you should see the SparkBid landing page!

---

## What's been built so far

| Screen | Status |
|--------|--------|
| Landing page | ✅ Done |
| Login | ✅ Done |
| Signup (3-step with role selection) | ✅ Done |
| Electrician Dashboard | ✅ Done |
| GC Dashboard | ✅ Done |
| Browse Projects | ✅ Done |
| Project Detail | 🔜 Next |
| AI Bid Flow | 🔜 Next |
| Post Project (GC) | 🔜 Next |
| Bid Manager (GC) | 🔜 Next |
| Contractor Profile | 🔜 Next |
| Settings | 🔜 Next |

---

## Next steps (in order)

1. **Post Project page** (`/gc/post`) — GC creates a job
2. **Project Detail page** (`/project/[id]`) — view full project info
3. **AI Bid Flow** (`/bid/[projectId]`) — the core feature!
4. **Bid Manager** (`/gc/bids/[projectId]`) — GC reviews + awards bids

---

## Optional: Enable Google Login

1. In Supabase → **Authentication** → **Providers** → enable **Google**
2. Follow the instructions to create a Google OAuth app at https://console.cloud.google.com
3. Add your Supabase callback URL: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
