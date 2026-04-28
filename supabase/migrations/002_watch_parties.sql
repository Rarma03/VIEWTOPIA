-- ==========================================================================
-- Migration 002: Watch Parties (event + members)
-- The chat messages table (`party_messages`) already exists from schema.sql.
-- Run in the Supabase SQL editor. Idempotent.
-- ==========================================================================

-- 1. Watch party event ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_parties (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  movie_id     INTEGER NOT NULL,
  movie_title  TEXT NOT NULL,
  poster_path  TEXT,
  creator_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city         TEXT NOT NULL,
  theater      TEXT,
  event_date   DATE NOT NULL,
  event_time   TIME,
  max_members  INTEGER NOT NULL DEFAULT 10 CHECK (max_members BETWEEN 2 AND 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_watch_parties_date ON public.watch_parties(event_date);
CREATE INDEX IF NOT EXISTS idx_watch_parties_city ON public.watch_parties(lower(city));

ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view parties"          ON public.watch_parties;
DROP POLICY IF EXISTS "Users can create parties"         ON public.watch_parties;
DROP POLICY IF EXISTS "Creators can update their parties" ON public.watch_parties;
DROP POLICY IF EXISTS "Creators can delete their parties" ON public.watch_parties;

CREATE POLICY "Anyone can view parties"
  ON public.watch_parties FOR SELECT USING (true);
CREATE POLICY "Users can create parties"
  ON public.watch_parties FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators can update their parties"
  ON public.watch_parties FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete their parties"
  ON public.watch_parties FOR DELETE USING (auth.uid() = creator_id);

-- 2. Membership table -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_party_members (
  party_id  UUID NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_watch_party_members_user ON public.watch_party_members(user_id);

ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view party members"    ON public.watch_party_members;
DROP POLICY IF EXISTS "Users can join parties"           ON public.watch_party_members;
DROP POLICY IF EXISTS "Users can leave parties"          ON public.watch_party_members;

CREATE POLICY "Anyone can view party members"
  ON public.watch_party_members FOR SELECT USING (true);
CREATE POLICY "Users can join parties"
  ON public.watch_party_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave parties"
  ON public.watch_party_members FOR DELETE USING (auth.uid() = user_id);

-- 3. Auto-add creator as a member when a party is created -----------------------
CREATE OR REPLACE FUNCTION public.handle_new_watch_party()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.watch_party_members (party_id, user_id)
  VALUES (NEW.id, NEW.creator_id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_watch_party_created ON public.watch_parties;
CREATE TRIGGER on_watch_party_created
  AFTER INSERT ON public.watch_parties
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_watch_party();
