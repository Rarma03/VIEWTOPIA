/**
 * Universe-total counts for the LeetCode-style profile rings.
 *
 * "How many movies / TV shows / anime exist that are worth tracking?"
 *
 * - Movies / TV: queried from TMDB `/discover` with a `vote_count >= 50`
 *   quality floor so the denominator stays in a meaningful range (tens of
 *   thousands instead of TMDB's full ~900k mostly-obscure catalog).
 * - Anime: queried from Jikan `/anime` (MAL has ~28k titles).
 *
 * Results are cached in `localStorage` for 24h to avoid hammering either API.
 * On any failure we fall back to last-known sane defaults so the UI never
 * shows `/0`.
 */

import { discoverMovies, discoverTV } from '@/lib/tmdb';

export interface UniverseTotals {
  movieTotal: number;
  movieHollywood: number;
  movieBollywood: number;
  movieOther: number;
  tvTotal: number;
  animeTotal: number;
}

const CACHE_KEY = 'mat:universe-totals:v1';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

// Sane fallbacks (rough orders of magnitude as of ~2024) so the UI is usable
// even when TMDB / Jikan are unreachable.
const FALLBACK: UniverseTotals = {
  movieTotal: 65000,
  movieHollywood: 38000,
  movieBollywood: 4500,
  movieOther: 22500,
  tvTotal: 22000,
  animeTotal: 28000,
};

const VOTE_FLOOR = '50'; // ignore films almost no one has rated

interface CacheEntry { data: UniverseTotals; ts: number }

function readCache(): UniverseTotals | null {
  if (typeof globalThis === 'undefined' || typeof globalThis.localStorage === 'undefined') return null;
  try {
    const raw = globalThis.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CacheEntry = JSON.parse(raw);
    if (Date.now() - parsed.ts > CACHE_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: UniverseTotals): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.localStorage === 'undefined') return;
  try {
    globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() } satisfies CacheEntry));
  } catch {
    /* quota / private mode — silently ignore */
  }
}

/**
 * Best-effort fetch of the universe-total counts. Always resolves: never
 * rejects, never throws. Falls back to the last good cache, then to FALLBACK.
 */
export async function getUniverseTotals(): Promise<UniverseTotals> {
  const cached = readCache();
  if (cached) return cached;

  // Fire all five queries in parallel. Any individual failure resolves to a
  // sentinel (-1) which is replaced by the FALLBACK value below.
  const safeMovieCount = async (params: Record<string, string>): Promise<number> => {
    try {
      const r = await discoverMovies({ ...params, 'vote_count.gte': VOTE_FLOOR, page: '1' });
      return r.total_results ?? -1;
    } catch {
      return -1;
    }
  };
  const safeTVCount = async (params: Record<string, string>): Promise<number> => {
    try {
      const r = await discoverTV({ ...params, 'vote_count.gte': VOTE_FLOOR, page: '1' });
      return r.total_results ?? -1;
    } catch {
      return -1;
    }
  };
  const safeAnimeCount = async (): Promise<number> => {
    try {
      // Jikan returns pagination.items.total
      const res = await fetch('https://api.jikan.moe/v4/anime?limit=1&page=1');
      if (!res.ok) return -1;
      const json = await res.json();
      const t = json?.pagination?.items?.total;
      return typeof t === 'number' ? t : -1;
    } catch {
      return -1;
    }
  };

  const [allMovies, hollywood, bollywood, tv, anime] = await Promise.all([
    safeMovieCount({}),
    safeMovieCount({ with_original_language: 'en' }),
    safeMovieCount({ with_original_language: 'hi' }),
    safeTVCount({}),
    safeAnimeCount(),
  ]);

  const totals: UniverseTotals = {
    movieTotal: allMovies > 0 ? allMovies : FALLBACK.movieTotal,
    movieHollywood: hollywood > 0 ? hollywood : FALLBACK.movieHollywood,
    movieBollywood: bollywood > 0 ? bollywood : FALLBACK.movieBollywood,
    // "Other" = total − Hollywood − Bollywood (clamped at 0).
    movieOther: 0,
    tvTotal: tv > 0 ? tv : FALLBACK.tvTotal,
    animeTotal: anime > 0 ? anime : FALLBACK.animeTotal,
  };
  totals.movieOther = Math.max(totals.movieTotal - totals.movieHollywood - totals.movieBollywood, FALLBACK.movieOther);

  writeCache(totals);
  return totals;
}
