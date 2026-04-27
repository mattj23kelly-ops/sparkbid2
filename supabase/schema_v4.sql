-- ============================================================
-- SparkBid schema v4 — user notification settings
-- Adds a per-user notification preferences table, RLS so users
-- only read/update their own row, and a trigger that seeds a
-- default row whenever a new profile is created.
-- Safe to re-run.
-- Run AFTER schema.sql, schema_v2.sql, schema_v3.sql.
-- ============================================================

-- ── user_settings ──────────────────────────────────────────
-- One row per user. If a row is missing we treat every toggle
-- as "on" (matches the default checkboxes on /settings).
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id         UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- EC toggles
  new_projects    BOOLEAN NOT NULL DEFAULT TRUE,  -- new matching projects posted
  bid_updates     BOOLEAN NOT NULL DEFAULT TRUE,  -- bid-awarded / outbid

  -- GC toggles
  new_bids        BOOLEAN NOT NULL DEFAULT TRUE,  -- bid-submitted
  bid_deadline    BOOLEAN NOT NULL DEFAULT TRUE,  -- 24h deadline reminders

  -- Shared toggles
  messages        BOOLEAN NOT NULL DEFAULT TRUE,  -- platform messages
  marketing       BOOLEAN NOT NULL DEFAULT FALSE, -- tips & product updates

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own settings" ON public.user_settings;
CREATE POLICY "Users read their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users upsert their own settings" ON public.user_settings;
CREATE POLICY "Users upsert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own settings" ON public.user_settings;
CREATE POLICY "Users update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can read any settings row (for debugging only, not required)
DROP POLICY IF EXISTS "Admins read any settings" ON public.user_settings;
CREATE POLICY "Admins read any settings"
  ON public.user_settings FOR SELECT
  USING (public.is_admin());

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_settings_touch_updated_at ON public.user_settings;
CREATE TRIGGER user_settings_touch_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_settings_updated_at();

-- Seed a default row whenever a new profile is created.
CREATE OR REPLACE FUNCTION public.seed_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS profiles_seed_user_settings ON public.profiles;
CREATE TRIGGER profiles_seed_user_settings
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_user_settings();

-- Back-fill: make sure every existing profile has a settings row.
INSERT INTO public.user_settings (user_id)
  SELECT id FROM public.profiles
  ON CONFLICT (user_id) DO NOTHING;

-- ── Widen notification_log.status to allow 'skipped' ───────
-- We now log when a user has opted out, so the constraint must include it.
ALTER TABLE public.notification_log
  DROP CONSTRAINT IF EXISTS notification_log_status_check;

ALTER TABLE public.notification_log
  ADD CONSTRAINT notification_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped'));
