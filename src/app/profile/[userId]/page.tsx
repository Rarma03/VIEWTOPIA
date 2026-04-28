'use client';

import { use, useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  HiStar, HiXMark, HiFilm, HiTv, HiSparkles, HiFunnel, HiArrowLeft, HiHeart,
  HiClock, HiEye, HiShieldCheck, HiPlay, HiBookmark, HiHandRaised,
  HiRectangleStack, HiTrophy, HiQueueList, HiMegaphone, HiArrowsPointingOut,
  HiChatBubbleLeft, HiFire, HiBolt, HiGlobeAlt, HiHandThumbUp, HiHandThumbDown,
  HiShare, HiFolderOpen, HiArchiveBox, HiClipboardDocumentList, HiPencilSquare,
  HiSpeakerWave, HiAcademicCap, HiXCircle, HiSquares2X2, HiDocumentText,
  HiUserGroup, HiBuildingLibrary, HiClipboard, HiCalendarDays, HiChartBar,
  HiNoSymbol, HiArrowDownTray, HiLockClosed, HiBookOpen,
} from 'react-icons/hi2';
import {
  getWatchlist, getActivity, getRecommendations,
  getRatings, isPremiumUser,
  updateWatchlistItem, removeFromWatchlist,
} from '@/lib/store';
import { exportWatchlist, PREMIUM_EXPORT_FORMATS, type ExportFormat } from '@/lib/export';
import { ALL_BADGES } from '@/lib/badges';
import { WatchlistItem, ActivityItem, WatchStatus, Collection, UserBadge, MediaType, User } from '@/types';
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase';
import {
  getAllEntries as getMangaEntries,
  subscribe as subscribeMangaTracker,
  STATUS_LABELS as MANGA_STATUS_LABELS,
  STATUS_COLORS as MANGA_STATUS_COLORS,
  ReadStatus as MangaReadStatus,
  MangaTrackerEntry,
} from '@/lib/mangaTracker';
import { tmdbImage } from '@/lib/tmdb';
import { MEDIA_TYPE_LABELS, WATCH_STATUS_LABELS } from '@/lib/constants';
import WatchlistCard from '@/components/watchlist/WatchlistCard';
import FriendButton from '@/components/common/FriendButton';
import CategoryRings from '@/components/profile/CategoryRings/CategoryRings';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { encodeCollection, getShareUrl } from '@/lib/share';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import styles from './profile.module.css';

// ─── Constants ───
const RATING_COLORS = [
  '', '#ef4444', '#f97316', '#f97316', '#eab308', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#06b6d4', '#8b5cf6',
];

const BADGE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  HiPlay, HiBookmark, HiStar, HiFilm, HiTv, HiSparkles, HiHandRaised,
  HiHeart, HiRectangleStack, HiTrophy, HiQueueList, HiMegaphone,
  HiArrowsPointingOut, HiChatBubbleLeft, HiFire, HiBolt, HiGlobeAlt,
  HiHandThumbUp, HiHandThumbDown, HiShare, HiFolderOpen, HiArchiveBox,
  HiClipboardDocumentList, HiPencilSquare, HiSpeakerWave, HiEye,
  HiAcademicCap, HiXCircle, HiSquares2X2, HiDocumentText, HiShieldCheck,
  HiUserGroup, HiBuildingLibrary,
};

const BUNDLE_COLORS = [
  ['#e50914', '#ff4757'], ['#8b5cf6', '#a78bfa'], ['#06b6d4', '#22d3ee'],
  ['#f59e0b', '#fbbf24'], ['#10b981', '#34d399'], ['#ec4899', '#f472b6'],
];

/** Watchlist export formats shown in the Download menu. PDF is free; the rest are Premium. */
const EXPORT_OPTIONS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'pdf', label: 'PDF (.pdf)' },
  { format: 'md', label: 'Markdown (.md)' },
  { format: 'txt', label: 'Plain Text (.txt)' },
  { format: 'csv', label: 'CSV (.csv)' },
  { format: 'json', label: 'JSON (.json)' },
];

type ProfileTab = 'watched' | 'mylist' | 'reading' | 'collections' | 'activity';

const MANGA_STATUS_OPTIONS: ReadonlyArray<MangaReadStatus> = ['plan', 'reading', 'completed', 'dropped'];

type GraphRange = '6m' | '1y' | 'all';

// ─── Watch Activity Graph (SVG) ───
function WatchGraph({ items, mangaEntries }: Readonly<{ items: WatchlistItem[]; mangaEntries: MangaTrackerEntry[] }>) {
  const [range, setRange] = useState<GraphRange>('6m');

  const monthlyData = useMemo(() => {
    const now = new Date();
    let monthCount: number;
    if (range === '6m') monthCount = 6;
    else if (range === '1y') monthCount = 12;
    else {
      // 'all' — find earliest watched_date or manga finished_at
      const watchDates = items.filter((it) => it.status === 'watched' && it.watched_date).map((it) => new Date(it.watched_date!));
      const mangaDates = mangaEntries.filter((e) => e.finished_at).map((e) => new Date(e.finished_at!));
      const dates = [...watchDates, ...mangaDates];
      if (dates.length === 0) monthCount = 6;
      else {
        const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
        monthCount = Math.max((now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth() + 1, 6);
      }
    }

    const months: { label: string; movie: number; tv: number; anime: number; books: number }[] = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        label: d.toLocaleString('default', { month: 'short' }) + (monthCount > 12 ? ` '${String(d.getFullYear()).slice(2)}` : ''),
        movie: 0, tv: 0, anime: 0, books: 0,
      });
    }
    items.filter((it) => it.status === 'watched' && it.watched_date).forEach((it) => {
      const wd = new Date(it.watched_date!);
      for (let mi = 0; mi < months.length; mi++) {
        const refDate = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - mi), 1);
        if (wd.getFullYear() === refDate.getFullYear() && wd.getMonth() === refDate.getMonth()) {
          if (it.media_type === 'movie') months[mi].movie++;
          else if (it.media_type === 'tv') months[mi].tv++;
          else months[mi].anime++;
        }
      }
    });
    // Manga: count entries finished in each month (mirrors "watched" semantics).
    mangaEntries.filter((e) => e.finished_at).forEach((e) => {
      const fd = new Date(e.finished_at!);
      for (let mi = 0; mi < months.length; mi++) {
        const refDate = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - mi), 1);
        if (fd.getFullYear() === refDate.getFullYear() && fd.getMonth() === refDate.getMonth()) {
          months[mi].books++;
        }
      }
    });
    return months;
  }, [items, mangaEntries, range]);

  const maxVal = Math.max(...monthlyData.flatMap((m) => [m.movie, m.tv, m.anime, m.books]), 1);
  const W = 500, H = 180, PL = 30, PR = 10, PT = 15, PB = 30;
  const gW = W - PL - PR, gH = H - PT - PB;

  const makePath = (key: 'movie' | 'tv' | 'anime' | 'books') => {
    return monthlyData.map((m, i) => {
      const x = PL + (i / Math.max(monthlyData.length - 1, 1)) * gW;
      const y = PT + gH - (m[key] / maxVal) * gH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  };

  const makeArea = (key: 'movie' | 'tv' | 'anime' | 'books') => {
    const points = monthlyData.map((m, i) => {
      const x = PL + (i / Math.max(monthlyData.length - 1, 1)) * gW;
      const y = PT + gH - (m[key] / maxVal) * gH;
      return { x, y };
    });
    const first = points[0], last = points[points.length - 1];
    return `M${first.x},${first.y} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${last.x},${PT + gH} L${first.x},${PT + gH} Z`;
  };

  const lines = [
    { key: 'movie' as const, color: '#e50914', label: 'Movies' },
    { key: 'tv' as const, color: '#00d4ff', label: 'TV Shows' },
    { key: 'anime' as const, color: '#a855f7', label: 'Anime' },
    { key: 'books' as const, color: '#f97316', label: 'Manga' },
  ];

  // Y-axis grid lines
  const yTicks = Array.from({ length: 4 }, (_, i) => Math.round((maxVal / 3) * i));

  return (
    <div className={styles.graphSection}>
      <div className={styles.graphHeader}>
        <h2 className={styles.sectionTitle}><HiChartBar size={18} /> Watch Activity</h2>
        <div className={styles.graphControls}>
          <div className={styles.rangeTabs}>
            {([['6m', '6 Months'], ['1y', '1 Year'], ['all', 'All Time']] as const).map(([val, label]) => (
              <button key={val} className={`${styles.rangeTab} ${range === val ? styles.rangeTabActive : ''}`} onClick={() => setRange(val)}>{label}</button>
            ))}
          </div>
          <div className={styles.graphLegend}>
            {lines.map((l) => (
              <span key={l.key} className={styles.legendItem}>
                <span className={styles.legendDot} style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.graphSvg} preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yTicks.map((tick, idx) => {
          const y = PT + gH - (tick / maxVal) * gH;
          return (
            <g key={`tick-${idx}`}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
              <text x={PL - 5} y={y + 3} textAnchor="end" fill="rgba(232,237,245,0.3)" fontSize={9}>{tick}</text>
            </g>
          );
        })}
        {/* X labels */}
        {monthlyData.map((m, i) => {
          const x = PL + (i / Math.max(monthlyData.length - 1, 1)) * gW;
          return <text key={`xl-${i}`} x={x} y={H - 5} textAnchor="middle" fill="rgba(232,237,245,0.4)" fontSize={10}>{m.label}</text>;
        })}
        {/* Area fills */}
        {lines.map((l) => (
          <path key={`area-${l.key}`} d={makeArea(l.key)} fill={`${l.color}10`} />
        ))}
        {/* Lines */}
        {lines.map((l) => (
          <path key={`line-${l.key}`} d={makePath(l.key)} fill="none" stroke={l.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {/* Dots */}
        {lines.map((l) =>
          monthlyData.map((m, i) => {
            const x = PL + (i / Math.max(monthlyData.length - 1, 1)) * gW;
            const y = PT + gH - (m[l.key] / maxVal) * gH;
            if (m[l.key] === 0) return null;
            return <circle key={`dot-${l.key}-${i}`} cx={x} cy={y} r={3} fill={l.color} stroke="#0c1019" strokeWidth={1.5} />;
          })
        )}
      </svg>
    </div>
  );
}

// ─── Taste Match ───
function calcTasteMatch(userAItems: WatchlistItem[], userBItems: WatchlistItem[]): number {
  const setA = new Set(userAItems.filter((i) => i.status === 'watched').map((i) => `${i.media_type}-${i.media_id}`));
  const setB = new Set(userBItems.filter((i) => i.status === 'watched').map((i) => `${i.media_type}-${i.media_id}`));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((key) => { if (setB.has(key)) intersection++; });
  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

// ─── Main Component ───
export default function ProfilePage({ params }: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { userId } = use(params);
  return <ProfileView userId={userId} />;
}

export function ProfileView({ userId }: Readonly<{ userId: string }>) {
  const { isDark } = useTheme();
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<ProfileTab>('watched');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<WatchStatus | 'all'>('all');
  const [allItems, setAllItems] = useState<WatchlistItem[]>([]);
  const [allActivity, setAllActivity] = useState<ActivityItem[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [copied, setCopied] = useState(false);
  const [tasteMatch, setTasteMatch] = useState<number | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [premium, setPremium] = useState(false);
  const [mangaEntries, setMangaEntries] = useState<MangaTrackerEntry[]>([]);
  const [mangaStatusFilter, setMangaStatusFilter] = useState<MangaReadStatus | 'all'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = currentUser?.id === userId;

  // Pretty URL: when we know the username, swap the URL bar to /u/{username}
  // without triggering a navigation. This keeps the UUID out of the address bar
  // for any inbound /profile/{id} link.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const username = profileUser?.username;
    if (!username) return;
    const desired = `/u/${username}`;
    if (window.location.pathname !== desired) {
      window.history.replaceState(null, '', desired + window.location.search + window.location.hash);
    }
  }, [profileUser?.username]);

  // Load the viewed user's profile from Supabase (or use the cached current
  // user when viewing your own profile).
  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);

    if (isOwnProfile && currentUser) {
      setProfileUser(currentUser);
      setProfileLoading(false);
      return;
    }

    if (!isSupabaseConfigured) {
      setProfileUser(null);
      setProfileLoading(false);
      return;
    }

    (async () => {
      const { data } = await getSupabase()
        .from('profiles')
        .select('id, email, username, display_name, avatar_url, city, is_premium, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setProfileUser({
          id: data.id,
          email: data.email ?? '',
          username: data.username ?? '',
          display_name: data.display_name ?? (data.email?.split('@')[0] ?? ''),
          avatar_url: data.avatar_url,
          city: data.city,
          is_premium: !!data.is_premium,
          created_at: data.created_at,
          updated_at: data.updated_at,
        });
      } else {
        setProfileUser(null);
      }
      setProfileLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId, isOwnProfile, currentUser]);

  const refresh = useCallback(async () => {
    const [items, ratings] = await Promise.all([
      getWatchlist(userId),
      getRatings({ userId }),
    ]);
    const ratingMap = new Map(ratings.map((r) => [`${r.media_type}:${r.media_id}`, r.rating]));
    setAllItems(items.map((it) => ({
      ...it,
      user_rating: ratingMap.get(`${it.media_type}:${it.media_id}`) ?? null,
    })));
  }, [userId]);

  useEffect(() => {
    void refresh();
    void getActivity(userId).then(setAllActivity);
    setUserBadges([]);
    setCollections([]);
    if (currentUser && currentUser.id !== userId) {
      void Promise.all([
        getWatchlist(currentUser.id),
        getWatchlist(userId),
      ]).then(([mine, theirs]) => setTasteMatch(calcTasteMatch(mine, theirs)));
    }
  }, [userId, currentUser, refresh]);

  const [recCount, setRecCount] = useState(0);
  useEffect(() => {
    void getRecommendations(userId).then((r) => setRecCount(r.length));
  }, [userId]);

  // Manga tracker entries (only meaningful for the profile owner since
  // mangaTracker uses the *current* viewer's storage when remote sync is off).
  const refreshMangaEntries = useCallback(async () => {
    if (!isOwnProfile) { setMangaEntries([]); return; }
    const list = await getMangaEntries(userId);
    setMangaEntries(list);
  }, [isOwnProfile, userId]);
  useEffect(() => { void refreshMangaEntries(); }, [refreshMangaEntries]);
  useEffect(() => subscribeMangaTracker(() => { void refreshMangaEntries(); }), [refreshMangaEntries]);

  // ─── Derived data ───
  const watchedItems = useMemo(() => allItems.filter((i) => i.status === 'watched'), [allItems]);
  const watchingItems = useMemo(() => allItems.filter((i) => i.status === 'watching'), [allItems]);
  const watchlistItems = useMemo(() => allItems.filter((i) => i.status === 'watchlist'), [allItems]);
  const ratedItems = useMemo(() => watchedItems.filter((i) => i.user_rating != null), [watchedItems]);

  const totalWatched = watchedItems.length;
  const avgRating = ratedItems.length > 0
    ? (ratedItems.reduce((s, i) => s + (i.user_rating || 0), 0) / ratedItems.length).toFixed(1)
    : '—';

  const distribution = useMemo(() => {
    const counts = Array(11).fill(0);
    ratedItems.forEach((item) => {
      const bucket = Math.round(item.user_rating!);
      if (bucket >= 1 && bucket <= 10) counts[bucket]++;
    });
    return counts;
  }, [ratedItems]);

  const maxCount = Math.max(...distribution.slice(1), 1);

  const filteredWatched = useMemo(() => {
    let items = ratedItems;
    if (selectedRating !== null) items = items.filter((i) => Math.round(i.user_rating!) === selectedRating);
    if (typeFilter) items = items.filter((i) => i.media_type === typeFilter);
    return items;
  }, [ratedItems, selectedRating, typeFilter]);

  const filteredMyList = useMemo(() => {
    if (statusFilter === 'all') return allItems;
    return allItems.filter((i) => i.status === statusFilter);
  }, [allItems, statusFilter]);

  const myListCounts = useMemo(() => ({
    all: allItems.length,
    watchlist: watchlistItems.length,
    watching: watchingItems.length,
    watched: watchedItems.length,
    dropped: allItems.filter((i) => i.status === 'dropped').length,
  }), [allItems, watchlistItems, watchingItems, watchedItems]);

  // ─── Premium status (controls which export formats are unlocked) ───
  useEffect(() => {
    if (!currentUser || !isOwnProfile) { setPremium(false); return; }
    let cancelled = false;
    void isPremiumUser(currentUser.id).then((v) => { if (!cancelled) setPremium(v); });
    return () => { cancelled = true; };
  }, [currentUser, isOwnProfile]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExportList = (format: ExportFormat) => {
    if (!currentUser) {
      toast.error('Sign in to download a list');
      setShowExportMenu(false);
      return;
    }
    if (PREMIUM_EXPORT_FORMATS.has(format) && !premium) {
      toast.error(`${format.toUpperCase()} export is a Premium feature`);
      setShowExportMenu(false);
      router.push('/premium');
      return;
    }
    try {
      const ownerName = profileUser?.display_name || profileUser?.username || 'User';
      exportWatchlist(filteredMyList, ownerName, format);
      toast.success(`Exported as .${format}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
    setShowExportMenu(false);
  };

  // ─── Handlers ───
  const handleBarClick = (r: number) => setSelectedRating((p) => (p === r ? null : r));
  const clearFilter = () => { setSelectedRating(null); setTypeFilter(null); };
  const getHref = (item: WatchlistItem) => {
    if (item.media_type === 'anime') return `/anime/${item.media_id}`;
    if (item.media_type === 'tv') return `/tv/${item.media_id}`;
    return `/movies/${item.media_id}`;
  };

  const handleUpdateStatus = async (id: string, status: WatchStatus) => {
    await updateWatchlistItem(id, { status }); void refresh(); toast.success(`Moved to ${WATCH_STATUS_LABELS[status]}`);
  };
  const handleRate = async (id: string, rating: number) => {
    await updateWatchlistItem(id, { status: 'watched' }); void refresh(); toast.success(`Rated ${rating}/10`);
  };
  const handleRemove = async (id: string) => {
    await removeFromWatchlist(id); void refresh(); toast.success('Removed');
  };
  const handleUpdateDate = async (id: string, date: string | null) => {
    await updateWatchlistItem(id, { watched_date: date }); void refresh(); toast.success(date ? 'Date updated' : 'Date cleared');
  };

  const shareProfile = () => {
    if (!profileUser) return;
    const url = `${window.location.origin}/u/${profileUser.username}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Profile link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── Colors ───
  // Deterministic palette pick based on the user id (no DEMO_USERS lookup).
  const colorIdx = useMemo(() => {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
    return h % BUNDLE_COLORS.length;
  }, [userId]);
  const [c1, c2] = BUNDLE_COLORS[colorIdx];

  if (profileLoading) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <div className={styles.empty}><p>Loading…</p></div>
        </div>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <div className={styles.empty}>
            <p>User not found.</p>
            <Link href="/" className={styles.backLink}>Go Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const joinDate = new Date(profileUser.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // ─── Unlocked badges ───
  const unlockedBadges = ALL_BADGES.filter((b) => {
    const ub = userBadges.find((u) => u.badge_id === b.id);
    return ub && ub.progress >= 100;
  });

  // ─── Tab configs ───
  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'watched', label: 'Watched', icon: <HiEye size={16} />, count: totalWatched },
    { key: 'mylist', label: 'My List', icon: <HiBookmark size={16} />, count: allItems.length },
    ...(isOwnProfile
      ? [{ key: 'reading' as ProfileTab, label: 'Reading', icon: <HiBookOpen size={16} />, count: mangaEntries.length }]
      : []),
    { key: 'collections', label: 'Collections', icon: <HiRectangleStack size={16} />, count: collections.length },
    { key: 'activity', label: 'Activity', icon: <HiClock size={16} />, count: allActivity.length },
  ];

  const filteredMangaEntries = mangaStatusFilter === 'all'
    ? mangaEntries
    : mangaEntries.filter((e) => e.status === mangaStatusFilter);
  const mangaStatusCounts: Record<MangaReadStatus | 'all', number> = {
    all: mangaEntries.length,
    plan: mangaEntries.filter((e) => e.status === 'plan').length,
    reading: mangaEntries.filter((e) => e.status === 'reading').length,
    completed: mangaEntries.filter((e) => e.status === 'completed').length,
    dropped: mangaEntries.filter((e) => e.status === 'dropped').length,
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      {/* ─── Hero ─── */}
      <div className={styles.hero} style={{ background: `linear-gradient(135deg, ${c1}18, ${c2}08)` }}>
        <div className={styles.heroInner}>
          <div className={styles.heroTop}>
            <Link href="/" className={styles.backBtn}><HiArrowLeft size={18} /> Back</Link>
            <button className={styles.shareBtn} onClick={shareProfile}>
              <HiClipboard size={16} /> {copied ? 'Copied!' : 'Share Profile'}
            </button>
          </div>

          <motion.div className={styles.profileInfo} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className={styles.avatar} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              {profileUser.display_name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.profileText}>
              <h1 className={styles.profileName}>{profileUser.display_name}</h1>
              <p className={styles.profileUsername}>@{profileUser.username}</p>
              <div className={styles.profileMeta}>
                <span className={styles.joinDate}><HiCalendarDays size={13} /> Joined {joinDate}</span>
                {isOwnProfile && <span className={styles.youBadge}>You</span>}
                {!isOwnProfile && <FriendButton targetUserId={userId} />}
                {tasteMatch !== null && (
                  <span className={styles.tasteBadge} style={{ color: tasteMatch > 50 ? '#10b981' : tasteMatch > 25 ? '#f59e0b' : '#ef4444' }}>
                    <HiHeart size={13} /> {tasteMatch}% taste match
                  </span>
                )}
              </div>
            </div>
          </motion.div>

          {/* Quick Stats */}
          <motion.div className={styles.heroStats} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className={styles.heroStat}>
              <HiEye size={16} />
              <span className={styles.heroStatValue}>{totalWatched}</span>
              <span className={styles.heroStatLabel}>Watched</span>
            </div>
            <div className={styles.heroStat}>
              <HiStar size={16} />
              <span className={styles.heroStatValue}>{avgRating}</span>
              <span className={styles.heroStatLabel}>Avg Rating</span>
            </div>
            <div className={styles.heroStat}>
              <HiHeart size={16} />
              <span className={styles.heroStatValue}>{recCount}</span>
              <span className={styles.heroStatLabel}>Recs</span>
            </div>
            <div className={styles.heroStat}>
              <HiClock size={16} />
              <span className={styles.heroStatValue}>{watchingItems.length}</span>
              <span className={styles.heroStatLabel}>Watching</span>
            </div>
            <div className={styles.heroStat}>
              <HiBookmark size={16} />
              <span className={styles.heroStatValue}>{watchlistItems.length}</span>
              <span className={styles.heroStatLabel}>In List</span>
            </div>
            {isOwnProfile && mangaEntries.length > 0 && (
              <div className={styles.heroStat}>
                <HiBookOpen size={16} />
                <span className={styles.heroStatValue}>{mangaEntries.length}</span>
                <span className={styles.heroStatLabel}>Reading</span>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      <div className={styles.container}>
        {/* ─── Library Progress Rings ─── */}
        <CategoryRings items={allItems} />

        {/* ─── Graph + Badges Row ─── */}
        <div className={styles.graphBadgesRow}>
          <div className={styles.graphCol}>
            <WatchGraph items={allItems} mangaEntries={mangaEntries} />
          </div>
          <div className={styles.badgesCol}>
            <motion.section className={styles.graphSection} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <div className={styles.badgesHeader}>
                <h2 className={styles.sectionTitle}><HiShieldCheck size={18} /> Badges</h2>
                <Link href="/badges" className={styles.viewAllBadges}>View all</Link>
              </div>
              <div className={styles.badgesGrid}>
                {unlockedBadges.slice(0, 8).map((badge) => {
                  const Icon = BADGE_ICON_MAP[badge.icon] || HiStar;
                  return (
                    <div key={badge.id} className={styles.profileBadge} title={`${badge.name} — ${badge.description}`}>
                      <div className={styles.profileBadgeIcon} style={{ background: `${badge.color}20`, borderColor: badge.color }}>
                        <Icon size={20} style={{ color: badge.color }} />
                      </div>
                      <span className={styles.profileBadgeName}>{badge.name}</span>
                    </div>
                  );
                })}
                {unlockedBadges.length > 8 && (
                  <Link href="/badges" className={styles.moreBadges}>+{unlockedBadges.length - 8} more</Link>
                )}
              </div>
              {unlockedBadges.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'rgba(232,237,245,0.4)', textAlign: 'center', padding: '1.5rem 0' }}>No badges unlocked yet</p>
              )}
            </motion.section>
          </div>
        </div>

        {/* ─── Currently Watching (always visible) ─── */}
        {watchingItems.length > 0 && (
          <motion.section className={styles.section} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <h2 className={styles.sectionTitle}><HiPlay size={18} /> Currently Watching</h2>
            <div className={styles.watchingGrid}>
              {watchingItems.map((item) => (
                <Link key={item.id} href={getHref(item)} className={styles.watchingCard}>
                  <div className={styles.watchingPoster}>
                    {item.poster_path ? (
                      <Image src={item.poster_path.startsWith('http') ? item.poster_path : tmdbImage(item.poster_path)} alt={item.title} fill sizes="100px" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className={styles.noPoster}><HiFilm size={20} /></div>
                    )}
                  </div>
                  <span className={styles.watchingTitle}>{item.title}</span>
                </Link>
              ))}
            </div>
          </motion.section>
        )}

        {/* ─── Tab Switcher ─── */}
        <div className={styles.tabBar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.count !== undefined && <span className={styles.tabCount}>{t.count}</span>}
            </button>
          ))}
        </div>

        {/* ─── Tab: Watched ─── */}
        {tab === 'watched' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="watched-tab">
            {totalWatched > 0 ? (
              <>
                {/* Rating Distribution */}
                <section className={styles.section}>
                  <h2 className={styles.sectionTitle}>Rating Distribution</h2>
                  <p className={styles.chartHint}>Click a bar to filter</p>
                  <div className={styles.chart}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => {
                      const count = distribution[rating];
                      const height = count > 0 ? (count / maxCount) * 100 : 4;
                      const isSelected = selectedRating === rating;
                      const isInactive = selectedRating !== null && !isSelected;
                      return (
                        <motion.div key={rating} className={`${styles.barCol} ${isSelected ? styles.barSelected : ''} ${isInactive ? styles.barInactive : ''}`}
                          onClick={() => handleBarClick(rating)} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <span className={styles.barCount}>{count || ''}</span>
                          <motion.div className={styles.bar} style={{ backgroundColor: RATING_COLORS[rating], boxShadow: isSelected ? `0 0 16px ${RATING_COLORS[rating]}60` : 'none' }}
                            initial={{ height: 0 }} animate={{ height: `${height}%` }} transition={{ duration: 0.6, delay: rating * 0.05, type: 'spring' }} />
                          <span className={styles.barLabel}><HiStar size={12} /> {rating}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </section>

                {/* Filter Bar */}
                <div className={styles.filterBar}>
                  <div className={styles.filterLeft}>
                    <HiFunnel size={16} />
                    <span className={styles.filterLabel}>
                      {selectedRating !== null || typeFilter ? `Showing ${filteredWatched.length} item${filteredWatched.length !== 1 ? 's' : ''}` : `All ${ratedItems.length} rated`}
                    </span>
                  </div>
                  <div className={styles.filterRight}>
                    {(['movie', 'tv', 'anime'] as MediaType[]).map((mt) => (
                      <button key={mt} className={styles.typePill} onClick={() => setTypeFilter(typeFilter === mt ? null : mt)}
                        style={typeFilter === mt ? { background: '#e50914', color: '#fff' } : {}}>
                        {mt === 'movie' ? <HiFilm size={14} /> : mt === 'tv' ? <HiTv size={14} /> : <HiSparkles size={14} />} {MEDIA_TYPE_LABELS[mt]}
                      </button>
                    ))}
                    {(selectedRating !== null || typeFilter) && (
                      <button className={styles.clearBtn} onClick={clearFilter}><HiXMark size={14} /> Clear</button>
                    )}
                  </div>
                </div>

                {/* Grid */}
                <AnimatePresence mode="popLayout">
                  <motion.div className={styles.grid} layout>
                    {filteredWatched.map((item, i) => (
                      <motion.div key={item.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ delay: i * 0.03 }}>
                        <Link href={getHref(item)} className={styles.card}>
                          <div className={styles.cardPoster}>
                            {item.poster_path ? (
                              <Image src={item.poster_path.startsWith('http') ? item.poster_path : tmdbImage(item.poster_path)} alt={item.title} fill sizes="180px" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div className={styles.noPoster}><HiFilm size={20} /></div>
                            )}
                            <div className={styles.ratingBadge} style={{ background: RATING_COLORS[Math.round(item.user_rating || 0)] }}>
                              <HiStar /> {item.user_rating}
                            </div>
                            <div className={styles.typeBadge}>{MEDIA_TYPE_LABELS[item.media_type]}</div>
                          </div>
                          <div className={styles.cardInfo}>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            {item.watched_date && <span className={styles.cardDate}>{new Date(item.watched_date).toLocaleDateString()}</span>}
                            {item.notes && <p className={styles.cardNote}>{item.notes}</p>}
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </>
            ) : (
              <div className={styles.empty}>
                <HiNoSymbol size={32} />
                <p>{profileUser.display_name} hasn&apos;t watched anything yet.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Tab: My List ─── */}
        {tab === 'mylist' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="mylist-tab">
            {/* Status filter tabs + Download */}
            <div className={styles.statusFilters}>
              {(['all', 'watchlist', 'watching', 'watched', 'dropped'] as const).map((st) => (
                <button key={st} className={`${styles.statusTab} ${statusFilter === st ? styles.statusActive : ''}`}
                  onClick={() => setStatusFilter(st)}>
                  <span>{st === 'all' ? 'All' : WATCH_STATUS_LABELS[st]}</span>
                  <span className={styles.tabCount}>{myListCounts[st]}</span>
                </button>
              ))}

              {isOwnProfile && allItems.length > 0 && (
                <div className={styles.exportWrap} ref={exportRef}>
                  <button
                    className={styles.exportBtn}
                    onClick={() => setShowExportMenu((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={showExportMenu}
                    title="Download your list"
                  >
                    <HiArrowDownTray /> Download
                  </button>
                  {showExportMenu && (
                    <div className={styles.exportMenu} role="menu">
                      {EXPORT_OPTIONS.map(({ format, label }) => {
                        const locked = PREMIUM_EXPORT_FORMATS.has(format) && !premium;
                        return (
                          <button
                            key={format}
                            role="menuitem"
                            onClick={() => handleExportList(format)}
                            className={locked ? styles.lockedItem : ''}
                          >
                            <span>{label}</span>
                            {locked && (
                              <span className={styles.lockBadge} title="Premium only">
                                <HiLockClosed /> PRO
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className={styles.myListGrid}>
              <AnimatePresence mode="popLayout">
                {filteredMyList.length === 0 ? (
                  <div className={styles.empty}>
                    <HiBookmark size={32} />
                    <p>No items yet.</p>
                  </div>
                ) : (
                  filteredMyList.map((item) => (
                    <WatchlistCard
                      key={item.id}
                      item={item}
                      onUpdateStatus={isOwnProfile ? handleUpdateStatus : undefined}
                      onRate={isOwnProfile ? handleRate : undefined}
                      onRemove={isOwnProfile ? handleRemove : undefined}
                      onUpdateDate={isOwnProfile ? handleUpdateDate : undefined}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ─── Tab: Collections ─── */}
        {tab === 'reading' && isOwnProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="reading-tab">
            <div className={styles.statusFilters}>
              <button
                className={`${styles.statusTab} ${mangaStatusFilter === 'all' ? styles.statusActive : ''}`}
                onClick={() => setMangaStatusFilter('all')}
              >
                <span>All</span>
                <span className={styles.tabCount}>{mangaStatusCounts.all}</span>
              </button>
              {MANGA_STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  className={`${styles.statusTab} ${mangaStatusFilter === s ? styles.statusActive : ''}`}
                  onClick={() => setMangaStatusFilter(s)}
                  style={mangaStatusFilter === s ? { background: `${MANGA_STATUS_COLORS[s]}1f`, color: MANGA_STATUS_COLORS[s] } : undefined}
                >
                  <span>{MANGA_STATUS_LABELS[s]}</span>
                  <span className={styles.tabCount}>{mangaStatusCounts[s]}</span>
                </button>
              ))}
            </div>

            {filteredMangaEntries.length === 0 ? (
              <div className={styles.empty}>
                <HiBookOpen size={32} />
                <p>{mangaEntries.length === 0 ? 'Nothing tracked yet.' : 'No items in this status.'}</p>
                {mangaEntries.length === 0 && (
                  <Link href="/read" className={styles.actionLink}>Browse manga</Link>
                )}
              </div>
            ) : (
              <div className={styles.grid}>
                {filteredMangaEntries.map((entry, i) => {
                  const pct = entry.total_chapters
                    ? Math.min(100, Math.round(((entry.chapters_read ?? 0) / entry.total_chapters) * 100))
                    : null;
                  return (
                    <motion.div
                      key={entry.mal_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    >
                      <Link href={`/read/${entry.mal_id}`} className={styles.card}>
                        <div className={styles.cardPoster}>
                          {entry.image_url ? (
                            <Image src={entry.image_url} alt={entry.title} fill sizes="180px" style={{ objectFit: 'cover' }} />
                          ) : (
                            <div className={styles.noPoster}><HiBookOpen size={20} /></div>
                          )}
                          <div className={styles.ratingBadge} style={{ background: MANGA_STATUS_COLORS[entry.status] }}>
                            {MANGA_STATUS_LABELS[entry.status]}
                          </div>
                          <div className={styles.typeBadge}>{entry.type}</div>
                        </div>
                        <div className={styles.cardInfo}>
                          <h3 className={styles.cardTitle}>{entry.title}</h3>
                          {entry.total_chapters != null ? (
                            <span className={styles.cardDate}>
                              {entry.chapters_read ?? 0} / {entry.total_chapters} ch{pct !== null ? ` · ${pct}%` : ''}
                            </span>
                          ) : (entry.chapters_read ?? 0) > 0 && (
                            <span className={styles.cardDate}>{entry.chapters_read} chapters read</span>
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Tab: Collections ─── */}
        {tab === 'collections' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="collections-tab">
            {collections.length === 0 ? (
              <div className={styles.empty}>
                <HiRectangleStack size={32} />
                <p>No collections yet.</p>
                {isOwnProfile && <Link href="/collections" className={styles.actionLink}>Create one</Link>}
              </div>
            ) : (
              <div className={styles.collectionsGrid}>
                {collections.map((col) => (
                  <div key={col.id} className={styles.collectionCard}>
                    <Link href="/collections" className={styles.collectionLink}>
                      <div className={styles.collectionPosters}>
                        {col.items.slice(0, 4).map((item, i) => (
                          <div key={i} className={styles.collectionThumb}>
                            {item.poster_path ? (
                              <Image src={item.poster_path.startsWith('http') ? item.poster_path : tmdbImage(item.poster_path)} alt="" fill sizes="60px" style={{ objectFit: 'cover' }} />
                            ) : (
                              <div className={styles.noPoster}><HiFilm size={14} /></div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className={styles.collectionInfo}>
                        <h3 className={styles.collectionName}>{col.name}</h3>
                        <span className={styles.collectionMeta}>{col.items.length} item{col.items.length !== 1 ? 's' : ''}</span>
                        {col.description && <p className={styles.collectionDesc}>{col.description}</p>}
                      </div>
                    </Link>
                    {col.items.length > 0 && (
                      <button
                        className={styles.collectionShareBtn}
                        onClick={() => {
                          const encoded = encodeCollection(profileUser.display_name, col);
                          const url = getShareUrl(encoded);
                          navigator.clipboard.writeText(url);
                          toast.success('Collection share link copied!');
                        }}
                      >
                        <HiShare size={14} /> Share
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── Tab: Activity ─── */}
        {tab === 'activity' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} key="activity-tab">
            {allActivity.length === 0 ? (
              <div className={styles.empty}>
                <HiClock size={32} />
                <p>No activity yet.</p>
              </div>
            ) : (
              <div className={styles.activityList}>
                {allActivity.map((act) => {
                  let detailHref: string;
                  if (act.media_type === 'movie') detailHref = `/movies/${act.media_id}`;
                  else if (act.media_type === 'tv') detailHref = `/tv/${act.media_id}`;
                  else if (act.media_type === 'manga') detailHref = `/read/${act.media_id}`;
                  else detailHref = `/anime/${act.media_id}`;
                  let actLabel: string;
                  if (act.activity_type === 'watched') actLabel = act.media_type === 'manga' ? 'completed' : 'watched';
                  else if (act.activity_type === 'rated') actLabel = 'rated';
                  else if (act.activity_type === 'added_to_watchlist') actLabel = 'added to list';
                  else actLabel = 'recommended';
                  // Manga posters come from Jikan as full URLs; movie/TV posters
                  // are TMDB paths and need `tmdbImage()`.
                  const posterSrc = act.poster_path
                    ? (act.poster_path.startsWith('http') ? act.poster_path : tmdbImage(act.poster_path, 'w92'))
                    : null;
                  return (
                    <Link key={act.id} href={detailHref} className={styles.activityCard}>
                      {posterSrc && (
                        <div className={styles.activityPoster}>
                          <Image src={posterSrc} alt={act.title} fill sizes="40px" style={{ objectFit: 'cover' }} />
                        </div>
                      )}
                      <div className={styles.activityInfo}>
                        <span className={styles.activityAction}>{actLabel}</span>
                        <span className={styles.activityTitle}>{act.title}</span>
                        <span className={styles.activityTime}>{formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}</span>
                      </div>
                      {act.rating && (
                        <div className={styles.activityRating}><HiStar size={14} /> {act.rating}</div>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}
