-- ==========================================================================
-- Migration 003: Manga / Manhwa / Manhua tracker
-- A dedicated table because the existing watchlist_items.media_type CHECK
-- constraint only allows ('movie','tv','anime'). This keeps the long-form
-- reading experience (chapters/volumes) cleanly separated from watchlist
-- progress, while sharing the same RLS pattern.
-- Idempotent — safe to re-run.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS public.manga_tracker (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mal_id          INTEGER NOT NULL,
  title           TEXT NOT NULL,
  image_url       TEXT,
  type            TEXT NOT NULL CHECK (type IN ('Manga', 'Manhwa', 'Manhua', 'Light Novel', 'One-shot', 'Doujinshi', 'Novel')),
  status          TEXT NOT NULL DEFAULT 'plan'
                  CHECK (status IN ('plan', 'reading', 'completed', 'dropped')),
  chapters_read   INTEGER CHECK (chapters_read IS NULL OR chapters_read >= 0),
  total_chapters  INTEGER CHECK (total_chapters IS NULL OR total_chapters >= 0),
  volumes_read    INTEGER CHECK (volumes_read IS NULL OR volumes_read >= 0),
  total_volumes   INTEGER CHECK (total_volumes IS NULL OR total_volumes >= 0),
  score           SMALLINT CHECK (score IS NULL OR (score >= 1 AND score <= 10)),
  notes           TEXT,
  started_at      DATE,
  finished_at     DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mal_id)
);

ALTER TABLE public.manga_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tracker entries" ON public.manga_tracker;
DROP POLICY IF EXISTS "Users can insert own tracker"    ON public.manga_tracker;
DROP POLICY IF EXISTS "Users can update own tracker"    ON public.manga_tracker;
DROP POLICY IF EXISTS "Users can delete own tracker"    ON public.manga_tracker;

-- Read access mirrors watchlist_items: profiles are public so other users can
-- see what someone is reading on their public profile. If you later want to
-- restrict, change the SELECT policy to (auth.uid() = user_id).
CREATE POLICY "Anyone can view tracker entries"
  ON public.manga_tracker FOR SELECT USING (true);

CREATE POLICY "Users can insert own tracker"
  ON public.manga_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracker"
  ON public.manga_tracker FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracker"
  ON public.manga_tracker FOR DELETE USING (auth.uid() = user_id);

-- Reuse the shared updated_at trigger function defined in schema.sql
DROP TRIGGER IF EXISTS update_manga_tracker_updated_at ON public.manga_tracker;
CREATE TRIGGER update_manga_tracker_updated_at
  BEFORE UPDATE ON public.manga_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_manga_tracker_user      ON public.manga_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_manga_tracker_status    ON public.manga_tracker(status);
CREATE INDEX IF NOT EXISTS idx_manga_tracker_user_type ON public.manga_tracker(user_id, type);
