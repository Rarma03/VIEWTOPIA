-- Migration 004 — allow `manga` in activities.media_type so completing a
-- manga / manhwa / manhua entry logs to the activity feed alongside watched
-- movies / TV / anime.

ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_media_type_check;

ALTER TABLE public.activities
  ADD  CONSTRAINT activities_media_type_check
       CHECK (media_type IN ('movie', 'tv', 'anime', 'manga'));
