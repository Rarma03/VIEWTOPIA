'use client';

/**
 * User-data store, backed by Supabase.
 *
 * All functions are async. They call Supabase directly and rely on Row Level
 * Security to authorize the request — we never embed any secret here.
 *
 * Pages should generally use the typed hooks in `src/hooks/useUserData.ts`,
 * which wrap these functions with loading state and an in-memory cache.
 *
 * Areas not yet migrated to Supabase (collections, badges, friends) are
 * stubbed below to return empty data so older pages don't crash. They will
 * be migrated in a follow-up.
 */

import {
  WatchlistItem,
  UserRating,
  Recommendation,
  ActivityItem,
  WatchParty,
  WatchPartyMessage,
  Collection,
  UserBadge,
  FriendRequest,
  FriendshipStatus,
  User,
  MediaType,
  WatchStatus,
  ActivityType,
  ActivityMediaType,
  RecommendationVisibility,
  RecommendableMediaType,
} from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Limits & helpers
// ---------------------------------------------------------------------------

const LIMITS = {
  watchlist: 500,
  ratings: 1000,
  recommendations: 200,
  activity: 200,
  parties: 100,
  partyMessages: 200,
  partyMessageLength: 500,
  recommendationMessage: 500,
  notes: 500,
} as const;

function clamp(text: string | null | undefined, max: number): string | null {
  if (text == null) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function ensureConfigured(): void {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured');
  }
}

// Keep references that are still imported by some pages but no longer used.
export const DEMO_USERS: User[] = [];

export function initStore(): void { /* no-op */ }

// ---------------------------------------------------------------------------
// Watchlist
// ---------------------------------------------------------------------------

interface WatchlistRow {
  id: string;
  user_id: string;
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  status: WatchStatus;
  watched_date: string | null;
  notes: string | null;
  last_watched_season: number | null;
  last_watched_episode: number | null;
  original_language: string | null;
  created_at: string;
  updated_at: string;
}

function watchlistRowToItem(r: WatchlistRow): WatchlistItem {
  return {
    id: r.id,
    user_id: r.user_id,
    media_id: r.media_id,
    media_type: r.media_type,
    title: r.title,
    poster_path: r.poster_path,
    status: r.status,
    user_rating: null, // ratings live in the `ratings` table; query that for the value
    watched_date: r.watched_date,
    notes: r.notes,
    added_at: r.created_at,
    updated_at: r.updated_at,
    last_watched_season: r.last_watched_season ?? null,
    last_watched_episode: r.last_watched_episode ?? null,
    original_language: r.original_language ?? null,
  };
}

export async function getWatchlist(userId?: string): Promise<WatchlistItem[]> {
  if (!isSupabaseConfigured) return [];
  const query = getSupabase()
    .from('watchlist_items')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(LIMITS.watchlist);

  const { data, error } = userId ? await query.eq('user_id', userId) : await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] getWatchlist failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => watchlistRowToItem(r as WatchlistRow));
}

export async function isInWatchlist(userId: string, mediaId: number, mediaType: MediaType): Promise<WatchlistItem | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase()
    .from('watchlist_items')
    .select('*')
    .eq('user_id', userId)
    .eq('media_id', mediaId)
    .eq('media_type', mediaType)
    .maybeSingle();
  if (error || !data) return null;
  return watchlistRowToItem(data as WatchlistRow);
}

export interface NewWatchlistItem {
  user_id: string;
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  status?: WatchStatus;
  watched_date?: string | null;
  notes?: string | null;
  /** ISO 639-1 language hint, used for the Hollywood/Bollywood/Other split on profile. */
  original_language?: string | null;
}

export async function addToWatchlist(item: NewWatchlistItem): Promise<WatchlistItem | null> {
  ensureConfigured();
  const payload = {
    user_id: item.user_id,
    media_id: item.media_id,
    media_type: item.media_type,
    title: clamp(item.title, 300) ?? '',
    poster_path: item.poster_path,
    status: item.status ?? 'watchlist',
    watched_date: item.watched_date ?? null,
    notes: clamp(item.notes ?? null, LIMITS.notes),
    original_language: item.original_language ?? null,
  };

  const { data, error } = await getSupabase()
    .from('watchlist_items')
    .upsert(payload, { onConflict: 'user_id,media_id,media_type' })
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] addToWatchlist failed:', error.message);
    return null;
  }

  // Only log 'watched' events to keep history table small.
  if (payload.status === 'watched') {
    await logActivity({
      user_id: item.user_id,
      media_id: item.media_id,
      media_type: item.media_type,
      activity_type: 'watched',
      title: payload.title,
      poster_path: payload.poster_path,
    });
  }

  return watchlistRowToItem(data as WatchlistRow);
}

export async function updateWatchlistItem(id: string, updates: Partial<Pick<WatchlistItem, 'status' | 'watched_date' | 'notes' | 'last_watched_season' | 'last_watched_episode'>>): Promise<WatchlistItem | null> {
  ensureConfigured();
  const payload: Record<string, unknown> = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.watched_date !== undefined) payload.watched_date = updates.watched_date;
  if (updates.notes !== undefined) payload.notes = clamp(updates.notes, LIMITS.notes);
  if (updates.last_watched_season !== undefined) payload.last_watched_season = updates.last_watched_season;
  if (updates.last_watched_episode !== undefined) payload.last_watched_episode = updates.last_watched_episode;

  const { data, error } = await getSupabase()
    .from('watchlist_items')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] updateWatchlistItem failed:', error.message);
    return null;
  }
  const item = watchlistRowToItem(data as WatchlistRow);

  // Log 'watched' history when the item transitions into the watched state.
  if (updates.status === 'watched') {
    await logActivity({
      user_id: item.user_id,
      media_id: item.media_id,
      media_type: item.media_type,
      activity_type: 'watched',
      title: item.title,
      poster_path: item.poster_path,
    });
  }
  return item;
}

export async function removeFromWatchlist(id: string): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase().from('watchlist_items').delete().eq('id', id);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] removeFromWatchlist failed:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

interface RatingRow {
  id: string;
  user_id: string;
  media_id: number;
  media_type: MediaType;
  rating: number;
  review: string | null;
  created_at: string;
  updated_at: string;
}

function ratingRowToItem(r: RatingRow): UserRating {
  return {
    id: r.id,
    user_id: r.user_id,
    media_id: r.media_id,
    media_type: r.media_type,
    rating: r.rating,
    review: r.review,
    created_at: r.created_at,
  };
}

export interface RatingsFilter {
  mediaId?: number;
  mediaType?: MediaType;
  userId?: string;
}

export async function getRatings(filter: RatingsFilter = {}): Promise<UserRating[]> {
  if (!isSupabaseConfigured) return [];
  let query = getSupabase()
    .from('ratings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(LIMITS.ratings);

  if (filter.userId)    query = query.eq('user_id', filter.userId);
  if (filter.mediaId)   query = query.eq('media_id', filter.mediaId);
  if (filter.mediaType) query = query.eq('media_type', filter.mediaType);

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] getRatings failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ratingRowToItem(r as RatingRow));
}

export interface NewRating {
  user_id: string;
  media_id: number;
  media_type: MediaType;
  rating: number;
  review?: string | null;
  title?: string;
  poster_path?: string | null;
}

export async function addRating(input: NewRating): Promise<UserRating | null> {
  ensureConfigured();
  if (input.rating < 1 || input.rating > 10) {
    throw new Error('Rating must be between 1 and 10');
  }

  const { data, error } = await getSupabase()
    .from('ratings')
    .upsert({
      user_id: input.user_id,
      media_id: input.media_id,
      media_type: input.media_type,
      rating: input.rating,
      review: clamp(input.review ?? null, 1000),
    }, { onConflict: 'user_id,media_id,media_type' })
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] addRating failed:', error.message);
    return null;
  }

  // Note: ratings no longer log a history activity — only 'watched' events do.
  return ratingRowToItem(data as RatingRow);
}

export async function removeRating(userId: string, mediaId: number, mediaType: MediaType): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase()
    .from('ratings')
    .delete()
    .eq('user_id', userId)
    .eq('media_id', mediaId)
    .eq('media_type', mediaType);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] removeRating failed:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

interface RecommendationRow {
  id: string;
  user_id: string;
  media_id: number;
  media_type: RecommendableMediaType;
  title: string;
  poster_path: string | null;
  message: string | null;
  created_at: string;
}

function recRowToItem(r: RecommendationRow): Recommendation {
  return {
    id: r.id,
    user_id: r.user_id,
    media_id: r.media_id,
    media_type: r.media_type,
    title: r.title,
    poster_path: r.poster_path,
    message: r.message,
    visibility: 'everyone',
    created_at: r.created_at,
  };
}

export async function getRecommendations(userId?: string): Promise<Recommendation[]> {
  if (!isSupabaseConfigured) return [];
  let query = getSupabase()
    .from('recommendations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(LIMITS.recommendations);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] getRecommendations failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => recRowToItem(r as RecommendationRow));
}

export interface NewRecommendation {
  user_id: string;
  media_id: number;
  media_type: RecommendableMediaType;
  title: string;
  poster_path: string | null;
  message?: string | null;
  visibility?: RecommendationVisibility;
}

export async function addRecommendation(input: NewRecommendation): Promise<Recommendation | null> {
  ensureConfigured();
  const safeTitle = clamp(input.title, 300) ?? '';
  const safeMsg = clamp(input.message ?? null, LIMITS.recommendationMessage);

  const { data, error } = await getSupabase()
    .from('recommendations')
    .insert({
      user_id: input.user_id,
      media_id: input.media_id,
      media_type: input.media_type,
      title: safeTitle,
      poster_path: input.poster_path,
      message: safeMsg,
    })
    .select()
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] addRecommendation failed:', error.message);
    return null;
  }

  // Note: recommendations no longer log a history activity — only 'watched' events do.
  return recRowToItem(data as RecommendationRow);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

interface ActivityRow {
  id: string;
  user_id: string;
  activity_type: ActivityType;
  media_id: number;
  media_type: ActivityMediaType;
  media_title: string;
  media_poster: string | null;
  rating: number | null;
  message: string | null;
  created_at: string;
}

function activityRowToItem(r: ActivityRow): ActivityItem {
  return {
    id: r.id,
    user_id: r.user_id,
    activity_type: r.activity_type,
    media_id: r.media_id,
    media_type: r.media_type,
    title: r.media_title,
    poster_path: r.media_poster,
    rating: r.rating ?? undefined,
    message: r.message ?? undefined,
    created_at: r.created_at,
  };
}

export async function getActivity(userId?: string, limit: number = 20): Promise<ActivityItem[]> {
  if (!isSupabaseConfigured) return [];
  // Cap the request server-side so we don't pull the user's entire history —
  // the activity feed only ever shows the most recent slice.
  const safeLimit = Math.min(Math.max(1, limit), LIMITS.activity);
  let query = getSupabase()
    .from('activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] getActivity failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => activityRowToItem(r as ActivityRow));
}

interface ActivityInput {
  user_id: string;
  media_id: number;
  media_type: MediaType;
  activity_type: ActivityType;
  title: string;
  poster_path: string | null;
  rating?: number;
  message?: string;
}

async function logActivity(input: ActivityInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = getSupabase();

  // Dedupe: keep only one activity row per (user, media, activity_type).
  // Delete any prior matching rows so re-rating / re-marking doesn't bloat history.
  const { error: delError } = await supabase
    .from('activities')
    .delete()
    .eq('user_id', input.user_id)
    .eq('media_id', input.media_id)
    .eq('media_type', input.media_type)
    .eq('activity_type', input.activity_type);
  if (delError) {
    // eslint-disable-next-line no-console
    console.warn('[store] logActivity dedupe failed:', delError.message);
  }

  const { error } = await supabase.from('activities').insert({
    user_id: input.user_id,
    activity_type: input.activity_type,
    media_id: input.media_id,
    media_type: input.media_type,
    media_title: clamp(input.title, 300) ?? '',
    media_poster: input.poster_path,
    rating: input.rating ?? null,
    message: clamp(input.message ?? null, LIMITS.recommendationMessage),
  });
  if (error) {
    // Activity logging is best-effort. Don't surface to user.
    // eslint-disable-next-line no-console
    console.warn('[store] logActivity failed:', error.message);
  }
}

// ---------------------------------------------------------------------------
// Watch Parties
// ---------------------------------------------------------------------------

interface PartyRow {
  id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  creator_id: string;
  city: string;
  theater: string | null;
  event_date: string;
  event_time: string | null;
  max_members: number;
  created_at: string;
  watch_party_members?: { user_id: string }[];
}

function partyRowToItem(r: PartyRow): WatchParty {
  return {
    id: r.id,
    movie_id: r.movie_id,
    movie_title: r.movie_title,
    poster_path: r.poster_path,
    creator_id: r.creator_id,
    city: r.city,
    theater: r.theater,
    date: r.event_date,
    time: r.event_time?.slice(0, 5) ?? null,
    max_members: r.max_members,
    members: (r.watch_party_members ?? []).map((m) => m.user_id),
    messages: [],
    created_at: r.created_at,
  };
}

export interface PartyFilters {
  city?: string;
  movieId?: number;
  date?: string;
}

export async function getWatchParties(filters: PartyFilters = {}): Promise<WatchParty[]> {
  if (!isSupabaseConfigured) return [];
  const today = new Date().toISOString().slice(0, 10);
  let query = getSupabase()
    .from('watch_parties')
    .select('*, watch_party_members(user_id)')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(LIMITS.parties);

  if (filters.city)    query = query.ilike('city', `%${filters.city}%`);
  if (filters.movieId) query = query.eq('movie_id', filters.movieId);
  if (filters.date)    query = query.eq('event_date', filters.date);

  const { data, error } = await query;
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] getWatchParties failed:', error.message);
    return [];
  }
  return (data ?? []).map((r) => partyRowToItem(r as PartyRow));
}

export async function getWatchParty(id: string): Promise<WatchParty | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await getSupabase()
    .from('watch_parties')
    .select('*, watch_party_members(user_id)')
    .eq('id', id)
    .maybeSingle();
  if (error || !data) return null;
  return partyRowToItem(data as PartyRow);
}

export async function getUserParties(userId: string): Promise<WatchParty[]> {
  if (!isSupabaseConfigured || !userId) return [];
  const today = new Date().toISOString().slice(0, 10);
  // Fetch all parties the user is a member of via the membership table.
  const { data: memberships, error: memErr } = await getSupabase()
    .from('watch_party_members')
    .select('party_id')
    .eq('user_id', userId);
  if (memErr || !memberships?.length) return [];

  const ids = memberships.map((m) => m.party_id);
  const { data, error } = await getSupabase()
    .from('watch_parties')
    .select('*, watch_party_members(user_id)')
    .in('id', ids)
    .gte('event_date', today)
    .order('event_date', { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => partyRowToItem(r as PartyRow));
}

export interface NewWatchParty {
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  creator_id: string;
  city: string;
  theater?: string | null;
  date: string;       // YYYY-MM-DD
  time?: string | null;
  max_members?: number;
}

export async function createWatchParty(input: NewWatchParty): Promise<WatchParty | null> {
  ensureConfigured();
  const { data, error } = await getSupabase()
    .from('watch_parties')
    .insert({
      movie_id: input.movie_id,
      movie_title: clamp(input.movie_title, 300) ?? '',
      poster_path: input.poster_path,
      creator_id: input.creator_id,
      city: clamp(input.city, 100) ?? '',
      theater: clamp(input.theater ?? null, 200),
      event_date: input.date,
      event_time: input.time ?? null,
      max_members: Math.min(Math.max(input.max_members ?? 10, 2), 100),
    })
    .select('*, watch_party_members(user_id)')
    .single();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] createWatchParty failed:', error.message);
    return null;
  }
  return partyRowToItem(data as PartyRow);
}

export async function joinWatchParty(partyId: string, userId: string): Promise<boolean> {
  ensureConfigured();
  const party = await getWatchParty(partyId);
  if (!party) return false;
  if (party.members.length >= party.max_members) return false;
  if (party.members.includes(userId)) return true;

  const { error } = await getSupabase()
    .from('watch_party_members')
    .insert({ party_id: partyId, user_id: userId });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] joinWatchParty failed:', error.message);
    return false;
  }
  return true;
}

export async function leaveWatchParty(partyId: string, userId: string): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase()
    .from('watch_party_members')
    .delete()
    .eq('party_id', partyId)
    .eq('user_id', userId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] leaveWatchParty failed:', error.message);
    return false;
  }
  return true;
}

export async function deleteWatchParty(partyId: string): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase().from('watch_parties').delete().eq('id', partyId);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] deleteWatchParty failed:', error.message);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Watch-party chat (party_messages table)
// ---------------------------------------------------------------------------

interface PartyMessageRow {
  id: string;
  party_id: string;
  user_id: string;
  user_name: string;
  text: string;
  created_at: string;
}

function messageRowToItem(r: PartyMessageRow): WatchPartyMessage {
  return {
    id: r.id,
    user_id: r.user_id,
    text: r.text,
    created_at: r.created_at,
  };
}

export async function getPartyMessages(partyId: string): Promise<WatchPartyMessage[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase()
    .from('party_messages')
    .select('*')
    .eq('party_id', partyId)
    .order('created_at', { ascending: true })
    .limit(LIMITS.partyMessages);
  if (error) return [];
  return (data ?? []).map((r) => messageRowToItem(r as PartyMessageRow));
}

export async function sendPartyMessage(partyId: string, userId: string, userName: string, text: string): Promise<WatchPartyMessage | null> {
  ensureConfigured();
  const safeText = clamp(text, LIMITS.partyMessageLength);
  if (!safeText) return null;
  const { data, error } = await getSupabase()
    .from('party_messages')
    .insert({
      party_id: partyId,
      user_id: userId,
      user_name: userName,
      text: safeText,
    })
    .select()
    .single();
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[store] sendPartyMessage failed:', error.message);
    return null;
  }
  return messageRowToItem(data as PartyMessageRow);
}

// ---------------------------------------------------------------------------
// Profile lookups (used by activity feed, recommendations, etc.)
// ---------------------------------------------------------------------------

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  created_at?: string;
}

export async function getProfilesByIds(ids: string[]): Promise<Record<string, PublicProfile>> {
  if (!isSupabaseConfigured || ids.length === 0) return {};
  const unique = Array.from(new Set(ids));
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, username, display_name, avatar_url, city')
    .in('id', unique);
  if (error || !data) return {};
  const map: Record<string, PublicProfile> = {};
  for (const p of data) map[(p as PublicProfile).id] = p as PublicProfile;
  return map;
}

export async function getProfileByUsername(username: string): Promise<PublicProfile | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabase()
    .from('profiles')
    .select('id, username, display_name, avatar_url, city')
    .eq('username', username)
    .maybeSingle();
  return (data as PublicProfile | null) ?? null;
}

/**
 * Check whether `username` is free. If `excludeUserId` is provided, that user's
 * own current row is ignored so they can re-save the same username.
 * Returns true if available (or if Supabase is not configured / lookup errors,
 * in which case the unique constraint will catch a real conflict at write time).
 */
export async function isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  let q = getSupabase()
    .from('profiles')
    .select('id')
    .eq('username', username);
  if (excludeUserId) q = q.neq('id', excludeUserId);
  const { data, error } = await q.maybeSingle();
  if (error) return true;
  return !data;
}

export async function getAllProfiles(limit = 200): Promise<PublicProfile[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, username, display_name, avatar_url, city, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as PublicProfile[];
}

export async function searchProfiles(query: string, limit = 50): Promise<PublicProfile[]> {
  if (!isSupabaseConfigured) return [];
  const q = query.trim();
  if (!q) return getAllProfiles(limit);
  const pattern = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, username, display_name, avatar_url, city, created_at')
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .limit(limit);
  if (error || !data) return [];
  return data as PublicProfile[];
}

// ---------------------------------------------------------------------------
// Premium (stored on profiles.is_premium)
// ---------------------------------------------------------------------------

export async function isPremiumUser(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await getSupabase()
    .from('profiles')
    .select('is_premium')
    .eq('id', userId)
    .maybeSingle();
  return !!data?.is_premium;
}

export async function setPremium(userId: string, value: boolean): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase().from('profiles').update({ is_premium: value }).eq('id', userId);
  return !error;
}

// ---------------------------------------------------------------------------
// Collections (premium-only feature, gated client-side)
// ---------------------------------------------------------------------------

interface CollectionRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

interface CollectionItemRow {
  id: string;
  collection_id: string;
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
  added_at: string;
}

function rowToCollection(c: CollectionRow, items: CollectionItemRow[]): Collection {
  return {
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    description: c.description,
    items: items.map((i) => ({
      media_id: i.media_id,
      media_type: i.media_type,
      title: i.title,
      poster_path: i.poster_path,
      added_at: i.added_at,
    })),
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export async function getCollections(userId?: string): Promise<Collection[]> {
  if (!isSupabaseConfigured) return [];
  const sb = getSupabase();
  let q = sb.from('collections').select('*').order('updated_at', { ascending: false });
  if (userId) q = q.eq('user_id', userId);
  const { data: cols, error } = await q;
  if (error || !cols) return [];
  if (cols.length === 0) return [];
  const ids = (cols as CollectionRow[]).map((c) => c.id);
  const { data: items } = await sb
    .from('collection_items')
    .select('*')
    .in('collection_id', ids);
  const itemsByCollection = new Map<string, CollectionItemRow[]>();
  (items as CollectionItemRow[] | null || []).forEach((i) => {
    const list = itemsByCollection.get(i.collection_id) || [];
    list.push(i);
    itemsByCollection.set(i.collection_id, list);
  });
  return (cols as CollectionRow[]).map((c) =>
    rowToCollection(c, itemsByCollection.get(c.id) || []),
  );
}

export async function getCollection(id: string): Promise<Collection | null> {
  if (!isSupabaseConfigured) return null;
  const sb = getSupabase();
  const { data: c, error } = await sb.from('collections').select('*').eq('id', id).maybeSingle();
  if (error || !c) return null;
  const { data: items } = await sb
    .from('collection_items')
    .select('*')
    .eq('collection_id', id)
    .order('added_at', { ascending: true });
  return rowToCollection(c as CollectionRow, (items as CollectionItemRow[]) || []);
}

export async function createCollection(input: {
  user_id: string;
  name: string;
  description?: string | null;
}): Promise<Collection | null> {
  ensureConfigured();
  const { data, error } = await getSupabase()
    .from('collections')
    .insert({
      user_id: input.user_id,
      name: clamp(input.name, 100) || 'Untitled',
      description: clamp(input.description ?? null, 500),
    })
    .select()
    .single();
  if (error || !data) {
    // eslint-disable-next-line no-console
    console.warn('[store] createCollection failed:', error?.message);
    return null;
  }
  return rowToCollection(data as CollectionRow, []);
}

export async function updateCollection(
  id: string,
  changes: { name?: string; description?: string | null },
): Promise<boolean> {
  ensureConfigured();
  const patch: Record<string, unknown> = {};
  if (changes.name !== undefined) patch.name = clamp(changes.name, 100) || 'Untitled';
  if (changes.description !== undefined) patch.description = clamp(changes.description, 500);
  if (Object.keys(patch).length === 0) return true;
  const { error } = await getSupabase().from('collections').update(patch).eq('id', id);
  return !error;
}

export async function deleteCollection(id: string): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase().from('collections').delete().eq('id', id);
  return !error;
}

export async function addToCollection(
  collectionId: string,
  item: { media_id: number; media_type: MediaType; title: string; poster_path: string | null },
): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase()
    .from('collection_items')
    .upsert({
      collection_id: collectionId,
      media_id: item.media_id,
      media_type: item.media_type,
      title: clamp(item.title, 200) || 'Untitled',
      poster_path: item.poster_path,
    }, { onConflict: 'collection_id,media_id,media_type' });
  return !error;
}

export async function removeFromCollection(
  collectionId: string,
  mediaId: number,
  mediaType: MediaType,
): Promise<boolean> {
  ensureConfigured();
  const { error } = await getSupabase()
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('media_id', mediaId)
    .eq('media_type', mediaType);
  return !error;
}

// ---------------------------------------------------------------------------
// Legacy stubs — badges & friends are not migrated yet.
// They return empty data so existing pages render without crashing.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-unused-vars */
export function getUserBadges(_userId?: string): UserBadge[]                { return []; }
export function checkAndUpdateBadges(_userId?: string): string[]            { return []; }
export function unlockBadge(..._args: unknown[]): void                      { /* stub */ }
export function updateBadgeProgress(..._args: unknown[]): void              { /* stub */ }

export function updateDemoUser(..._args: unknown[]): null                   { return null; }
export function getUserByUsername(_username?: string): undefined            { return undefined; }
/* eslint-enable @typescript-eslint/no-unused-vars */

// Premium toggle helper used by /premium page (now writes to profiles).
export async function togglePremium(userId: string): Promise<boolean> {
  const current = await isPremiumUser(userId);
  await setPremium(userId, !current);
  return !current;
}

// `cleanupParties` was a localStorage maintenance routine; with Postgres we
// just rely on the WHERE clause filtering past dates in `getWatchParties`.
export function cleanupParties(): void { /* no-op */ }

// ---------------------------------------------------------------------------
// Friends (Supabase-backed)
// ---------------------------------------------------------------------------

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
}

function rowToRequest(row: FriendshipRow): FriendRequest {
  return {
    id: row.id,
    from_user_id: row.requester_id,
    to_user_id: row.addressee_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** Pending requests addressed *to* the user (incoming inbox). */
export async function getFriendRequests(userId: string): Promise<FriendRequest[]> {
  if (!userId || !isSupabaseConfigured) return [];
  const { data, error } = await getSupabase()
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at, updated_at')
    .eq('addressee_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('getFriendRequests error:', error);
    return [];
  }
  return ((data as FriendshipRow[]) || []).map(rowToRequest);
}

/** Count of pending incoming requests (for navbar badge). */
export async function getPendingRequestCount(userId: string): Promise<number> {
  if (!userId || !isSupabaseConfigured) return 0;
  const { count, error } = await getSupabase()
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('addressee_id', userId)
    .eq('status', 'pending');
  if (error) {
    console.error('getPendingRequestCount error:', error);
    return 0;
  }
  return count ?? 0;
}

/** IDs of accepted friends. */
export async function getFriends(userId: string): Promise<string[]> {
  if (!userId || !isSupabaseConfigured) return [];
  const { data, error } = await getSupabase()
    .from('friendships')
    .select('requester_id, addressee_id, status')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (error) {
    console.error('getFriends error:', error);
    return [];
  }
  return ((data as Pick<FriendshipRow, 'requester_id' | 'addressee_id' | 'status'>[]) || []).map(
    (r) => (r.requester_id === userId ? r.addressee_id : r.requester_id),
  );
}

interface FriendshipStatusResult {
  status: FriendshipStatus | 'none';
  direction: 'outgoing' | 'incoming' | null;
  requestId: string | null;
}

/**
 * Relationship between currentUserId and otherUserId.
 *  - 'outgoing' = currentUser sent the request
 *  - 'incoming' = otherUser sent the request
 */
export async function getFriendshipStatus(
  currentUserId: string,
  otherUserId: string,
): Promise<FriendshipStatusResult> {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId || !isSupabaseConfigured) {
    return { status: 'none', direction: null, requestId: null };
  }
  const { data, error } = await getSupabase()
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),` +
      `and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`,
    )
    .maybeSingle();
  if (error || !data) return { status: 'none', direction: null, requestId: null };
  const row = data as Pick<FriendshipRow, 'id' | 'requester_id' | 'addressee_id' | 'status'>;
  return {
    status: row.status,
    direction: row.requester_id === currentUserId ? 'outgoing' : 'incoming',
    requestId: row.id,
  };
}

/** Send a friend request (no-op if any row already exists). */
export async function sendFriendRequest(
  currentUserId: string,
  otherUserId: string,
): Promise<FriendRequest | null> {
  if (!currentUserId || !otherUserId || currentUserId === otherUserId || !isSupabaseConfigured) {
    return null;
  }
  const existing = await getFriendshipStatus(currentUserId, otherUserId);
  if (existing.status !== 'none') return null;
  const { data, error } = await getSupabase()
    .from('friendships')
    .insert({ requester_id: currentUserId, addressee_id: otherUserId, status: 'pending' })
    .select('id, requester_id, addressee_id, status, created_at, updated_at')
    .single();
  if (error || !data) {
    console.error('sendFriendRequest error:', error);
    return null;
  }
  return rowToRequest(data as FriendshipRow);
}

/** Accept a pending request by row id. */
export async function acceptFriendRequest(requestId: string): Promise<boolean> {
  if (!requestId || !isSupabaseConfigured) return false;
  const { error } = await getSupabase()
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) { console.error('acceptFriendRequest error:', error); return false; }
  return true;
}

/** Reject (delete) a pending request by row id. */
export async function rejectFriendRequest(requestId: string): Promise<boolean> {
  if (!requestId || !isSupabaseConfigured) return false;
  const { error } = await getSupabase().from('friendships').delete().eq('id', requestId);
  if (error) { console.error('rejectFriendRequest error:', error); return false; }
  return true;
}

/** Cancel an outgoing pending request OR remove an accepted friend. */
export async function removeFriend(
  currentUserId: string,
  otherUserId: string,
): Promise<boolean> {
  if (!currentUserId || !otherUserId || !isSupabaseConfigured) return false;
  const { error } = await getSupabase()
    .from('friendships')
    .delete()
    .or(
      `and(requester_id.eq.${currentUserId},addressee_id.eq.${otherUserId}),` +
      `and(requester_id.eq.${otherUserId},addressee_id.eq.${currentUserId})`,
    );
  if (error) { console.error('removeFriend error:', error); return false; }
  return true;
}
