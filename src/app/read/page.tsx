'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  HiStar,
  HiMagnifyingGlass,
  HiPlus,
  HiCheck,
  HiBookOpen,
  HiClock,
  HiTrash,
  HiXMark,
  HiLockClosed,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { MangaItem } from '@/types';
import { getTopManga, searchManga, mangaImage } from '@/lib/jikan';
import {
  setStatus,
  removeEntry,
  getAllEntries,
  subscribe,
  migrateLocalToRemote,
  STATUS_LABELS,
  STATUS_COLORS,
  ReadStatus,
  MangaTrackerEntry,
} from '@/lib/mangaTracker';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Loader from '@/components/common/Loader';
import styles from './read.module.css';

type Category = 'manga' | 'manhwa' | 'manhua';
type RankFilter = 'top' | 'publishing' | 'upcoming' | 'bypopularity' | 'favorite';
type ViewMode = 'browse' | 'mylist';

const CATEGORIES: { key: Category; label: string; icon: string; desc: string }[] = [
  { key: 'manga', label: 'Manga', icon: '🇯🇵', desc: 'Japanese comics' },
  { key: 'manhwa', label: 'Manhwa', icon: '🇰🇷', desc: 'Korean comics' },
  { key: 'manhua', label: 'Manhua', icon: '🇨🇳', desc: 'Chinese comics' },
];

const RANK_FILTERS: { key: RankFilter; label: string }[] = [
  { key: 'top', label: 'Top Rated' },
  { key: 'bypopularity', label: 'Most Popular' },
  { key: 'publishing', label: 'Publishing Now' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'favorite', label: 'Most Favorited' },
];

const STATUS_OPTIONS: { key: ReadStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'plan', label: 'Plan to Read', icon: <HiClock size={14} /> },
  { key: 'reading', label: 'Reading', icon: <HiBookOpen size={14} /> },
  { key: 'completed', label: 'Completed', icon: <HiCheck size={14} /> },
  { key: 'dropped', label: 'Dropped', icon: <HiXMark size={14} /> },
];

function isCategory(v: string | null): v is Category {
  return v === 'manga' || v === 'manhwa' || v === 'manhua';
}
function isRankFilter(v: string | null): v is RankFilter {
  return v === 'top' || v === 'publishing' || v === 'upcoming' || v === 'bypopularity' || v === 'favorite';
}

function ReadPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const initialCategory = isCategory(searchParams.get('cat')) ? (searchParams.get('cat') as Category) : 'manga';
  const initialFilter = isRankFilter(searchParams.get('filter')) ? (searchParams.get('filter') as RankFilter) : 'top';
  const initialView: ViewMode = searchParams.get('view') === 'mylist' ? 'mylist' : 'browse';
  const initialQuery = searchParams.get('q') ?? '';

  const [category, setCategory] = useState<Category>(initialCategory);
  // While a search is active we don't apply the category filter automatically
  // — users found it confusing because changing the JP/KR/CN selection in
  // browse mode would silently exclude their search hits. Instead, search
  // returns ALL types by default and the user can opt in to narrow by
  // clicking a category card. Selection is per-search and resets whenever
  // the search query changes.
  const [searchTypeOverride, setSearchTypeOverride] = useState<Category | null>(null);
  const [rankFilter, setRankFilter] = useState<RankFilter>(initialFilter);
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  const [mangaList, setMangaList] = useState<MangaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // `loading` is used only when there are no items (full loader). For
  // subsequent fetches we keep results visible and use `refetching`.
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracker — async, refreshes on subscribe events
  const [trackerEntries, setTrackerEntries] = useState<MangaTrackerEntry[]>([]);
  const trackerMap = useMemo(() => {
    const m = new Map<number, MangaTrackerEntry>();
    trackerEntries.forEach((e) => m.set(e.mal_id, e));
    return m;
  }, [trackerEntries]);

  const refreshTracker = useCallback(async () => {
    const list = await getAllEntries(userId);
    setTrackerEntries(list);
  }, [userId]);

  useEffect(() => { void refreshTracker(); }, [refreshTracker]);
  useEffect(() => subscribe(() => { void refreshTracker(); }), [refreshTracker]);

  // One-time migration of local entries on first sign-in
  const migratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || migratedRef.current === userId) return;
    migratedRef.current = userId;
    migrateLocalToRemote(userId).then((n) => {
      if (n > 0) {
        toast.success(`Synced ${n} ${n === 1 ? 'entry' : 'entries'} to your account`);
        void refreshTracker();
      }
    });
  }, [userId, refreshTracker]);

  // If a logged-out user lands on /read?view=mylist via deep link, bounce
  // them back to Browse — My List is gated and shouldn't be openable.
  useEffect(() => {
    if (!userId && viewMode === 'mylist') setViewMode('browse');
  }, [userId, viewMode]);

  // URL sync
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== 'manga') params.set('cat', category);
    if (rankFilter !== 'top') params.set('filter', rankFilter);
    if (viewMode !== 'browse') params.set('view', viewMode);
    if (debouncedQuery) params.set('q', debouncedQuery);
    const qs = params.toString();
    router.replace(qs ? `/read?${qs}` : '/read', { scroll: false });
  }, [category, rankFilter, viewMode, debouncedQuery, router]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset the per-search category override whenever the active query changes.
  useEffect(() => { setSearchTypeOverride(null); }, [debouncedQuery]);

  useEffect(() => { setPage(1); }, [category, rankFilter, debouncedQuery, viewMode, searchTypeOverride]);

  const fetchIdRef = useRef(0);

  const fetchData = useCallback(
    async (targetPage: number, append: boolean) => {
      if (viewMode === 'mylist') return;
      const myFetchId = ++fetchIdRef.current;
      if (append) {
        setLoadingMore(true);
      } else if (mangaList.length === 0) {
        setLoading(true);
      } else {
        // Subsequent fetch with stale data on screen — show subtle bar.
        setRefetching(true);
      }
      setError(null);
      try {
        const topFilter = rankFilter === 'top' ? undefined : rankFilter;
        // Search: only narrow by type if the user explicitly clicked a card
        // during this search. Browse: use the persistent category selection.
        const searchType = searchTypeOverride ?? undefined;
        const res = debouncedQuery
          ? await searchManga(debouncedQuery, targetPage, searchType)
          : await getTopManga(targetPage, category, topFilter);
        if (myFetchId !== fetchIdRef.current) return;
        const data = res.data || [];
        setMangaList((prev) => (append ? [...prev, ...data] : data));
        setHasMore(Boolean(res.pagination?.has_next_page));
      } catch (err) {
        if (myFetchId !== fetchIdRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        if (myFetchId === fetchIdRef.current) {
          setLoading(false);
          setRefetching(false);
          setLoadingMore(false);
        }
      }
    },
    // mangaList.length intentionally omitted: we don't want a fetch loop, only
    // the snapshot at call time matters and is captured via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, rankFilter, debouncedQuery, viewMode, searchTypeOverride],
  );

  useEffect(() => {
    if (viewMode === 'browse') void fetchData(1, false);
  }, [fetchData, viewMode]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    void fetchData(next, true);
  };

  // Local optimistic helpers ------------------------------------------------
  const handleQuickStatus = async (manga: MangaItem, status: ReadStatus) => {
    const updated = await setStatus(userId, manga, status);
    if (updated) {
      // refreshTracker is also fired by subscribe(); this is just snappier.
      setTrackerEntries((prev) => {
        const next = prev.filter((e) => e.mal_id !== manga.mal_id);
        next.unshift(updated);
        return next;
      });
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
    }
  };

  const handleQuickRemove = async (malId: number) => {
    await removeEntry(userId, malId);
    setTrackerEntries((prev) => prev.filter((e) => e.mal_id !== malId));
  };

  // My List helpers — intentionally NOT filtered by the top category cards.
  // Those cards are a Browse-only affordance; if My List was filtered too, a
  // user who tracked one manhwa but had Manga selected would see an empty
  // list and assume their entry was lost. Showing everything here, with an
  // inline kind chip filter inside <MyList />, avoids that confusion.
  const myListItems = trackerEntries;

  const myListCounts = useMemo(() => {
    const counts: Record<Category, number> = { manga: 0, manhwa: 0, manhua: 0 };
    trackerEntries.forEach((e) => {
      const k = e.type.toLowerCase() as Category;
      if (k in counts) counts[k] += 1;
    });
    return counts;
  }, [trackerEntries]);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>Read</h1>
          <p className={styles.subtitle}>
            Track your manga, manhwa &amp; manhua{' '}
            {!userId && <span className={styles.signedOutHint}>· sign in to sync across devices</span>}
          </p>
        </motion.div>

        <div className={styles.categoryBoxes}>
          {CATEGORIES.map((c) => {
            const isSearching = Boolean(debouncedQuery);
            const isActive = isSearching
              ? searchTypeOverride === c.key
              : category === c.key;
            const handleClick = () => {
              if (isSearching) {
                // Toggle the per-search narrow filter.
                setSearchTypeOverride((prev) => (prev === c.key ? null : c.key));
              } else {
                setCategory(c.key);
              }
            };
            let tooltip: string | undefined;
            if (isSearching && isActive) tooltip = 'Click again to show all types';
            else if (isSearching) tooltip = `Click to narrow search to ${c.label} only`;
            return (
              <motion.button
                key={c.key}
                className={`${styles.categoryBox} ${isActive ? styles.active : ''}`}
                onClick={handleClick}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                title={tooltip}
              >
                <span className={styles.categoryIcon}>{c.icon}</span>
                <span className={styles.categoryLabel}>{c.label}</span>
                <span className={styles.categoryCount}>
                  {myListCounts[c.key] > 0
                    ? `${myListCounts[c.key]} in your list • ${c.desc}`
                    : c.desc}
                </span>
                <div className={styles.categoryGlow} />
              </motion.button>
            );
          })}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'browse' ? styles.viewActive : ''}`}
              onClick={() => setViewMode('browse')}
            >
              Browse
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'mylist' ? styles.viewActive : ''} ${userId ? '' : styles.viewBtnLocked}`}
              onClick={() => {
                if (!userId) {
                  toast('Sign in to track your reading list', { icon: '🔒' });
                  router.push('/login?next=/read');
                  return;
                }
                setViewMode('mylist');
              }}
              aria-disabled={!userId}
              title={userId ? undefined : 'Sign in to access your list'}
            >
              {!userId && <HiLockClosed size={14} className={styles.viewLockIcon} />}
              My List
              {userId && trackerEntries.length > 0 && (
                <span className={styles.viewBadge}>{trackerEntries.length}</span>
              )}
            </button>
          </div>

          {viewMode === 'browse' && (
            <div className={styles.searchWrapper}>
              <HiMagnifyingGlass size={16} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search manga, manhwa, or manhua..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <HiXMark size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className={styles.content}>
          <aside className={styles.sidebar}>
            {viewMode === 'browse' ? (
              <div className={styles.filterCard}>
                <div className={styles.filterTitle}>Ranking</div>
                {RANK_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={`${styles.filterOption} ${rankFilter === f.key ? styles.activeFilter : ''}`}
                    onClick={() => setRankFilter(f.key)}
                    disabled={Boolean(debouncedQuery)}
                    title={debouncedQuery ? 'Clear search to use ranking filters' : ''}
                  >
                    <span className={styles.filterDot} />
                    {f.label}
                  </button>
                ))}
                {debouncedQuery && (
                  <p className={styles.filterHint}>
                    Showing search results for &ldquo;{debouncedQuery}&rdquo;
                    {searchTypeOverride
                      ? ` · narrowed to ${searchTypeOverride}`
                      : ' · click JP / KR / CN above to narrow by type'}
                  </p>
                )}
              </div>
            ) : (
              <div className={styles.filterCard}>
                <div className={styles.filterTitle}>Status Summary</div>
                {STATUS_OPTIONS.map((s) => {
                  const count = myListItems.filter((i) => i.status === s.key).length;
                  return (
                    <div key={s.key} className={styles.statusRow}>
                      <span className={styles.statusDotLg} style={{ background: STATUS_COLORS[s.key] }} />
                      <span className={styles.statusRowLabel}>{s.label}</span>
                      <span className={styles.statusRowCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </aside>

          <div className={styles.mainList}>
            {/* Subtle top progress bar shown only during refetch with prior data on-screen */}
            {refetching && <div className={styles.refetchBar} aria-hidden="true" />}

            {renderMainPanel({
              viewMode,
              userId,
              browseProps: {
                items: mangaList,
                loading,
                refetching,
                loadingMore,
                error,
                hasMore,
                onRetry: () => fetchData(1, false),
                onLoadMore: loadMore,
                trackerMap,
                onSetStatus: handleQuickStatus,
                onRemove: handleQuickRemove,
              },
              myListProps: { items: myListItems, onRemove: handleQuickRemove },
              onSignIn: () => router.push('/login?next=/read'),
              onBrowse: () => setViewMode('browse'),
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function LockedMyList({ onSignIn, onBrowse }: Readonly<{ onSignIn: () => void; onBrowse: () => void }>) {
  return (
    <motion.div
      className={styles.lockedPanel}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={styles.lockedIcon} aria-hidden="true">
        <HiLockClosed size={36} />
      </div>
      <h3 className={styles.lockedTitle}>Your reading list is locked</h3>
      <p className={styles.lockedText}>
        Sign in to track manga, manhwa &amp; manhua across devices, save your
        progress and pick up where you left off.
      </p>
      <div className={styles.lockedActions}>
        <button className={styles.lockedPrimary} onClick={onSignIn}>
          Sign in
        </button>
        <button className={styles.lockedSecondary} onClick={onBrowse}>
          Keep browsing
        </button>
      </div>
    </motion.div>
  );
}

type BrowseListProps = React.ComponentProps<typeof BrowseList>;
type MyListProps = React.ComponentProps<typeof MyList>;

function renderMainPanel(args: {
  viewMode: ViewMode;
  userId: string | null;
  browseProps: BrowseListProps;
  myListProps: MyListProps;
  onSignIn: () => void;
  onBrowse: () => void;
}) {
  if (args.viewMode === 'browse') return <BrowseList {...args.browseProps} />;
  if (args.userId) return <MyList {...args.myListProps} />;
  return <LockedMyList onSignIn={args.onSignIn} onBrowse={args.onBrowse} />;
}

function BrowseList({
  items,
  loading,
  refetching,
  loadingMore,
  error,
  hasMore,
  onRetry,
  onLoadMore,
  trackerMap,
  onSetStatus,
  onRemove,
}: Readonly<{
  items: MangaItem[];
  loading: boolean;
  refetching: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  trackerMap: Map<number, MangaTrackerEntry>;
  onSetStatus: (m: MangaItem, s: ReadStatus) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}>) {
  if (loading && items.length === 0) return <Loader />;
  if (error && items.length === 0) {
    return (
      <div className={styles.errorMsg}>
        <p>{error}</p>
        <button className={styles.retryBtn} onClick={onRetry}>Retry</button>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📚</div>
        <p>No results found. Try a different search or filter.</p>
      </div>
    );
  }

  return (
    <>
      <div className={`${styles.grid} ${refetching ? styles.gridDimmed : ''}`}>
        {items.map((manga, i) => (
          <MangaCard
            key={manga.mal_id}
            manga={manga}
            index={i}
            existingEntry={trackerMap.get(manga.mal_id) ?? null}
            onSetStatus={onSetStatus}
            onRemove={onRemove}
          />
        ))}
      </div>
      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <button className={styles.loadMoreBtn} onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </>
  );
}

function MyList({
  items,
  onRemove,
}: Readonly<{
  items: MangaTrackerEntry[];
  onRemove: (id: number) => Promise<void>;
}>) {
  type KindFilter = 'all' | Category;
  const [kind, setKind] = useState<KindFilter>('all');

  // Per-kind counts so the chip labels show how much sits behind each filter.
  // Anything that isn't recognised as manga/manhwa/manhua falls back into
  // 'manga' so it still appears under the All view.
  const counts = useMemo(() => {
    const c: Record<KindFilter, number> = { all: items.length, manga: 0, manhwa: 0, manhua: 0 };
    for (const e of items) {
      const k = e.type.toLowerCase();
      if (k === 'manga' || k === 'manhwa' || k === 'manhua') c[k]++;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (kind === 'all') return items;
    const target = kind.charAt(0).toUpperCase() + kind.slice(1);
    return items.filter((e) => e.type === target);
  }, [items, kind]);

  const KIND_CHIPS: ReadonlyArray<{ key: KindFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'manga', label: 'Manga' },
    { key: 'manhwa', label: 'Manhwa' },
    { key: 'manhua', label: 'Manhua' },
  ];

  if (items.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>📖</div>
        <p>Nothing tracked yet.</p>
        <p className={styles.emptyHint}>
          Switch to <strong>Browse</strong> and tap the + on any title to start tracking.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.kindFilter} role="tablist" aria-label="Filter tracked titles by kind">
        {KIND_CHIPS.map((c) => {
          const count = counts[c.key];
          const disabled = c.key !== 'all' && count === 0;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={kind === c.key}
              disabled={disabled}
              className={`${styles.kindChip} ${kind === c.key ? styles.kindChipActive : ''}`}
              onClick={() => setKind(c.key)}
            >
              {c.label}
              <span className={styles.kindChipCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📖</div>
          <p>No {kind} tracked yet.</p>
          <p className={styles.emptyHint}>
            Tap <strong>All</strong> above to see everything you&apos;re tracking.
          </p>
        </div>
      ) : (
        <div className={styles.myListGrid}>
          {items.map((entry) => (
            <div key={entry.mal_id} className={styles.myListRow}>
              <Link href={`/read/${entry.mal_id}`} className={styles.myListThumb}>
                {entry.image_url && (
                  <Image
                    src={entry.image_url}
                    alt={entry.title}
                    fill
                    sizes="60px"
                    className={styles.poster}
                  />
                )}
              </Link>
              <div className={styles.myListInfo}>
                <Link href={`/read/${entry.mal_id}`} className={styles.myListTitle}>
                  {entry.title}
                </Link>
                <div className={styles.myListMeta}>
                  <span className={styles.statusPill} style={{ background: STATUS_COLORS[entry.status] }}>
                    {STATUS_LABELS[entry.status]}
                  </span>
                  {entry.total_chapters && (
                    <span className={styles.myListChapters}>
                      {entry.chapters_read ?? 0} / {entry.total_chapters} ch
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.myListActions}>
                <Link
                  href={`/read/${entry.mal_id}`}
                  className={styles.iconBtn}
                  title="Open details"
                >
                  <HiBookOpen size={14} />
                </Link>
                <button
                  className={styles.iconBtn}
                  onClick={() => onRemove(entry.mal_id)}
                  title="Remove from list"
                >
                  <HiTrash size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function MangaCard({
  manga,
  index,
  existingEntry,
  onSetStatus,
  onRemove,
}: Readonly<{
  manga: MangaItem;
  index: number;
  existingEntry: MangaTrackerEntry | null;
  onSetStatus: (m: MangaItem, s: ReadStatus) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}>) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const tracked = Boolean(existingEntry);
  const detailHref = `/read/${manga.mal_id}`;

  return (
    <motion.div
      className={`${styles.mangaCard} ${tracked ? styles.cardTracked : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.4) }}
      whileHover={{ y: -6 }}
    >
      <div className={styles.imageWrapper}>
        <Link href={detailHref} className={styles.posterLink}>
          <Image
            src={mangaImage(manga)}
            alt={manga.title_english || manga.title}
            fill
            sizes="(max-width: 640px) 45vw, 200px"
            className={styles.poster}
          />
        </Link>
        {manga.score && (
          <div className={styles.scoreBadge}>
            <HiStar size={12} />
            <span>{manga.score}</span>
          </div>
        )}
        <div className={styles.typeBadge}>{manga.type}</div>
        {existingEntry && (
          <div
            className={styles.trackedBadge}
            style={{ background: STATUS_COLORS[existingEntry.status] }}
          >
            {STATUS_LABELS[existingEntry.status]}
          </div>
        )}

        <div className={styles.trackerControl} ref={menuRef}>
          <button
            className={`${styles.trackBtn} ${tracked ? styles.trackBtnActive : ''}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={tracked ? 'Update status' : 'Add to list'}
          >
            {tracked ? <HiCheck size={16} /> : <HiPlus size={16} />}
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                className={styles.trackMenu}
                initial={{ opacity: 0, scale: 0.9, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -4 }}
                transition={{ duration: 0.12 }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.key}
                    className={`${styles.trackMenuItem} ${existingEntry?.status === s.key ? styles.trackMenuItemActive : ''}`}
                    onClick={() => { void onSetStatus(manga, s.key); setMenuOpen(false); }}
                  >
                    <span style={{ color: STATUS_COLORS[s.key] }}>{s.icon}</span>
                    {s.label}
                  </button>
                ))}
                {tracked && (
                  <button
                    className={styles.trackMenuRemove}
                    onClick={() => { void onRemove(manga.mal_id); setMenuOpen(false); }}
                  >
                    <HiTrash size={14} /> Remove
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className={styles.info}>
        <Link href={detailHref} className={styles.mangaTitle}>
          {manga.title_english || manga.title}
        </Link>
        <div className={styles.meta}>
          {manga.chapters && <span>{manga.chapters} ch</span>}
          {manga.volumes && <span>{manga.volumes} vol</span>}
          {manga.status && <span>{manga.status}</span>}
        </div>
        <div className={styles.genres}>
          {manga.genres.slice(0, 3).map((g) => (
            <span key={g.mal_id} className={styles.genreTag}>{g.name}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<Loader />}>
      <ReadPageInner />
    </Suspense>
  );
}