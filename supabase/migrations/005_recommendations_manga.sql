-- Migration 005 — allow `manga` in recommendations.media_type so users can
-- recommend a manga / manhwa / manhua title alongside movies / TV / anime.

ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_media_type_check;

ALTER TABLE public.recommendations
  ADD  CONSTRAINT recommendations_media_type_check
       CHECK (media_type IN ('movie', 'tv', 'anime', 'manga'));
