/**
 * ─── Mood Mode Decision Engine ──────────────────────────────────────────
 *
 * Translates a few mood sliders into a single actionable pick.
 *
 * The algorithm:
 *   1. Map sliders/chips to TMDB discover filters.
 *   2. Pull candidates from THREE pools in parallel:
 *        a. The user's own watchlist  (highest priority — they already wanted it)
 *        b. TMDB /discover            (broad fallback)
 *        c. Friends' top-rated items  (social signal)
 *   3. Dedupe + score every candidate.
 *   4. Return the top N (for "try another").
 *
 * The engine has zero UI concerns — it's pure functions + API calls — so it
 * can be unit-tested in isolation.
 */

import type { MediaItem, MediaType, WatchlistItem } from '@/types';
import { discoverMovies, discoverTV, normalizeMediaItem, getMovieDetails, getTVDetails } from '@/lib/tmdb';
import { getWatchlist, getFriends, getRatings } from '@/lib/store';
import { GENRE_MAP } from '@/lib/constants';

// ─── Public types ──────────────────────────────────────────────────────────

export type Vibe = 'funny' | 'dark' | 'cozy' | 'romantic' | 'epic' | 'weird';

export interface MoodInput {
  /** 0 = chill, 100 = intense */
  energy: number;
  /** 0 = popcorn, 100 = thinky */
  brain: number;
  /** Approx. time budget in minutes. */
  timeMinutes: 30 | 60 | 120 | 180;
  /** Optional vibe chips. */
  vibes: Vibe[];
  /** When false, anime is excluded (currently always false; reserved for future toggle). */
  includeAnime?: boolean;
}

export interface MoodPick {
  item: MediaItem;
  score: number;
  reasons: string[];
  source: 'watchlist' | 'discover' | 'friends';
}

export const VIBE_LABELS: Record<Vibe, string> = {
  funny: 'Funny',
  dark: 'Dark',
  cozy: 'Cozy',
  romantic: 'Romantic',
  epic: 'Epic',
  weird: 'Weird',
};

// ─── Constants ─────────────────────────────────────────────────────────────

/** TMDB genre IDs we care about. Unioned with the existing GENRE_MAP. */
const GENRE = {
  ACTION: 28,
  ADVENTURE: 12,
  ANIMATION: 16,
  COMEDY: 35,
  CRIME: 80,
  DOCUMENTARY: 99,
  DRAMA: 18,
  FAMILY: 10751,
  FANTASY: 14,
  HORROR: 27,
  MYSTERY: 9648,
  ROMANCE: 10749,
  SCI_FI: 878,
  THRILLER: 53,
  WAR: 10752,
  // TV-only equivalents
  TV_ACTION_ADVENTURE: 10759,
  TV_SCI_FI_FANTASY: 10765,
} as const;

const VIBE_GENRES: Record<Vibe, number[]> = {
  funny:    [GENRE.COMEDY, GENRE.FAMILY],
  dark:     [GENRE.CRIME, GENRE.THRILLER, GENRE.HORROR, GENRE.MYSTERY],
  cozy:     [GENRE.FAMILY, GENRE.ROMANCE, GENRE.COMEDY, GENRE.ANIMATION],
  romantic: [GENRE.ROMANCE, GENRE.DRAMA],
  epic:     [GENRE.ADVENTURE, GENRE.FANTASY, GENRE.WAR, GENRE.ACTION],
  weird:    [GENRE.SCI_FI, GENRE.FANTASY, GENRE.MYSTERY],
};

// ─── Filter mapping ────────────────────────────────────────────────────────

interface MoodFilters {
  /** TMDB genre IDs the candidate should include. */
  withGenres: number[];
  /** TMDB genre IDs the candidate should NOT include. */
  withoutGenres: number[];
  /** Maximum runtime in minutes (movies only). */
  runtimeLte?: number;
  /** Minimum runtime in minutes (movies only). */
  runtimeGte?: number;
  /** Quality floor. */
  voteAverageGte: number;
  /** Mainstream-ness floor — keeps obscure/under-rated items out. */
  voteCountGte: number;
  /** When true, the time budget rules out feature-length movies — prefer TV episodes. */
  preferEpisodes: boolean;
}

export function buildFilters(input: MoodInput): MoodFilters {
  const withGenres = new Set<number>();
  const withoutGenres = new Set<number>();

  // ── Energy axis ──
  if (input.energy < 35) {
    withGenres.add(GENRE.DRAMA);
    withGenres.add(GENRE.COMEDY);
    withGenres.add(GENRE.ROMANCE);
    withGenres.add(GENRE.DOCUMENTARY);
    withoutGenres.add(GENRE.HORROR);
    withoutGenres.add(GENRE.WAR);
  } else if (input.energy > 65) {
    withGenres.add(GENRE.ACTION);
    withGenres.add(GENRE.THRILLER);
    withGenres.add(GENRE.HORROR);
    withGenres.add(GENRE.ADVENTURE);
    withoutGenres.add(GENRE.DOCUMENTARY);
    withoutGenres.add(GENRE.ROMANCE);
  }

  // ── Brain axis ──
  if (input.brain < 35) {
    // popcorn — broad appeal, lots of votes
    withGenres.add(GENRE.COMEDY);
    withGenres.add(GENRE.ACTION);
    withGenres.add(GENRE.ANIMATION);
  } else if (input.brain > 65) {
    // thinky — drama/mystery/sci-fi with quality floor
    withGenres.add(GENRE.DRAMA);
    withGenres.add(GENRE.MYSTERY);
    withGenres.add(GENRE.SCI_FI);
    withGenres.add(GENRE.DOCUMENTARY);
  }

  // ── Vibes (additive) ──
  for (const vibe of input.vibes) {
    for (const g of VIBE_GENRES[vibe]) withGenres.add(g);
  }

  // ── Time budget ──
  let runtimeLte: number | undefined;
  let runtimeGte: number | undefined;
  let preferEpisodes = false;
  switch (input.timeMinutes) {
    case 30:  preferEpisodes = true;  runtimeLte = 45;  break;
    case 60:  preferEpisodes = true;  runtimeLte = 70;  break;
    case 120: runtimeGte = 80; runtimeLte = 140; break;
    case 180: runtimeGte = 130; break;
  }

  return {
    withGenres: [...withGenres],
    withoutGenres: [...withoutGenres],
    runtimeLte,
    runtimeGte,
    voteAverageGte: input.brain > 65 ? 7 : 6,
    voteCountGte:   input.brain < 35 ? 500 : 100,
    preferEpisodes,
  };
}

// ─── Candidate fetchers ────────────────────────────────────────────────────

function genreOverlap(itemGenreIds: number[], filterGenreIds: number[]): number {
  if (!itemGenreIds?.length || !filterGenreIds.length) return 0;
  const set = new Set(filterGenreIds);
  let n = 0;
  for (const g of itemGenreIds) if (set.has(g)) n++;
  return n;
}

function itemMatchesFilters(item: MediaItem, filters: MoodFilters): boolean {
  // Reject explicitly-excluded genres.
  if (filters.withoutGenres.length > 0 && genreOverlap(item.genre_ids, filters.withoutGenres) > 0) {
    return false;
  }
  // Quality floor (be lenient — watchlist items shouldn't be filtered out for quality).
  if (item.vote_average > 0 && item.vote_average < filters.voteAverageGte - 1) return false;
  return true;
}

async function getWatchlistCandidates(
  userId: string,
  filters: MoodFilters
): Promise<{ item: MediaItem; original: WatchlistItem }[]> {
  const list = await getWatchlist(userId);
  // Only "want to watch" — already-watched items aren't useful suggestions.
  const eligible = list.filter((i) => i.status === 'watchlist' || i.status === 'watching');

  return eligible
    .map((wl) => ({
      original: wl,
      item: watchlistToMediaItem(wl),
    }))
    .filter(({ item }) => itemMatchesFilters(item, filters));
}

function watchlistToMediaItem(wl: WatchlistItem): MediaItem {
  return {
    id: wl.media_id,
    title: wl.title,
    overview: '',
    poster_path: wl.poster_path,
    backdrop_path: null,
    release_date: '',
    vote_average: 0,
    vote_count: 0,
    // Watchlist rows don't carry genre IDs — pass empty so genre filters skip them.
    genre_ids: [],
    media_type: wl.media_type,
    popularity: 0,
    original_language: wl.original_language ?? undefined,
  };
}

async function getDiscoverCandidates(filters: MoodFilters): Promise<MediaItem[]> {
  const baseParams: Record<string, string> = {
    sort_by: 'popularity.desc',
    'vote_average.gte': String(filters.voteAverageGte),
    'vote_count.gte': String(filters.voteCountGte),
    include_adult: 'false',
    page: '1',
  };
  if (filters.withGenres.length > 0) {
    baseParams.with_genres = filters.withGenres.join('|'); // OR
  }
  if (filters.withoutGenres.length > 0) {
    baseParams.without_genres = filters.withoutGenres.join(',');
  }

  // Movies pull
  const movieParams = { ...baseParams };
  if (filters.runtimeLte !== undefined) movieParams['with_runtime.lte'] = String(filters.runtimeLte);
  if (filters.runtimeGte !== undefined) movieParams['with_runtime.gte'] = String(filters.runtimeGte);

  // TV pull (translate movie genre ids → TV equivalents where needed)
  const tvParams = { ...baseParams };
  if (filters.withGenres.length > 0) {
    const tvGenres = filters.withGenres.map((g) => {
      if (g === GENRE.ACTION || g === GENRE.ADVENTURE) return GENRE.TV_ACTION_ADVENTURE;
      if (g === GENRE.SCI_FI || g === GENRE.FANTASY) return GENRE.TV_SCI_FI_FANTASY;
      return g;
    });
    tvParams.with_genres = [...new Set(tvGenres)].join('|');
  }

  const wantsMovie = !filters.preferEpisodes;
  const [movieRes, tvRes] = await Promise.all([
    wantsMovie
      ? discoverMovies(movieParams).catch(() => ({ results: [] as MediaItem[] }))
      : Promise.resolve({ results: [] as MediaItem[] }),
    discoverTV(tvParams).catch(() => ({ results: [] as MediaItem[] })),
  ]);

  const movies = (movieRes.results ?? [])
    .map((m) => normalizeMediaItem(m as unknown as Record<string, unknown>, 'movie'));
  const tv = (tvRes.results ?? [])
    .map((t) => normalizeMediaItem(t as unknown as Record<string, unknown>, 'tv'));

  return [...movies, ...tv];
}

async function getFriendCandidates(
  userId: string,
  filters: MoodFilters
): Promise<{ item: MediaItem; friendAvg: number; friendCount: number }[]> {
  const friendIds = await getFriends(userId);
  if (friendIds.length === 0) return [];

  // Pull each friend's top-rated picks in parallel (capped to keep things snappy).
  const friendIdsCapped = friendIds.slice(0, 10);
  const allRatings = (
    await Promise.all(
      friendIdsCapped.map((fid) => getRatings({ userId: fid }).catch(() => []))
    )
  ).flat();

  // Aggregate by media key: average rating + count.
  const byKey = new Map<string, { sum: number; count: number; sample: { mediaId: number; mediaType: MediaType; title?: string; poster?: string | null } }>();
  for (const r of allRatings) {
    if (r.rating < 8) continue; // friends-loved bar
    const key = `${r.media_type}:${r.media_id}`;
    const cur = byKey.get(key) ?? { sum: 0, count: 0, sample: { mediaId: r.media_id, mediaType: r.media_type } };
    cur.sum += r.rating;
    cur.count += 1;
    byKey.set(key, cur);
  }

  // Hydrate top friend picks with TMDB details (skip anime — Jikan is rate-limited
  // and friend-anime support can come later).
  const top = [...byKey.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].sum / b[1].count - a[1].sum / a[1].count)
    .slice(0, 10);

  const hydrated = await Promise.all(
    top.map(async ([, agg]) => {
      try {
        if (agg.sample.mediaType === 'movie') {
          const d = await getMovieDetails(agg.sample.mediaId);
          return { item: normalizeMediaItem(d as unknown as Record<string, unknown>, 'movie'), friendAvg: agg.sum / agg.count, friendCount: agg.count };
        }
        if (agg.sample.mediaType === 'tv') {
          const d = await getTVDetails(agg.sample.mediaId);
          return { item: normalizeMediaItem(d as unknown as Record<string, unknown>, 'tv'), friendAvg: agg.sum / agg.count, friendCount: agg.count };
        }
      } catch {
        return null;
      }
      return null;
    })
  );

  return hydrated
    .filter((x): x is { item: MediaItem; friendAvg: number; friendCount: number } => x !== null)
    .filter((x) => itemMatchesFilters(x.item, filters));
}

// ─── Scoring ───────────────────────────────────────────────────────────────

interface ScoreContext {
  input: MoodInput;
  filters: MoodFilters;
  watchlistKeys: Set<string>;
  friendByKey: Map<string, { avg: number; count: number }>;
}

function keyOf(i: MediaItem): string { return `${i.media_type}:${i.id}`; }

function scoreItem(item: MediaItem, ctx: ScoreContext): MoodPick {
  const reasons: string[] = [];
  let score = 0;
  const k = keyOf(item);

  // ── Source bonuses ──
  let source: MoodPick['source'] = 'discover';
  if (ctx.watchlistKeys.has(k)) {
    score += 40;
    source = 'watchlist';
    reasons.push('On your watchlist');
  }
  const friend = ctx.friendByKey.get(k);
  if (friend) {
    score += Math.min(20, friend.count * 5 + (friend.avg - 7) * 2);
    if (source === 'discover') source = 'friends';
    reasons.push(`${friend.count} friend${friend.count === 1 ? '' : 's'} rated it ${friend.avg.toFixed(1)}★`);
  }

  // ── Genre alignment ──
  const overlap = genreOverlap(item.genre_ids, ctx.filters.withGenres);
  score += Math.min(overlap * 5, 20);
  if (overlap > 0 && source === 'discover') {
    const matched = item.genre_ids.filter((g) => ctx.filters.withGenres.includes(g)).slice(0, 2);
    const names = matched.map((g) => GENRE_MAP[g]).filter(Boolean);
    if (names.length > 0) reasons.push(`Matches: ${names.join(', ')}`);
  }

  // ── Quality / popularity ──
  score += Math.min(item.vote_average * 2, 20);
  if (item.vote_average >= 8) reasons.push(`Highly rated (${item.vote_average.toFixed(1)}★)`);

  // ── Mood-specific narration ──
  if (ctx.input.energy < 35) reasons.push('Easy on the energy');
  else if (ctx.input.energy > 65) reasons.push('High-octane pick');
  if (ctx.input.brain > 65 && item.vote_average >= 7) reasons.push('Worth your full attention');

  // ── Tiebreaker so the same input doesn't always serve the same pick ──
  score += Math.random() * 8;

  // Keep reasons concise.
  const uniqueReasons = [...new Set(reasons)].slice(0, 3);

  return { item, score, reasons: uniqueReasons, source };
}

// ─── Main entry point ─────────────────────────────────────────────────────

export interface PickForMoodOptions {
  /** Skip the friend pool (faster — useful for un-authed users). */
  skipFriends?: boolean;
  /** How many ranked picks to return. The UI uses these for "try another". */
  limit?: number;
}

export async function pickForMood(
  input: MoodInput,
  userId: string | null,
  options: PickForMoodOptions = {}
): Promise<MoodPick[]> {
  const { skipFriends = false, limit = 12 } = options;
  const filters = buildFilters(input);

  const [watchlistPool, discoverPool, friendPool] = await Promise.all([
    userId ? getWatchlistCandidates(userId, filters) : Promise.resolve([]),
    getDiscoverCandidates(filters),
    userId && !skipFriends ? getFriendCandidates(userId, filters) : Promise.resolve([]),
  ]);

  // Build lookup sets for the scorer.
  const watchlistKeys = new Set(watchlistPool.map((w) => keyOf(w.item)));
  const friendByKey = new Map<string, { avg: number; count: number }>();
  for (const f of friendPool) friendByKey.set(keyOf(f.item), { avg: f.friendAvg, count: f.friendCount });

  // Merge & dedupe (watchlist first so its hydration wins).
  const merged: MediaItem[] = [];
  const seen = new Set<string>();
  const push = (i: MediaItem) => {
    const k = keyOf(i);
    if (seen.has(k)) return;
    seen.add(k);
    merged.push(i);
  };
  for (const w of watchlistPool) push(w.item);
  for (const f of friendPool) push(f.item);
  for (const d of discoverPool) push(d);

  if (merged.length === 0) return [];

  const ctx: ScoreContext = { input, filters, watchlistKeys, friendByKey };
  return merged
    .map((item) => scoreItem(item, ctx))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
