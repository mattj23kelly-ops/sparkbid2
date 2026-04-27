-- ============================================================
-- SparkBid schema v3 — license verification + admin
-- Adds verification state to profiles, admin flag, and an RLS
-- policy letting admins read/update any profile. Safe to re-run.
-- Run AFTER schema.sql and schema_v2.sql.
-- ============================================================

-- ── Add verification + admin columns to profiles ───────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS verified_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_notes  TEXT,
  ADD COLUMN IF NOT EXISTS is_admin            BOOLEAN NOT NULL DEFAULT FALSE;

-- When an EC submits their license number they move to 'pending'.
-- We flip them there from the trigger that creates their profile, but
-- also on any update that sets a license_number for the first time.
CREATE OR REPLACE FUNCTION public.maybe_mark_pending_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only ECs need license verification.
  IF NEW.role = 'ec'
     AND NEW.license_number IS NOT NULL
     AND NEW.license_number <> ''
     AND NEW.verification_status = 'unverified' THEN
    NEW.verification_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_mark_pending ON public.profiles;
CREATE TRIGGER profiles_mark_pending
  BEFORE INSERT OR UPDATE OF license_number, role
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.maybe_mark_pending_verification();

-- ── Admin RLS policies ─────────────────────────────────────
-- Helper: does the caller have the admin flag?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Admins can read any profile (needed for the verification queue)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Admins can update verification fields on any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Helpful index for the admin queue ──────────────────────
CREATE INDEX IF NOT EXISTS profiles_verification_status_idx
  ON public.profiles(verification_status)
  WHERE verification_status IN ('pending', 'rejected');

-- ── Notification log (optional but useful for debugging) ───
CREATE TABLE IF NOT EXISTS public.notification_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          TEXT NOT NULL,          -- 'bid_submitted' | 'bid_awarded' | 'verification_decision'
  recipient_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email TEXT,
  subject       TEXT,
  status        TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error         TEXT,
  payload       JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Only admins read the log; service role bypasses RLS and writes to it.
DROP POLICY IF EXISTS "Admins can read notification log" ON public.notification_log;
CREATE POLICY "Admins can read notification log"
  ON public.notification_log FOR SELECT
  USING (public.is_admin());

-- ── Tighten bids INSERT: require approved verification ──────
-- Replaces the looser policy from schema.sql so an EC with license in
-- 'pending' / 'rejected' cannot submit bids. RLS is the enforcement point;
-- the UI still shows a helpful banner separately.
DROP POLICY IF EXISTS "ECs can submit bids" ON public.bids;
CREATE POLICY "ECs can submit bids"
  ON public.bids FOR INSERT
  WITH CHECK (
    auth.uid() = ec_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'ec'
        AND p.verification_status = 'approved'
    )
  );

-- ── How to make yourself the first admin ────────────────────
-- After signing up, open Supabase SQL editor and run:
--   UPDATE public.profiles SET is_admin = TRUE WHERE id = auth.uid();
-- (or replace auth.uid() with your user's UUID).
--
-- Useful one-liners for testing:
--   -- promote yourself to admin
--   UPDATE public.profiles SET is_admin = TRUE WHERE id = auth.uid();
--   -- approve your own EC profile so you can submit bids as a test user
--   UPDATE public.profiles
--     SET verification_status = 'approved', verified_at = NOW()
--     WHERE id = auth.uid();
