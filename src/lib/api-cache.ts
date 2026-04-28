const CACHE_PREFIX = 'viewtopia_api_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

// In-memory cache for instant reads (lost on full page reload)
const memCache = new Map<string, CacheEntry<unknown>>();

function getStorage(persistent: boolean): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readFromStorage<T>(key: string, persistent: boolean): T | null {
  const storage = getStorage(persistent);
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiry) {
      storage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeToStorage<T>(key: string, data: T, ttl: number, persistent: boolean): void {
  const storage = getStorage(persistent);
  if (!storage) return;
  const entry: CacheEntry<T> = { data, expiry: Date.now() + ttl };
  try {
    storage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full or unavailable — memory-only cache still works
  }
}

/**
 * Wraps an async fetcher with TTL-based caching.
 *
 * Lookup order: in-memory → storage → fetcher.
 * Concurrent calls for the same key are deduplicated.
 *
 * @param persistent  When true, the entry is mirrored to localStorage so it
 *                    survives full page reloads and tab restarts. Use this
 *                    for slow-changing public data (trending, popular, etc.).
 *                    When false (default), uses sessionStorage.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL,
  persistent: boolean = false,
): Promise<T> {
  // 1. Check in-memory cache
  const mem = memCache.get(key);
  if (mem && Date.now() < mem.expiry) {
    return mem.data as T;
  }

  // 2. Check storage
  const stored = readFromStorage<T>(key, persistent);
  if (stored !== null) {
    memCache.set(key, { data: stored, expiry: Date.now() + ttl });
    return stored;
  }

  // 3. Deduplicate concurrent requests for the same key
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // 4. Fetch, cache, return
  const promise = fetcher().then((data) => {
    const entry: CacheEntry<unknown> = { data, expiry: Date.now() + ttl };
    memCache.set(key, entry);
    writeToStorage(key, data, ttl, persistent);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/** Clear all cached API data from memory + both storages. */
export function clearApiCache(): void {
  memCache.clear();
  for (const persistent of [false, true]) {
    const storage = getStorage(persistent);
    if (!storage) continue;
    try {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    } catch {
      // ignore
    }
  }
}
