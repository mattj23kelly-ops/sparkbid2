-- ============================================================
-- SparkBid schema v2 — additive migration
-- Adds: takeoffs, estimates, estimate_line_items, price_catalog,
--       project_files. Safe to run on top of schema.sql.
-- Run in Supabase → SQL Editor → New Query → Run.
-- ============================================================

-- ── 1. Takeoffs ─────────────────────────────────────────────
-- AI-extracted structured quantities from a blueprint.
-- Not every take-off becomes an estimate — e.g. an EC may upload
-- a plan to "just see what's in it" before deciding to bid.
CREATE TABLE IF NOT EXISTS public.takeoffs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,  -- optional link

  source_file_name TEXT,                    -- e.g. "3rd-floor-plans.pdf"
  source_file_path TEXT,                    -- supabase storage path

  -- Project context extracted by AI
  title           TEXT,
  location        TEXT,
  project_type    TEXT CHECK (project_type IN ('commercial', 'residential', 'industrial', 'institutional')),
  square_footage  INT,
  stories         INT,
  scope_summary   TEXT,

  -- Structured quantities. Stored as JSONB so the shape can evolve.
  -- Expected shape:
  -- {
  --   "devices":    [ { "type": "Duplex Receptacle",    "count": 42,  "notes": "…" }, … ],
  --   "fixtures":   [ { "type": "2x4 LED Troffer",      "count": 18,  "notes": "…" }, … ],
  --   "panels":     [ { "name": "PP-1", "amps": 200, "phases": 3, "spaces": 42, "notes": "…" }, … ],
  --   "conduit":    [ { "type": "EMT 3/4\"",            "feet": 800 }, … ],
  --   "wire":       [ { "type": "#12 THHN CU",          "feet": 3000 }, … ],
  --   "systems":    [ "Fire Alarm", "Data", "CCTV" ],
  --   "assumptions":[ "Ceiling height 10'",              "Existing panel remains" ]
  -- }
  quantities      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_confidence   NUMERIC(5,2),              -- overall confidence 0-100
  ai_model        TEXT,                      -- e.g. "claude-sonnet-4-6"
  ai_notes        TEXT,                      -- caveats / things the AI flagged

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Price catalog ─────────────────────────────────────────
-- Per-user electrical price book. Seeded with industry defaults
-- when a new user signs up (see price_catalog_seed function below).
CREATE TABLE IF NOT EXISTS public.price_catalog (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES public.profiles(id) ON DELETE CASCADE,  -- null = global defaults

  category        TEXT NOT NULL CHECK (category IN ('device', 'fixture', 'panel', 'conduit', 'wire', 'labor', 'other')),
  item_key        TEXT NOT NULL,            -- canonical key, e.g. "duplex-receptacle-120v"
  display_name    TEXT NOT NULL,            -- "Duplex Receptacle 120V"
  unit            TEXT NOT NULL,            -- "ea", "ft", "hr"
  material_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,  -- per unit
  labor_hours     NUMERIC(6,2) NOT NULL DEFAULT 0,   -- per unit
  notes           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(owner_id, item_key)
);

-- ── 3. Estimates ────────────────────────────────────────────
-- The priced output of a take-off.
CREATE TABLE IF NOT EXISTS public.estimates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  takeoff_id      UUID REFERENCES public.takeoffs(id) ON DELETE SET NULL,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,  -- if linked to a posted project

  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'sent', 'won', 'lost', 'archived')),

  -- Rollups (denormalized for fast display — recomputed whenever line items change)
  materials_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_hours     NUMERIC(10,2) NOT NULL DEFAULT 0,
  labor_rate      NUMERIC(8,2)  NOT NULL DEFAULT 95,     -- $/hr, loaded rate
  labor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  overhead_pct    NUMERIC(5,2)  NOT NULL DEFAULT 12,
  overhead_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_pct      NUMERIC(5,2)  NOT NULL DEFAULT 10,
  profit_total    NUMERIC(12,2) NOT NULL DEFAULT 0,
  contingency_pct NUMERIC(5,2)  NOT NULL DEFAULT 5,
  contingency_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total     NUMERIC(12,2) NOT NULL DEFAULT 0,

  assumptions     TEXT[],
  exclusions      TEXT[],
  notes           TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Estimate line items ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.estimate_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id     UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,

  category        TEXT NOT NULL,
  item_key        TEXT,                      -- nullable — user can add custom rows
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit            TEXT NOT NULL DEFAULT 'ea',
  material_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,   -- per unit
  labor_hours     NUMERIC(6,2)  NOT NULL DEFAULT 0,   -- per unit
  line_material   NUMERIC(12,2) NOT NULL DEFAULT 0,   -- quantity * material_cost
  line_labor_hrs  NUMERIC(10,2) NOT NULL DEFAULT 0,   -- quantity * labor_hours
  sort_order      INT NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS estimate_line_items_estimate_id_idx
  ON public.estimate_line_items(estimate_id);

-- ── 5. Project files ────────────────────────────────────────
-- Uploaded plans, specs, addenda. Stored in Supabase storage bucket "project-files".
CREATE TABLE IF NOT EXISTS public.project_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id      UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  takeoff_id      UUID REFERENCES public.takeoffs(id) ON DELETE CASCADE,

  kind            TEXT NOT NULL DEFAULT 'plan' CHECK (kind IN ('plan', 'spec', 'addendum', 'other')),
  file_name       TEXT NOT NULL,
  file_path       TEXT NOT NULL,             -- storage path
  mime_type       TEXT,
  size_bytes      BIGINT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Row Level Security ─────────────────────────────────────
ALTER TABLE public.takeoffs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_catalog       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files       ENABLE ROW LEVEL SECURITY;

-- Takeoffs: owner-only
CREATE POLICY "Users can manage their own takeoffs"
  ON public.takeoffs FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Estimates: owner-only (GCs receiving them see via bids table flow later)
CREATE POLICY "Users can manage their own estimates"
  ON public.estimates FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Line items: owner of parent estimate
CREATE POLICY "Users can manage their own line items"
  ON public.estimate_line_items FOR ALL
  USING (EXISTS (SELECT 1 FROM public.estimates e
                 WHERE e.id = estimate_line_items.estimate_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.estimates e
                      WHERE e.id = estimate_line_items.estimate_id AND e.owner_id = auth.uid()));

-- Price catalog: users see global defaults + their own
CREATE POLICY "Users can see global defaults + their own catalog"
  ON public.price_catalog FOR SELECT
  USING (owner_id IS NULL OR owner_id = auth.uid());

CREATE POLICY "Users can insert their own catalog entries"
  ON public.price_catalog FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own catalog entries"
  ON public.price_catalog FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Users can delete their own catalog entries"
  ON public.price_catalog FOR DELETE
  USING (owner_id = auth.uid());

-- Project files: owner-only
CREATE POLICY "Users can manage their own files"
  ON public.project_files FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ── Seed: global default electrical price catalog ────────────
-- Conservative US-average unit pricing as of 2024. ECs override per-user.
INSERT INTO public.price_catalog (owner_id, category, item_key, display_name, unit, material_cost, labor_hours)
VALUES
  -- Devices
  (NULL, 'device',  'duplex-receptacle-120v',   'Duplex Receptacle 120V',      'ea',   3.50, 0.45),
  (NULL, 'device',  'gfci-receptacle',          'GFCI Receptacle',             'ea',  17.00, 0.60),
  (NULL, 'device',  'quad-receptacle-120v',     'Quad Receptacle 120V',        'ea',   9.50, 0.60),
  (NULL, 'device',  'single-pole-switch',       'Single-Pole Switch',          'ea',   2.80, 0.35),
  (NULL, 'device',  'three-way-switch',         '3-Way Switch',                'ea',   5.20, 0.45),
  (NULL, 'device',  'dimmer-switch',            'Dimmer Switch',               'ea',  22.00, 0.50),
  (NULL, 'device',  'occupancy-sensor',         'Occupancy Sensor',            'ea',  48.00, 0.75),
  (NULL, 'device',  'data-drop-cat6',           'Cat6 Data Drop',              'ea',  12.00, 0.85),
  (NULL, 'device',  'smoke-detector-120v',      'Hardwired Smoke Detector',    'ea',  28.00, 0.60),
  -- Fixtures
  (NULL, 'fixture', 'led-2x4-troffer',          'LED 2x4 Troffer',             'ea',  78.00, 1.20),
  (NULL, 'fixture', 'led-2x2-troffer',          'LED 2x2 Troffer',             'ea',  62.00, 1.10),
  (NULL, 'fixture', 'led-highbay',              'LED High-Bay Fixture',        'ea', 165.00, 1.80),
  (NULL, 'fixture', 'led-downlight-6in',        '6" LED Downlight',            'ea',  18.00, 0.75),
  (NULL, 'fixture', 'led-strip-4ft',            '4ft LED Strip',               'ea',  42.00, 0.90),
  (NULL, 'fixture', 'exit-sign-combo',          'Exit/Emergency Combo',        'ea',  85.00, 1.00),
  (NULL, 'fixture', 'exterior-wallpack',        'Exterior LED Wall Pack',      'ea', 135.00, 1.50),
  -- Panels / gear
  (NULL, 'panel',   'panel-100a-main',          '100A Main Panel',             'ea', 185.00, 5.00),
  (NULL, 'panel',   'panel-200a-main',          '200A Main Panel',             'ea', 320.00, 7.00),
  (NULL, 'panel',   'panel-400a-main',          '400A Main Panel',             'ea', 680.00, 9.00),
  (NULL, 'panel',   'subpanel-100a',            '100A Subpanel',               'ea', 145.00, 3.50),
  (NULL, 'panel',   'breaker-20a-1p',           '20A 1-Pole Breaker',          'ea',  11.00, 0.15),
  (NULL, 'panel',   'breaker-20a-2p',           '20A 2-Pole Breaker',          'ea',  24.00, 0.20),
  -- Conduit & raceway
  (NULL, 'conduit', 'emt-1/2',                  'EMT 1/2"',                    'ft',   0.95, 0.04),
  (NULL, 'conduit', 'emt-3/4',                  'EMT 3/4"',                    'ft',   1.25, 0.05),
  (NULL, 'conduit', 'emt-1',                    'EMT 1"',                      'ft',   1.85, 0.06),
  (NULL, 'conduit', 'pvc-1/2',                  'PVC 1/2"',                    'ft',   0.60, 0.04),
  (NULL, 'conduit', 'flex-1/2',                 'Flex 1/2"',                   'ft',   0.80, 0.05),
  (NULL, 'conduit', 'mc-cable-12-2',            'MC Cable #12-2',              'ft',   1.40, 0.04),
  -- Wire
  (NULL, 'wire',    'thhn-12-cu',               '#12 THHN CU',                 'ft',   0.38, 0.015),
  (NULL, 'wire',    'thhn-10-cu',               '#10 THHN CU',                 'ft',   0.58, 0.018),
  (NULL, 'wire',    'thhn-8-cu',                '#8 THHN CU',                  'ft',   1.05, 0.022),
  (NULL, 'wire',    'thhn-6-cu',                '#6 THHN CU',                  'ft',   1.60, 0.028),
  (NULL, 'wire',    'thhn-2-cu',                '#2 THHN CU',                  'ft',   3.20, 0.04),
  (NULL, 'wire',    'thhn-4/0-cu',              '#4/0 THHN CU',                'ft',   8.50, 0.07),
  (NULL, 'wire',    'romex-12-2',               'Romex #12-2 NM-B',            'ft',   0.85, 0.02)
ON CONFLICT (owner_id, item_key) DO NOTHING;

-- ── Auto-update timestamps ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS takeoffs_touch   ON public.takeoffs;
DROP TRIGGER IF EXISTS estimates_touch  ON public.estimates;
DROP TRIGGER IF EXISTS catalog_touch    ON public.price_catalog;
CREATE TRIGGER takeoffs_touch   BEFORE UPDATE ON public.takeoffs        FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER estimates_touch  BEFORE UPDATE ON public.estimates       FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER catalog_touch    BEFORE UPDATE ON public.price_catalog   FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
