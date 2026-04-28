// ============================================
// User & Auth Types
// ============================================

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  city: string | null;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================
// Media Types (Movies, Series, Anime)
// ============================================

export type MediaType = 'movie' | 'tv' | 'anime';

export interface MediaItem {
  id: number;
  title: string;
  original_title?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: Genre[];
  media_type: MediaType;
  popularity: number;
  original_language?: string;
  adult?: boolean;
}

export interface MovieDetails extends MediaItem {
  media_type: 'movie';
  runtime: number;
  budget: number;
  revenue: number;
  status: string;
  tagline: string;
  imdb_id: string | null;
  production_companies: ProductionCompany[];
  credits?: Credits;
  videos?: VideoResults;
  similar?: MediaResponse;
}

export interface TVDetails extends MediaItem {
  media_type: 'tv';
  number_of_seasons: number;
  number_of_episodes: number;
  episode_run_time: number[];
  status: string;
  tagline: string;
  first_air_date: string;
  last_air_date: string;
  seasons: Season[];
  created_by: Creator[];
  networks: Network[];
  credits?: Credits;
  videos?: VideoResults;
  similar?: MediaResponse;
}

export interface AnimeItem {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  images: {
    jpg: { image_url: string; small_image_url: string; large_image_url: string };
    webp: { image_url: string; small_image_url: string; large_image_url: string };
  };
  type: string;
  episodes: number | null;
  status: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  aired: {
    from: string | null;
    to: string | null;
    string: string;
  };
  duration: string;
  rating: string;
  season: string | null;
  year: number | null;
  genres: { mal_id: number; name: string }[];
  studios: { mal_id: number; name: string }[];
  trailer: {
    youtube_id: string | null;
    url: string | null;
    embed_url: string | null;
  };
}

export interface MangaItem {
  mal_id: number;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  images: {
    jpg: { image_url: string; small_image_url: string; large_image_url: string };
    webp: { image_url: string; small_image_url: string; large_image_url: string };
  };
  type: string; // Manga, Manhwa, Manhua, Light Novel, One-shot, Doujin
  chapters: number | null;
  volumes: number | null;
  status: string;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  published: {
    from: string | null;
    to: string | null;
    string: string;
  };
  genres: { mal_id: number; name: string }[];
  authors: { mal_id: number; name: string }[];
  serializations: { mal_id: number; name: string }[];
}

// ============================================
// Supporting Types
// ============================================

export interface Genre {
  id: number;
  name: string;
}

export interface ProductionCompany {
  id: number;
  name: string;
  logo_path: string | null;
  origin_country: string;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  poster_path: string | null;
  episode_count: number;
  air_date: string | null;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  still_path: string | null;
  vote_average: number;
  vote_count: number;
}

export interface TMDBSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  overview: string;
  air_date: string | null;
  poster_path: string | null;
  episodes: TMDBEpisode[];
}

export interface JikanEpisode {
  mal_id: number;
  title: string;
  title_japanese: string | null;
  title_romanji: string | null;
  aired: string | null;
  score: number | null;
  filler: boolean;
  recap: boolean;
}

export interface Creator {
  id: number;
  name: string;
  profile_path: string | null;
}

export interface Network {
  id: number;
  name: string;
  logo_path: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface Credits {
  cast: CastMember[];
  crew: CrewMember[];
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface VideoResults {
  results: Video[];
}

// ============================================
// API Response Types
// ============================================

export interface MediaResponse {
  page: number;
  results: MediaItem[];
  total_pages: number;
  total_results: number;
}

export interface JikanResponse<T> {
  data: T;
  pagination?: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: { count: number; total: number; per_page: number };
  };
}

// ============================================
// Watchlist & Tracking Types
// ============================================

export type WatchStatus = 'watchlist' | 'watching' | 'watched' | 'dropped';

export interface WatchlistItem {
  id: string;
  user_id: string;
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  status: WatchStatus;
  user_rating: number | null; // 1-10 scale
  watched_date: string | null;
  added_at: string;
  updated_at: string;
  notes: string | null;
  /** For TV/anime: the last season the user has watched into (1-indexed). */
  last_watched_season: number | null;
  /** For TV/anime: the last episode (within that season) the user has watched. */
  last_watched_episode: number | null;
  /** ISO 639-1 language code from TMDB (`en`, `hi`, `ja`, …). Used to bucket
   *  movies into Hollywood / Bollywood / Other on the profile rings. */
  original_language: string | null;
}

export interface UserRating {
  id: string;
  user_id: string;
  media_id: number;
  media_type: MediaType;
  rating: number; // 1-10
  review: string | null;
  created_at: string;
  user?: User;
}

export interface RatingsSummary {
  platform_average: number;
  platform_count: number;
  global_average: number;
}

// ============================================
// Recommendation Types
// ============================================

export type RecommendationVisibility = 'everyone' | 'friends';

/** Media kinds that can be recommended. Mirrors `ActivityMediaType` because a
 *  user can recommend any title they can also log to history (incl. manga). */
export type RecommendableMediaType = MediaType | 'manga';

export interface Recommendation {
  id: string;
  user_id: string;
  media_id: number;
  media_type: RecommendableMediaType;
  title: string;
  poster_path: string | null;
  message: string | null;
  visibility: RecommendationVisibility;
  created_at: string;
  user?: User;
}

// ============================================
// Activity Feed Types
// ============================================

export type ActivityType = 'watched' | 'rated' | 'added_to_watchlist' | 'recommended';

/** Media kinds that can appear in the activity feed (broader than MediaType
 *  because the manga tracker also publishes 'completed' events here). */
export type ActivityMediaType = MediaType | 'manga';

export interface ActivityItem {
  id: string;
  user_id: string;
  media_id: number;
  media_type: ActivityMediaType;
  activity_type: ActivityType;
  title: string;
  poster_path: string | null;
  rating?: number;
  message?: string;
  created_at: string;
  user?: User;
}

// ============================================
// Theme
// ============================================

export type Theme = 'dark' | 'light';

// ============================================
// Collection Types
// ============================================

export interface CollectionItem {
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  added_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  items: CollectionItem[];
  created_at: string;
  updated_at: string;
}

// ============================================
// Badge & Achievement Types
// ============================================

export type BadgeDifficulty = 'easy' | 'medium' | 'hard';
export type BadgeCategory = 'watching' | 'rating' | 'social' | 'collection' | 'exploration' | 'dedication';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // react-icons name
  difficulty: BadgeDifficulty;
  category: BadgeCategory;
  criteria: BadgeCriteria;
  color: string;
}

export interface BadgeCriteria {
  type: string;
  threshold: number;
  mediaType?: MediaType;
  extra?: string;
}

export interface UserBadge {
  badge_id: string;
  unlocked_at: string;
  progress: number; // 0–100
}

// ============================================
// Friends System Types
// ============================================

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface FriendRequest {
  id: string;
  from_user_id: string;
  to_user_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

// ============================================
// Watch Party Types
// ============================================

export interface WatchPartyMessage {
  id: string;
  user_id: string;
  text: string;
  created_at: string;
}

export interface WatchParty {
  id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  creator_id: string;
  city: string;
  theater: string | null;
  date: string;           // YYYY-MM-DD
  time: string | null;    // HH:mm
  max_members: number;
  members: string[];      // user IDs
  messages: WatchPartyMessage[];
  created_at: string;
}
