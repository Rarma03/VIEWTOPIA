/**
 * Manga / Manhwa / Manhua tracker.
 *
 * - When the user is logged in **and** Supabase is configured, entries are
 *   persisted to the `manga_tracker` table (see migration 003) so they sync
 *   across devices.
 * - When the user is anonymous (or Supabase is unreachable), we fall back to
 *   browser `localStorage` so the UX still works. On first sign-in we attempt
 *   a one-time migration of local entries into Supabase.
 *
 * The shape of `MangaTrackerEntry` matches the DB row plus a few helper
 * fields so the UI layer doesn't care which backend is in use.
 */

import type { MangaItem } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export type ReadStatus = 'plan' | 'reading' | 'completed' | 'dropped';

export interface MangaTrackerEntry {
  mal_id: number;
  title: string;
  image_url: string | null;
  type: string; // Manga / Manhwa / Manhua / Light Novel / etc.
  status: ReadStatus;
  chapters_read: number | null;
  total_chapters: number | null;
  volumes_read: number | null;
  total_volumes: number | null;
  score: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  added_at: string; // alias for created_at from local store
  updated_at: string;
}

export interface MangaTrackerPatch {
  status?: ReadStatus;
  chapters_read?: number | null;
  total_chapters?: number | null;
  volumes_read?: number | null;
  total_volumes?: number | null;
  score?: number | null;
  notes?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

const STORAGE_KEY = 'viewtopia.manga.tracker.v1';
const CHANGE_EVENT = 'manga-tracker-change';
const PENDING_SYNC_KEY = 'viewtopia.manga.tracker.synced_user';

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

// ---------------------------------------------------------------------------
// localStorage helpers (anonymous mode)
// ---------------------------------------------------------------------------

function readLocal(): Record<string, MangaTrackerEntry> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocal(map: Record<string, MangaTrackerEntry>) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* quota / disabled storage — ignore */
  }
}

function emitChange() {
  if (isBrowser()) window.dispatchEvent(new Event(CHANGE_EVENT));
}

// ---------------------------------------------------------------------------
// Supabase row mapping
// ---------------------------------------------------------------------------

interface MangaTrackerRow {
  id: string;
  user_id: string;
  mal_id: number;
  title: string;
  image_url: string | null;
  type: string;
  status: ReadStatus;
  chapters_read: number | null;
  total_chapters: number | null;
  volumes_read: number | null;
  total_volumes: number | null;
  score: number | null;
  notes: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEntry(r: MangaTrackerRow): MangaTrackerEntry {
  return {
    mal_id: r.mal_id,
    title: r.title,
    image_url: r.image_url,
    type: r.type,
    status: r.status,
    chapters_read: r.chapters_read,
    total_chapters: r.total_chapters,
    volumes_read: r.volumes_read,
    total_volumes: r.total_volumes,
    score: r.score,
    notes: r.notes,
    started_at: r.started_at,
    finished_at: r.finished_at,
    added_at: r.created_at,
    updated_at: r.updated_at,
  };
}

function useRemote(userId: string | null | undefined): userId is string {
  return Boolean(userId) && isSupabaseConfigured;
}

/**
 * Insert a `watched`-style activity row when a manga reaches the `completed`
 * state, so it shows up in the same activity feed as movies / TV / anime.
 *
 * Best-effort: failures are swallowed (the activities table CHECK constraint
 * needs migration 004 applied, but we don't want to break tracking on stale
 * Supabase deployments).
 */
async function logCompletionActivity(
  userId: string,
  manga: MangaItem,
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const supabase = getSupabase();
    // Dedupe: a single (user, mal_id, manga) row.
    await supabase
      .from('activities')
      .delete()
      .eq('user_id', userId)
      .eq('media_id', manga.mal_id)
      .eq('media_type', 'manga')
      .eq('activity_type', 'watched');
    await supabase.from('activities').insert({
      user_id: userId,
      activity_type: 'watched',
      media_id: manga.mal_id,
      media_type: 'manga',
      media_title: manga.title_english || manga.title,
      media_poster: manga.images?.jpg?.image_url ?? null,
    });
  } catch (err) {
    console.warn('[mangaTracker] logCompletionActivity failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllEntries(userId: string | null | undefined): Promise<MangaTrackerEntry[]> {
  if (useRemote(userId)) {
    try {
      const { data, error } = await getSupabase()
        .from('manga_tracker')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as MangaTrackerRow[] | null)?.map(rowToEntry) ?? [];
    } catch (err) {
      console.warn('[mangaTracker] remote fetch failed, using local cache:', err);
    }
  }
  return Object.values(readLocal()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

export async function getEntry(
  userId: string | null | undefined,
  malId: number,
): Promise<MangaTrackerEntry | null> {
  if (useRemote(userId)) {
    try {
      const { data, error } = await getSupabase()
        .from('manga_tracker')
        .select('*')
        .eq('user_id', userId)
        .eq('mal_id', malId)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToEntry(data as MangaTrackerRow) : null;
    } catch (err) {
      console.warn('[mangaTracker] remote getEntry failed:', err);
    }
  }
  return readLocal()[String(malId)] ?? null;
}

/**
 * Upsert an entry. Pass `manga` for fields populated from the source object;
 * `patch` overrides any of them (status, chapter counts, score, notes, dates).
 */
export async function upsertEntry(
  userId: string | null | undefined,
  manga: MangaItem,
  patch: MangaTrackerPatch,
): Promise<MangaTrackerEntry | null> {
  const now = new Date().toISOString();
  const baseTitle = manga.title_english || manga.title;
  const baseImage = manga.images?.jpg?.image_url || null;

  if (useRemote(userId)) {
    try {
      const existing = await getEntry(userId, manga.mal_id);
      const finalStatus = patch.status ?? existing?.status ?? 'plan';
      const row = {
        user_id: userId,
        mal_id: manga.mal_id,
        title: baseTitle,
        image_url: baseImage,
        type: manga.type,
        status: finalStatus,
        chapters_read:
          patch.chapters_read !== undefined
            ? patch.chapters_read
            : existing?.chapters_read ?? (finalStatus === 'completed' ? manga.chapters : 0),
        total_chapters:
          patch.total_chapters !== undefined ? patch.total_chapters : manga.chapters,
        volumes_read:
          patch.volumes_read !== undefined ? patch.volumes_read : existing?.volumes_read ?? null,
        total_volumes:
          patch.total_volumes !== undefined ? patch.total_volumes : manga.volumes,
        score: patch.score !== undefined ? patch.score : existing?.score ?? null,
        notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? null,
        started_at:
          patch.started_at !== undefined
            ? patch.started_at
            : existing?.started_at ?? (finalStatus === 'reading' ? today() : null),
        finished_at:
          patch.finished_at !== undefined
            ? patch.finished_at
            : existing?.finished_at ?? (finalStatus === 'completed' ? today() : null),
      };

      const { data, error } = await getSupabase()
        .from('manga_tracker')
        .upsert(row, { onConflict: 'user_id,mal_id' })
        .select()
        .single();
      if (error) throw error;
      // Fire-and-forget: log to activity feed when the user completes a title
      // (only on transition, not on every save while already completed).
      if (finalStatus === 'completed' && existing?.status !== 'completed') {
        void logCompletionActivity(userId, manga);
      }
      emitChange();
      return rowToEntry(data as MangaTrackerRow);
    } catch (err) {
      console.warn('[mangaTracker] remote upsert failed, falling back to local:', err);
    }
  }

  // ----- local fallback -----
  const map = readLocal();
  const key = String(manga.mal_id);
  const existing = map[key];
  const finalStatus = patch.status ?? existing?.status ?? 'plan';
  const entry: MangaTrackerEntry = {
    mal_id: manga.mal_id,
    title: baseTitle,
    image_url: baseImage,
    type: manga.type,
    status: finalStatus,
    chapters_read:
      patch.chapters_read !== undefined
        ? patch.chapters_read
        : existing?.chapters_read ?? (finalStatus === 'completed' ? manga.chapters : 0),
    total_chapters:
      patch.total_chapters !== undefined ? patch.total_chapters : manga.chapters,
    volumes_read:
      patch.volumes_read !== undefined ? patch.volumes_read : existing?.volumes_read ?? null,
    total_volumes:
      patch.total_volumes !== undefined ? patch.total_volumes : manga.volumes,
    score: patch.score !== undefined ? patch.score : existing?.score ?? null,
    notes: patch.notes !== undefined ? patch.notes : existing?.notes ?? null,
    started_at:
      patch.started_at !== undefined
        ? patch.started_at
        : existing?.started_at ?? (finalStatus === 'reading' ? today() : null),
    finished_at:
      patch.finished_at !== undefined
        ? patch.finished_at
        : existing?.finished_at ?? (finalStatus === 'completed' ? today() : null),
    added_at: existing?.added_at ?? now,
    updated_at: now,
  };
  map[key] = entry;
  writeLocal(map);
  return entry;
}

export async function setStatus(
  userId: string | null | undefined,
  manga: MangaItem,
  status: ReadStatus,
): Promise<MangaTrackerEntry | null> {
  return upsertEntry(userId, manga, { status });
}

export async function removeEntry(
  userId: string | null | undefined,
  malId: number,
): Promise<void> {
  if (useRemote(userId)) {
    try {
      const { error } = await getSupabase()
        .from('manga_tracker')
        .delete()
        .eq('user_id', userId)
        .eq('mal_id', malId);
      if (error) throw error;
      emitChange();
      return;
    } catch (err) {
      console.warn('[mangaTracker] remote remove failed, falling back to local:', err);
    }
  }
  const map = readLocal();
  delete map[String(malId)];
  writeLocal(map);
}

/**
 * Subscribe to changes from this tab and other tabs.
 * Returns an unsubscribe function.
 */
export function subscribe(listener: () => void): () => void {
  if (!isBrowser()) return () => {};
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * One-time migration of any local entries into Supabase when a user signs in.
 * Safe to call repeatedly: tracks completion in localStorage per user-id.
 */
export async function migrateLocalToRemote(userId: string): Promise<number> {
  if (!isSupabaseConfigured || !isBrowser()) return 0;
  try {
    const synced = window.localStorage.getItem(PENDING_SYNC_KEY);
    if (synced === userId) return 0;
    const local = readLocal();
    const entries = Object.values(local);
    if (entries.length === 0) {
      window.localStorage.setItem(PENDING_SYNC_KEY, userId);
      return 0;
    }
    const rows = entries.map((e) => ({
      user_id: userId,
      mal_id: e.mal_id,
      title: e.title,
      image_url: e.image_url,
      type: e.type,
      status: e.status,
      chapters_read: e.chapters_read,
      total_chapters: e.total_chapters,
      volumes_read: e.volumes_read,
      total_volumes: e.total_volumes,
      score: e.score,
      notes: e.notes,
      started_at: e.started_at,
      finished_at: e.finished_at,
    }));
    const { error } = await getSupabase()
      .from('manga_tracker')
      .upsert(rows, { onConflict: 'user_id,mal_id', ignoreDuplicates: true });
    if (error) {
      console.warn('[mangaTracker] migration failed:', error.message);
      return 0;
    }
    window.localStorage.setItem(PENDING_SYNC_KEY, userId);
    emitChange();
    return rows.length;
  } catch (err) {
    console.warn('[mangaTracker] migration error:', err);
    return 0;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// UI metadata
// ---------------------------------------------------------------------------

export const STATUS_LABELS: Record<ReadStatus, string> = {
  plan: 'Plan to Read',
  reading: 'Reading',
  completed: 'Completed',
  dropped: 'Dropped',
};

export const STATUS_COLORS: Record<ReadStatus, string> = {
  plan: '#0ea5e9',
  reading: '#f97316',
  completed: '#22c55e',
  dropped: '#94a3b8',
};
