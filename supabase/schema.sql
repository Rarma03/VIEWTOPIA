-- ==========================================================================
-- TrackFlix - Supabase Database Schema (idempotent)
-- Safe to re-run on a database that already has these objects.
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- Profiles (extends auth.users)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  city TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT false,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Backfill columns for older installs
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==========================================
-- Watchlist Items
-- ==========================================
CREATE TABLE IF NOT EXISTS public.watchlist_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
  title TEXT NOT NULL,
  poster_path TEXT,
  status TEXT NOT NULL DEFAULT 'watchlist' CHECK (status IN ('watchlist', 'watching', 'watched', 'dropped')),
  watched_date DATE,
  notes TEXT,
  last_watched_season INTEGER,
  last_watched_episode INTEGER,
  original_language TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, media_id, media_type)
);

ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

-- Backfill columns on databases that pre-date the per-episode progress feature.
ALTER TABLE public.watchlist_items ADD COLUMN IF NOT EXISTS last_watched_season INTEGER;
ALTER TABLE public.watchlist_items ADD COLUMN IF NOT EXISTS last_watched_episode INTEGER;
ALTER TABLE public.watchlist_items ADD COLUMN IF NOT EXISTS original_language TEXT;

DROP POLICY IF EXISTS "Users can view all watchlist items" ON public.watchlist_items;
DROP POLICY IF EXISTS "Users can insert own items"         ON public.watchlist_items;
DROP POLICY IF EXISTS "Users can update own items"         ON public.watchlist_items;
DROP POLICY IF EXISTS "Users can delete own items"         ON public.watchlist_items;

CREATE POLICY "Users can view all watchlist items"
  ON public.watchlist_items FOR SELECT USING (true);
CREATE POLICY "Users can insert own items"
  ON public.watchlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own items"
  ON public.watchlist_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own items"
  ON public.watchlist_items FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Ratings
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 10),
  review TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, media_id, media_type)
);

ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all ratings"  ON public.ratings;
DROP POLICY IF EXISTS "Users can insert own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can update own ratings" ON public.ratings;
DROP POLICY IF EXISTS "Users can delete own ratings" ON public.ratings;

CREATE POLICY "Users can view all ratings"
  ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can insert own ratings"
  ON public.ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings"
  ON public.ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings"
  ON public.ratings FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Recommendations
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
  title TEXT NOT NULL,
  poster_path TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Users can insert own recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Users can delete own recommendations" ON public.recommendations;

CREATE POLICY "Users can view all recommendations"
  ON public.recommendations FOR SELECT USING (true);
CREATE POLICY "Users can insert own recommendations"
  ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own recommendations"
  ON public.recommendations FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Activity Log
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('watched', 'rated', 'added_to_watchlist', 'recommended', 'reviewed')),
  media_id INTEGER NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
  media_title TEXT NOT NULL,
  media_poster TEXT,
  rating SMALLINT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all activities"  ON public.activities;
DROP POLICY IF EXISTS "Users can insert own activities" ON public.activities;

CREATE POLICY "Users can view all activities"
  ON public.activities FOR SELECT USING (true);
CREATE POLICY "Users can insert own activities"
  ON public.activities FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- Watch Party Messages (live chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.party_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  party_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT 'Anonymous',
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE public.party_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view party messages"   ON public.party_messages;
DROP POLICY IF EXISTS "Anyone can insert party messages" ON public.party_messages;

CREATE POLICY "Anyone can view party messages"
  ON public.party_messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert party messages"
  ON public.party_messages FOR INSERT WITH CHECK (true);

-- ==========================================
-- Functions & Triggers
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, display_name, avatar_url, onboarded)
  VALUES (
    NEW.id,
    NEW.email,
    NULL,
    COALESCE(NEW.raw_user_meta_data->>'full_name',
             NEW.raw_user_meta_data->>'name',
             split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at  ON public.profiles;
DROP TRIGGER IF EXISTS update_watchlist_updated_at ON public.watchlist_items;
DROP TRIGGER IF EXISTS update_ratings_updated_at   ON public.ratings;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_watchlist_updated_at
  BEFORE UPDATE ON public.watchlist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ratings_updated_at
  BEFORE UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ==========================================
-- Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_watchlist_user        ON public.watchlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_status      ON public.watchlist_items(status);
CREATE INDEX IF NOT EXISTS idx_ratings_user          ON public.ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_media         ON public.ratings(media_id, media_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_user  ON public.recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_user       ON public.activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created    ON public.activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_party_messages_party  ON public.party_messages(party_id, created_at);

-- ==========================================
-- Collections (premium-only feature)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.collections (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  is_public   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view public collections" ON public.collections;
DROP POLICY IF EXISTS "Users can insert own collections"   ON public.collections;
DROP POLICY IF EXISTS "Users can update own collections"   ON public.collections;
DROP POLICY IF EXISTS "Users can delete own collections"   ON public.collections;

CREATE POLICY "Anyone can view public collections"
  ON public.collections FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can insert own collections"
  ON public.collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections"
  ON public.collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections"
  ON public.collections FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.collection_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid        NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  media_id      bigint      NOT NULL,
  media_type    text        NOT NULL CHECK (media_type IN ('movie','tv','anime')),
  title         text        NOT NULL,
  poster_path   text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, media_id, media_type)
);

ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View items of viewable collections" ON public.collection_items;
DROP POLICY IF EXISTS "Owner can insert collection items"  ON public.collection_items;
DROP POLICY IF EXISTS "Owner can delete collection items"  ON public.collection_items;

CREATE POLICY "View items of viewable collections"
  ON public.collection_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id
        AND (c.is_public = true OR c.user_id = auth.uid())
    )
  );
CREATE POLICY "Owner can insert collection items"
  ON public.collection_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "Owner can delete collection items"
  ON public.collection_items FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.collections c
      WHERE c.id = collection_items.collection_id AND c.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_collections_updated_at ON public.collections;
CREATE TRIGGER update_collections_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_collections_user      ON public.collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_col  ON public.collection_items(collection_id);

-- ==========================================
-- Friendships (friend requests + accepted friends)
-- ==========================================
-- Each pending/accepted relationship is one row. requester_id is the
-- person who sent the request; addressee_id is the recipient. Once accepted
-- both sides see each other as friends. We enforce uniqueness on the
-- unordered pair via a generated column so (a -> b) and (b -> a) collide.
CREATE TABLE IF NOT EXISTS public.friendships (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id),
  -- Order-independent uniqueness: store the smaller id first in the pair.
  pair_low      uuid GENERATED ALWAYS AS (LEAST(requester_id, addressee_id)) STORED,
  pair_high     uuid GENERATED ALWAYS AS (GREATEST(requester_id, addressee_id)) STORED,
  UNIQUE (pair_low, pair_high)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their friendships"   ON public.friendships;
DROP POLICY IF EXISTS "Users can send friend requests"     ON public.friendships;
DROP POLICY IF EXISTS "Users can update their friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete their friendships" ON public.friendships;

-- Either party can read the row.
CREATE POLICY "Users can view their friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Only the requester may create a row, and only as themselves.
CREATE POLICY "Users can send friend requests"
  ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Either party may update (accept / reject / re-pending).
CREATE POLICY "Users can update their friendships"
  ON public.friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Either party may unfriend / cancel.
CREATE POLICY "Users can delete their friendships"
  ON public.friendships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP TRIGGER IF EXISTS update_friendships_updated_at ON public.friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status    ON public.friendships(status);



-- ==========================================
-- Manga / Manhwa / Manhua Tracker
-- See migrations/003_manga_tracker.sql for full details.
-- ==========================================
CREATE TABLE IF NOT EXISTS public.manga_tracker (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mal_id          INTEGER NOT NULL,
  title           TEXT NOT NULL,
  image_url       TEXT,
  type            TEXT NOT NULL CHECK (type IN ('Manga','Manhwa','Manhua','Light Novel','One-shot','Doujinshi','Novel')),
  status          TEXT NOT NULL DEFAULT 'plan' CHECK (status IN ('plan','reading','completed','dropped')),
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

CREATE POLICY "Anyone can view tracker entries" ON public.manga_tracker FOR SELECT USING (true);
CREATE POLICY "Users can insert own tracker"    ON public.manga_tracker FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracker"    ON public.manga_tracker FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracker"    ON public.manga_tracker FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_manga_tracker_updated_at ON public.manga_tracker;
CREATE TRIGGER update_manga_tracker_updated_at
  BEFORE UPDATE ON public.manga_tracker
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_manga_tracker_user      ON public.manga_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_manga_tracker_status    ON public.manga_tracker(status);
CREATE INDEX IF NOT EXISTS idx_manga_tracker_user_type ON public.manga_tracker(user_id, type);

-- Migration 005 inlined for canonical schema: widen recommendations.media_type to include 'manga'.
ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_media_type_check;
ALTER TABLE public.recommendations
  ADD  CONSTRAINT recommendations_media_type_check
       CHECK (media_type IN ('movie', 'tv', 'anime', 'manga'));
