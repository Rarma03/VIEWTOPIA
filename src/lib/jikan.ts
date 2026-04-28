import { AnimeItem, MangaItem, JikanResponse, JikanEpisode } from '@/types';
import { cachedFetch } from '@/lib/api-cache';

const BASE_URL = process.env.NEXT_PUBLIC_JIKAN_BASE_URL || 'https://api.jikan.moe/v4';

// Rate limit: 3 req/s, 60 req/min — add small delay helper
let lastRequest = 0;
async function rateLimitedFetch<T>(url: string): Promise<T> {
  const now = Date.now();
  const timeSinceLastReq = now - lastRequest;
  if (timeSinceLastReq < 350) {
    await new Promise((resolve) => setTimeout(resolve, 350 - timeSinceLastReq));
  }
  lastRequest = Date.now();

  const res = await fetch(url);
  if (res.status === 429) {
    // Rate limited — wait and retry once
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const retryRes = await fetch(url);
    if (!retryRes.ok) throw new Error(`Jikan API error: ${retryRes.status}`);
    return retryRes.json();
  }
  if (!res.ok) throw new Error(`Jikan API error: ${res.status}`);
  return res.json();
}

// Top anime
export const getTopAnime = (page = 1, filter?: 'airing' | 'upcoming' | 'bypopularity' | 'favorite') => {
  const params = new URLSearchParams({ page: String(page) });
  if (filter) params.set('filter', filter);
  return rateLimitedFetch<JikanResponse<AnimeItem[]>>(`${BASE_URL}/top/anime?${params}`);
};

// Seasonal anime
export const getSeasonalAnime = (year?: number, season?: string, page = 1) => {
  if (year && season) {
    return rateLimitedFetch<JikanResponse<AnimeItem[]>>(`${BASE_URL}/seasons/${year}/${season}?page=${page}`);
  }
  return rateLimitedFetch<JikanResponse<AnimeItem[]>>(`${BASE_URL}/seasons/now?page=${page}`);
};

// Search anime
export const searchAnime = (query: string, page = 1) =>
  rateLimitedFetch<JikanResponse<AnimeItem[]>>(`${BASE_URL}/anime?q=${encodeURIComponent(query)}&page=${page}`);

// Anime details
export const getAnimeDetails = (id: number) =>
  rateLimitedFetch<JikanResponse<AnimeItem>>(`${BASE_URL}/anime/${id}/full`);

// Anime characters
export const getAnimeCharacters = (id: number) =>
  rateLimitedFetch<JikanResponse<unknown[]>>(`${BASE_URL}/anime/${id}/characters`);

// Anime recommendations
export const getAnimeRecommendations = (id: number) =>
  rateLimitedFetch<JikanResponse<unknown[]>>(`${BASE_URL}/anime/${id}/recommendations`);

// Anime episodes — paginates through all pages, caches the full list for 1h.
const EPISODES_TTL = 60 * 60 * 1000;
export const getAnimeEpisodes = (id: number) =>
  cachedFetch<JikanEpisode[]>(
    `jikan_anime_${id}_episodes`,
    async () => {
      const all: JikanEpisode[] = [];
      let page = 1;
      // Hard cap to avoid runaway loops on bad data
      while (page <= 20) {
        const res = await rateLimitedFetch<JikanResponse<JikanEpisode[]> & { pagination?: { has_next_page?: boolean } }>(
          `${BASE_URL}/anime/${id}/episodes?page=${page}`,
        );
        if (Array.isArray(res.data)) all.push(...res.data);
        if (!res.pagination?.has_next_page) break;
        page += 1;
      }
      return all;
    },
    EPISODES_TTL,
    true,
  );

// Anime image helper
export const jikanImage = (anime: AnimeItem, size: 'small' | 'default' | 'large' = 'default') => {
  if (!anime.images?.jpg) return '/images/no-poster.png';
  switch (size) {
    case 'small': return anime.images.jpg.small_image_url || anime.images.jpg.image_url;
    case 'large': return anime.images.jpg.large_image_url || anime.images.jpg.image_url;
    default: return anime.images.jpg.image_url;
  }
};

// ============================================
// Manga / Manhwa / Manhua API
// ============================================

export type MangaType = 'manga' | 'manhwa' | 'manhua' | 'lightnovel' | 'oneshot' | 'doujin';

// Top manga (optionally filtered by type)
export const getTopManga = (page = 1, type?: MangaType, filter?: 'publishing' | 'upcoming' | 'bypopularity' | 'favorite') => {
  const params = new URLSearchParams({ page: String(page) });
  if (type) params.set('type', type);
  if (filter) params.set('filter', filter);
  return rateLimitedFetch<JikanResponse<MangaItem[]>>(`${BASE_URL}/top/manga?${params}`);
};

// Search manga (optionally filtered by type, sorted by score by default)
export const searchManga = (query: string, page = 1, type?: MangaType) => {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    order_by: 'score',
    sort: 'desc',
  });
  if (type) params.set('type', type);
  return rateLimitedFetch<JikanResponse<MangaItem[]>>(`${BASE_URL}/manga?${params}`);
};

// Manga details
export const getMangaDetails = (id: number) =>
  rateLimitedFetch<JikanResponse<MangaItem>>(`${BASE_URL}/manga/${id}/full`);

// Manga image helper
export const mangaImage = (manga: MangaItem, size: 'small' | 'default' | 'large' = 'default') => {
  if (!manga.images?.jpg) return '/images/no-poster.png';
  switch (size) {
    case 'small': return manga.images.jpg.small_image_url || manga.images.jpg.image_url;
    case 'large': return manga.images.jpg.large_image_url || manga.images.jpg.image_url;
    default: return manga.images.jpg.image_url;
  }
};
