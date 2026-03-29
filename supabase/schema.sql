-- ============================================================
-- SparkBid Database Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query
-- ============================================================

-- ── 1. Profiles ─────────────────────────────────────────────
-- Extends auth.users with SparkBid-specific data
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('ec', 'gc')),   -- electrician or general contractor
  full_name     TEXT,
  company_name  TEXT,
  license_number TEXT,
  location      TEXT,
  bio           TEXT,
  specialties   TEXT[],                                        -- e.g. ['Commercial Wiring', 'Solar']
  service_radius_miles INT DEFAULT 50,
  avatar_url    TEXT,
  rating        NUMERIC(3,2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  jobs_completed INT DEFAULT 0,
  win_rate      NUMERIC(5,2) DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Projects ──────────────────────────────────────────────
-- Jobs posted by GCs
CREATE TABLE IF NOT EXISTS public.projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gc_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  scope_of_work TEXT,
  location      TEXT NOT NULL,
  project_type  TEXT CHECK (project_type IN ('commercial', 'residential', 'industrial', 'institutional')),
  budget_min    NUMERIC(12,2),
  budget_max    NUMERIC(12,2),
  bid_deadline  DATE,
  square_footage INT,
  stories       INT,
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'awarded', 'closed', 'draft')),
  tags          TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Bids ──────────────────────────────────────────────────
-- Bids submitted by electricians on projects
CREATE TABLE IF NOT EXISTS public.bids (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ec_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL,
  strategy        TEXT CHECK (strategy IN ('aggressive', 'recommended', 'conservative')),

  -- Cost breakdown (AI-generated or manual)
  materials_cost  NUMERIC(12,2),
  labor_cost      NUMERIC(12,2),
  overhead_cost   NUMERIC(12,2),
  profit_margin   NUMERIC(5,2),   -- percentage

  -- AI metadata
  ai_confidence   NUMERIC(5,2),   -- e.g. 87.0
  ai_win_chance   NUMERIC(5,2),   -- e.g. 62.0
  ai_tips         TEXT[],

  cover_note      TEXT,           -- contractor's pitch message
  status          TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'winning', 'outbid', 'awarded', 'declined')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(project_id, ec_id)       -- one bid per electrician per project
);

-- ── 4. Reviews ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES public.projects(id),
  reviewer_id UUID REFERENCES public.profiles(id),  -- GC who wrote the review
  reviewee_id UUID REFERENCES public.profiles(id),  -- EC being reviewed
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews  ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can write
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Projects: anyone can read open projects; GCs manage their own
CREATE POLICY "Open projects are publicly readable"
  ON public.projects FOR SELECT USING (status != 'draft' OR gc_id = auth.uid());

CREATE POLICY "GCs can insert projects"
  ON public.projects FOR INSERT WITH CHECK (auth.uid() = gc_id);

CREATE POLICY "GCs can update their own projects"
  ON public.projects FOR UPDATE USING (auth.uid() = gc_id);

-- Bids: ECs see their own; GCs see bids on their projects
CREATE POLICY "ECs can see their own bids"
  ON public.bids FOR SELECT
  USING (auth.uid() = ec_id);

CREATE POLICY "GCs can see bids on their projects"
  ON public.bids FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = bids.project_id AND p.gc_id = auth.uid()
    )
  );

CREATE POLICY "ECs can submit bids"
  ON public.bids FOR INSERT WITH CHECK (auth.uid() = ec_id);

CREATE POLICY "ECs can update their own bids"
  ON public.bids FOR UPDATE USING (auth.uid() = ec_id);

-- Reviews: publicly readable, reviewer owns insert
CREATE POLICY "Reviews are publicly readable"
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Reviewers can insert reviews"
  ON public.reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

-- ── Auto-create profile on signup ────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'ec')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
