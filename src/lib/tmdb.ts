import { MediaResponse, MediaItem, MovieDetails, TVDetails, Genre, TMDBSeasonDetails } from '@/types';
import { cachedFetch } from '@/lib/api-cache';

const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || '';
const IMAGE_BASE = process.env.NEXT_PUBLIC_TMDB_IMAGE_BASE_URL || 'https://image.tmdb.org/t/p';

// Image URL helpers
export const tmdbImage = (path: string | null, size: string = 'w500') => {
  if (!path) return '/images/no-poster.png';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}/${size}${path}`;
};

export const tmdbBackdrop = (path: string | null, size: string = 'w1280') => {
  if (!path) return '/images/no-backdrop.png';
  if (path.startsWith('http')) return path;
  return `${IMAGE_BASE}/${size}${path}`;
};

// Rate limiting: max 40 req/10s for TMDB
let lastTmdbCall = 0;
const TMDB_MIN_INTERVAL = 250; // ms between calls

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = TMDB_MIN_INTERVAL - (now - lastTmdbCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastTmdbCall = Date.now();
  return fetch(url);
}

// Generic fetch with API key
async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const searchParams = new URLSearchParams({ api_key: API_KEY, ...params });
  const res = await rateLimitedFetch(`${BASE_URL}${endpoint}?${searchParams}`);
  if (!res.ok) throw new Error(`TMDB API error: ${res.status}`);
  return res.json();
}

// Trending
export const getTrending = (mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week') =>
  tmdbFetch<MediaResponse>(`/trending/${mediaType}/${timeWindow}`);

// Movies
export const getPopularMovies = (page = 1) =>
  tmdbFetch<MediaResponse>('/movie/popular', { page: String(page) });

export const getTopRatedMovies = (page = 1) =>
  tmdbFetch<MediaResponse>('/movie/top_rated', { page: String(page) });

export const getNowPlayingMovies = (page = 1) =>
  tmdbFetch<MediaResponse>('/movie/now_playing', { page: String(page) });

export const getUpcomingMovies = (page = 1) =>
  tmdbFetch<MediaResponse>('/movie/upcoming', { page: String(page) });

export const getMovieDetails = (id: number) =>
  tmdbFetch<MovieDetails>(`/movie/${id}`, { append_to_response: 'credits,videos,similar' });

// TV Shows
export const getPopularTV = (page = 1) =>
  tmdbFetch<MediaResponse>('/tv/popular', { page: String(page) });

export const getTopRatedTV = (page = 1) =>
  tmdbFetch<MediaResponse>('/tv/top_rated', { page: String(page) });

export const getOnAirTV = (page = 1) =>
  tmdbFetch<MediaResponse>('/tv/on_the_air', { page: String(page) });

export const getTVDetails = (id: number) =>
  tmdbFetch<TVDetails>(`/tv/${id}`, { append_to_response: 'credits,videos,similar' });

// TV Season (with per-episode vote_average) — cached for 1 hour
const SEASON_TTL = 60 * 60 * 1000;
export const getTVSeason = (tvId: number, seasonNumber: number) =>
  cachedFetch<TMDBSeasonDetails>(
    `tmdb_tv_${tvId}_season_${seasonNumber}`,
    () => tmdbFetch<TMDBSeasonDetails>(`/tv/${tvId}/season/${seasonNumber}`),
    SEASON_TTL,
    true,
  );

// Search
export const searchMulti = (query: string, page = 1) =>
  tmdbFetch<MediaResponse>('/search/multi', { query, page: String(page) });

export const searchMovies = (query: string, page = 1) =>
  tmdbFetch<MediaResponse>('/search/movie', { query, page: String(page) });

export const searchTV = (query: string, page = 1) =>
  tmdbFetch<MediaResponse>('/search/tv', { query, page: String(page) });

// Genres
export const getMovieGenres = () =>
  tmdbFetch<{ genres: Genre[] }>('/genre/movie/list');

export const getTVGenres = () =>
  tmdbFetch<{ genres: Genre[] }>('/genre/tv/list');

// Discover with filters
export const discoverMovies = (params: Record<string, string>) =>
  tmdbFetch<MediaResponse>('/discover/movie', params);

export const discoverTV = (params: Record<string, string>) =>
  tmdbFetch<MediaResponse>('/discover/tv', params);

// Person search (for director/actor filtering)
export interface PersonResult {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
}

interface PersonSearchResponse {
  page: number;
  results: PersonResult[];
  total_results: number;
}

export const searchPerson = (query: string) =>
  tmdbFetch<PersonSearchResponse>('/search/person', { query });

export const discoverByPerson = (personId: number, page = 1) => {
  return Promise.all([
    tmdbFetch<MediaResponse>('/discover/movie', { with_cast: String(personId), page: String(page) }).catch(() => ({ results: [] as MediaItem[] })),
    tmdbFetch<MediaResponse>('/discover/movie', { with_crew: String(personId), page: String(page) }).catch(() => ({ results: [] as MediaItem[] })),
    tmdbFetch<MediaResponse>('/discover/tv', { with_cast: String(personId), page: String(page) }).catch(() => ({ results: [] as MediaItem[] })),
  ]).then(([movieCast, movieCrew, tvCast]) => {
    const seen = new Set<string>();
    const all: MediaItem[] = [];
    for (const item of [...movieCast.results, ...movieCrew.results, ...tvCast.results]) {
      const normalized = normalizeMediaItem(item as unknown as Record<string, unknown>, movieCast.results.includes(item) || movieCrew.results.includes(item) ? 'movie' : 'tv');
      const key = `${normalized.media_type}-${normalized.id}`;
      if (!seen.has(key)) { seen.add(key); all.push(normalized); }
    }
    return all;
  });
};

// Normalize TMDB item to our MediaItem type
export const normalizeMediaItem = (item: Record<string, unknown>, type?: 'movie' | 'tv'): MediaItem => ({
  id: item.id as number,
  title: (item.title || item.name || '') as string,
  original_title: (item.original_title || item.original_name || '') as string,
  overview: (item.overview || '') as string,
  poster_path: (item.poster_path || null) as string | null,
  backdrop_path: (item.backdrop_path || null) as string | null,
  release_date: (item.release_date || item.first_air_date || '') as string,
  vote_average: (item.vote_average || 0) as number,
  vote_count: (item.vote_count || 0) as number,
  genre_ids: (item.genre_ids || []) as number[],
  media_type: (type || item.media_type || 'movie') as 'movie' | 'tv',
  popularity: (item.popularity || 0) as number,
});
