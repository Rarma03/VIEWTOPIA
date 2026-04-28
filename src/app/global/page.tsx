'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  HiTrophy, HiClock, HiFilm, HiStar, HiShieldCheck, HiUserGroup,
  HiMagnifyingGlass, HiGlobeAlt, HiPlay, HiBookmark, HiTv, HiSparkles,
  HiHandRaised, HiHeart, HiRectangleStack, HiQueueList, HiMegaphone,
  HiArrowsPointingOut, HiChatBubbleLeft, HiFire, HiBolt, HiHandThumbUp,
  HiHandThumbDown, HiShare, HiFolderOpen, HiArchiveBox,
  HiClipboardDocumentList, HiPencilSquare, HiSpeakerWave, HiEye,
  HiAcademicCap, HiXCircle, HiSquares2X2, HiDocumentText,
  HiBuildingLibrary,
  HiChevronLeft, HiChevronRight,
} from 'react-icons/hi2';
import {
  getWatchlist, getAllProfiles,
  type PublicProfile,
} from '@/lib/store';
import { ALL_BADGES, DIFFICULTY_CONFIG, CATEGORY_CONFIG } from '@/lib/badges';
import { WatchlistItem, UserBadge, BadgeDifficulty, BadgeCategory } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import FriendButton from '@/components/common/FriendButton';
import { useShowMore } from '@/lib/useShowMore';
import styles from './global.module.css';

// ─── Shared constants ───
const BUNDLE_COLORS = [
  ['#e50914', '#ff4757'], ['#8b5cf6', '#a78bfa'], ['#06b6d4', '#22d3ee'],
  ['#f59e0b', '#fbbf24'], ['#10b981', '#34d399'], ['#ec4899', '#f472b6'],
];

const BADGE_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  HiPlay, HiBookmark, HiStar, HiFilm, HiTv, HiSparkles, HiHandRaised,
  HiHeart, HiRectangleStack, HiTrophy, HiQueueList, HiMegaphone,
  HiArrowsPointingOut, HiChatBubbleLeft, HiFire, HiBolt, HiGlobeAlt,
  HiHandThumbUp, HiHandThumbDown, HiShare, HiFolderOpen, HiArchiveBox,
  HiClipboardDocumentList, HiPencilSquare, HiSpeakerWave, HiEye,
  HiAcademicCap, HiXCircle, HiSquares2X2, HiDocumentText, HiShieldCheck,
  HiUserGroup, HiBuildingLibrary,
};

type GlobalTab = 'leaderboard' | 'badges' | 'users';
type LeaderCategory = 'hours' | 'count' | 'avgRating';
type TimeMode = 'monthly' | 'yearly' | 'all';
type BadgeFilter = 'all' | BadgeDifficulty | BadgeCategory;

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function estimateHours(item: WatchlistItem): number {
  switch (item.media_type) { case 'movie': return 2; case 'tv': return 0.75; case 'anime': return 0.4; default: return 1; }
}

// ─── Leaderboard Sub-Tab ───
function LeaderboardTab({ allItems, profiles }: Readonly<{ allItems: WatchlistItem[]; profiles: PublicProfile[] }>) {
  const [category, setCategory] = useState<LeaderCategory>('hours');
  const [timeMode, setTimeMode] = useState<TimeMode>('all');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const filteredItems = useMemo(() => {
    if (timeMode === 'all') return allItems;
    return allItems.filter((item) => {
      if (!item.watched_date) return false;
      const d = new Date(item.watched_date);
      if (timeMode === 'yearly') return d.getFullYear() === selectedYear;
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [allItems, timeMode, selectedMonth, selectedYear]);

  interface UserStats { userId: string; displayName: string; username: string; initial: string; hoursWatched: number; titleCount: number; avgRating: number; ratedCount: number; movieCount: number; tvCount: number; animeCount: number; }

  const leaderboard: UserStats[] = useMemo(() => {
    const statsMap = new Map<string, UserStats>();
    for (const p of profiles) {
      const name = p.display_name || p.username || 'User';
      statsMap.set(p.id, { userId: p.id, displayName: name, username: p.username || 'user', initial: name.charAt(0).toUpperCase(), hoursWatched: 0, titleCount: 0, avgRating: 0, ratedCount: 0, movieCount: 0, tvCount: 0, animeCount: 0 });
    }
    for (const item of filteredItems) {
      if (item.status !== 'watched') continue;
      const s = statsMap.get(item.user_id);
      if (!s) continue;
      s.titleCount++; s.hoursWatched += estimateHours(item);
      if (item.media_type === 'movie') s.movieCount++; else if (item.media_type === 'tv') s.tvCount++; else s.animeCount++;
      if (item.user_rating != null) { s.avgRating = (s.avgRating * s.ratedCount + item.user_rating) / (s.ratedCount + 1); s.ratedCount++; }
    }
    const arr = Array.from(statsMap.values());
    if (category === 'hours') arr.sort((a, b) => b.hoursWatched - a.hoursWatched);
    else if (category === 'count') arr.sort((a, b) => b.titleCount - a.titleCount);
    else arr.sort((a, b) => b.avgRating - a.avgRating);
    return arr;
  }, [filteredItems, category, profiles]);

  const getValue = (s: UserStats) => category === 'hours' ? s.hoursWatched.toFixed(1) : category === 'count' ? String(s.titleCount) : s.ratedCount > 0 ? s.avgRating.toFixed(1) : '—';
  const maxVal = useMemo(() => Math.max(...leaderboard.map((s) => category === 'hours' ? s.hoursWatched : category === 'count' ? s.titleCount : s.avgRating), 1), [leaderboard, category]);
  const { visible: visibleLeaders, shown: shownL, total: totalL, hasMore: hasMoreL, showMore: showMoreL } = useShowMore(leaderboard, 10);
  const cats: { key: LeaderCategory; label: string; icon: React.ReactNode; suffix: string }[] = [
    { key: 'hours', label: 'Hours Watched', icon: <HiClock size={16} />, suffix: 'hrs' },
    { key: 'count', label: 'Titles Watched', icon: <HiFilm size={16} />, suffix: '' },
    { key: 'avgRating', label: 'Avg Rating', icon: <HiStar size={16} />, suffix: '' },
  ];

  return (
    <>
      <div className={styles.subTabs}>
        {cats.map((c) => (
          <button key={c.key} className={`${styles.subTab} ${category === c.key ? styles.subTabActive : ''}`} onClick={() => setCategory(c.key)}>
            {c.icon} <span>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Time Filter */}
      <div className={styles.timeFilter}>
        {([['monthly', 'Monthly'], ['yearly', 'Yearly'], ['all', 'All Time']] as const).map(([val, label]) => (
          <button key={val} className={`${styles.timeBtn} ${timeMode === val ? styles.timeBtnActive : ''}`} onClick={() => setTimeMode(val)}>
            {label}
          </button>
        ))}
      </div>

      {timeMode !== 'all' && (
        <div className={styles.periodPicker}>
          <button className={styles.periodArrow} onClick={() => {
            if (timeMode === 'monthly') {
              if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
              else setSelectedMonth((m) => m - 1);
            } else { setSelectedYear((y) => y - 1); }
          }}><HiChevronLeft size={20} /></button>
          <span className={styles.periodLabel}>
            {timeMode === 'monthly'
              ? new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })
              : String(selectedYear)}
          </span>
          <button className={styles.periodArrow}
            disabled={timeMode === 'monthly' ? selectedYear === now.getFullYear() && selectedMonth === now.getMonth() : selectedYear === now.getFullYear()}
            onClick={() => {
              if (timeMode === 'monthly') {
                if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
                else setSelectedMonth((m) => m + 1);
              } else { setSelectedYear((y) => y + 1); }
            }}><HiChevronRight size={20} /></button>
        </div>
      )}

      <div className={styles.leaderList}>
        {visibleLeaders.map((user, idx) => {
          const barPct = category === 'avgRating' ? (user.avgRating / 10) * 100 : (parseFloat(getValue(user)) / maxVal) * 100;
          const [c1, c2] = BUNDLE_COLORS[idx % BUNDLE_COLORS.length];
          return (
            <motion.div key={user.userId} className={styles.leaderRow} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.06 }}>
              <div className={styles.leaderRank}>
                {idx < 3 ? <span style={{ color: MEDAL_COLORS[idx] }}><HiTrophy size={20} /></span> : <span className={styles.rankNum}>{idx + 1}</span>}
              </div>
              <Link href={user.username && user.username !== 'user' ? `/u/${user.username}` : `/profile/${user.userId}`} className={styles.leaderUser}>
                <div className={styles.leaderAvatar} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, borderColor: idx < 3 ? MEDAL_COLORS[idx] : 'transparent' }}>
                  {user.initial}
                </div>
                <div className={styles.leaderNameBlock}>
                  <span className={styles.leaderName}>{user.displayName}</span>
                  <span className={styles.leaderUsername}>@{user.username}</span>
                </div>
              </Link>
              <div className={styles.leaderBarArea}>
                <div className={styles.leaderBarTrack}>
                  <motion.div className={styles.leaderBarFill} initial={{ width: 0 }} animate={{ width: `${Math.max(barPct, 2)}%` }}
                    transition={{ duration: 0.6, delay: idx * 0.06 }} style={idx < 3 ? { background: MEDAL_COLORS[idx] } : {}} />
                </div>
                <span className={styles.leaderValue}>{getValue(user)}{cats.find((c) => c.key === category)?.suffix ? ` ${cats.find((c) => c.key === category)!.suffix}` : ''}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {hasMoreL && (
        <ShowMoreButton shown={shownL} total={totalL} step={10} onClick={showMoreL} />
      )}
    </>
  );
}

// ─── Badges Sub-Tab ───
function BadgesTab() {
  const [userBadges] = useState<UserBadge[]>([]);
  const [filter, setFilter] = useState<BadgeFilter>('all');
  const [showUnlocked, setShowUnlocked] = useState<'all' | 'unlocked' | 'locked'>('all');

  const progress = (id: string) => { const ub = userBadges.find((b) => b.badge_id === id); return ub ? ub.progress : 0; };
  const isUnlocked = (id: string) => progress(id) >= 100;

  const filtered = ALL_BADGES.filter((b) => {
    if (filter !== 'all') {
      if (['easy', 'medium', 'hard'].includes(filter)) { if (b.difficulty !== filter) return false; }
      else { if (b.category !== filter) return false; }
    }
    if (showUnlocked === 'unlocked') return isUnlocked(b.id);
    if (showUnlocked === 'locked') return !isUnlocked(b.id);
    return true;
  });

  const unlockedCount = ALL_BADGES.filter((b) => isUnlocked(b.id)).length;
  const { visible: visibleBadges, shown: shownB, total: totalB, hasMore: hasMoreB, showMore: showMoreB } = useShowMore(filtered, 12);

  return (
    <>
      {/* Stats */}
      <div className={styles.badgeStats}>
        <span className={styles.badgeStat}><strong>{unlockedCount}</strong> Unlocked</span>
        <span className={styles.badgeStatDivider} />
        <span className={styles.badgeStat}><strong>{ALL_BADGES.length - unlockedCount}</strong> Locked</span>
        <span className={styles.badgeStatDivider} />
        <div className={styles.badgeProgressWrap}>
          <div className={styles.badgeProgressBg}><div className={styles.badgeProgressFill} style={{ width: `${(unlockedCount / ALL_BADGES.length) * 100}%` }} /></div>
          <span className={styles.badgeProgressText}>{Math.round((unlockedCount / ALL_BADGES.length) * 100)}%</span>
        </div>
      </div>
      {/* Filters */}
      <div className={styles.badgeFilters}>
        <div className={styles.badgeFilterRow}>
          {(['all', 'unlocked', 'locked'] as const).map((s) => (
            <button key={s} className={`${styles.filterPill} ${showUnlocked === s ? styles.filterPillActive : ''}`} onClick={() => setShowUnlocked(s)}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
          ))}
        </div>
        <div className={styles.badgeFilterRow}>
          <button className={`${styles.filterPill} ${filter === 'all' ? styles.filterPillActive : ''}`} onClick={() => setFilter('all')}>All</button>
          {Object.entries(DIFFICULTY_CONFIG).map(([k, cfg]) => (
            <button key={k} className={`${styles.filterPill} ${filter === k ? styles.filterPillActive : ''}`} onClick={() => setFilter(k as BadgeFilter)}
              style={filter === k ? { borderColor: cfg.color, color: cfg.color } : {}}>{cfg.label}</button>
          ))}
          {Object.entries(CATEGORY_CONFIG).map(([k, cfg]) => (
            <button key={k} className={`${styles.filterPill} ${filter === k ? styles.filterPillActive : ''}`} onClick={() => setFilter(k as BadgeFilter)}
              style={filter === k ? { borderColor: cfg.color, color: cfg.color } : {}}>{cfg.label}</button>
          ))}
        </div>
      </div>
      {/* Grid */}
      <div className={styles.badgeGrid}>
        {visibleBadges.map((badge, i) => {
          const Icon = BADGE_ICON_MAP[badge.icon] || HiStar;
          const prog = progress(badge.id);
          const unlocked = prog >= 100;
          const dc = DIFFICULTY_CONFIG[badge.difficulty];
          return (
            <motion.div key={badge.id} className={`${styles.badgeCard} ${unlocked ? styles.badgeUnlocked : styles.badgeLocked}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
              <div className={styles.badgeIconWrap} style={{ background: unlocked ? `${badge.color}20` : 'rgba(255,255,255,0.03)', borderColor: unlocked ? badge.color : 'rgba(255,255,255,0.06)' }}>
                <Icon size={24} style={{ color: unlocked ? badge.color : 'rgba(232,237,245,0.2)' }} />
              </div>
              <div className={styles.badgeInfo}>
                <h3 className={styles.badgeName}>{badge.name}</h3>
                <p className={styles.badgeDesc}>{badge.description}</p>
                <div className={styles.badgeTags}>
                  <span className={styles.diffTag} style={{ background: dc.bg, borderColor: dc.border, color: dc.color }}>{dc.label}</span>
                  <span className={styles.catTag} style={{ color: CATEGORY_CONFIG[badge.category].color }}>{CATEGORY_CONFIG[badge.category].label}</span>
                </div>
              </div>
              <div className={styles.badgeProgressCol}>
                <div className={styles.badgeProgressBarSmall}><div className={styles.badgeProgressFillSmall} style={{ width: `${prog}%`, background: unlocked ? badge.color : 'rgba(168,85,247,0.5)' }} /></div>
                <span className={styles.badgeProgressLabel} style={unlocked ? { color: badge.color } : {}}>{unlocked ? 'Unlocked' : `${Math.round(prog)}%`}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
      {filtered.length === 0 && <div className={styles.emptyState}><p>No badges match your filters</p></div>}
      {hasMoreB && (
        <ShowMoreButton shown={shownB} total={totalB} step={12} onClick={showMoreB} />
      )}
    </>
  );
}

// ─── Users Sub-Tab ───
function UsersTab({ allItems, profiles }: Readonly<{ allItems: WatchlistItem[]; profiles: PublicProfile[] }>) {
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const [search, setSearch] = useState('');

  const users = useMemo(() => {
    return profiles.map((p, idx) => {
      const items = allItems.filter((i) => i.user_id === p.id && i.status === 'watched');
      const ratedItems = items.filter((i) => i.user_rating != null);
      const avgRating = ratedItems.length > 0
        ? ratedItems.reduce((s, i) => s + (i.user_rating || 0), 0) / ratedItems.length
        : 0;
      const displayName = p.display_name || p.username || 'User';
      const username = p.username || 'user';
      return {
        id: p.id,
        idx,
        display_name: displayName,
        username,
        created_at: p.created_at || '',
        watchedCount: items.length,
        avgRating,
        movieCount: items.filter((i) => i.media_type === 'movie').length,
        tvCount: items.filter((i) => i.media_type === 'tv').length,
        animeCount: items.filter((i) => i.media_type === 'anime').length,
      };
    }).filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return u.display_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });
  }, [allItems, search, profiles]);

  const { visible: visibleUsers, shown: shownU, total: totalU, hasMore: hasMoreU, showMore: showMoreU } = useShowMore(users, 12);

  return (
    <>
      <div className={styles.usersSearch}>
        <HiMagnifyingGlass size={18} className={styles.searchIcon} />
        <input type="text" placeholder="Search by name or username..." value={search} onChange={(e) => setSearch(e.target.value)} className={styles.searchInput} />
      </div>
      <div className={styles.usersGrid}>
        {visibleUsers.map((u) => {
          const [c1, c2] = BUNDLE_COLORS[u.idx % BUNDLE_COLORS.length];
          return (
            <motion.div key={u.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
              <Link href={u.username && u.username !== 'user' ? `/u/${u.username}` : `/profile/${u.id}`} className={styles.userCard}>
                <div className={styles.userCardTop}>
                  <div className={styles.userCardAvatar} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                    {u.display_name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.userCardInfo}>
                    <h3 className={styles.userCardName}>{u.display_name}</h3>
                    <p className={styles.userCardUsername}>@{u.username}</p>
                  </div>
                </div>
                <div className={styles.userCardStats}>
                  <span><HiEye size={13} /> {u.watchedCount} watched</span>
                  <span><HiStar size={13} /> {u.avgRating > 0 ? u.avgRating.toFixed(1) : '—'} avg</span>
                </div>
                <div className={styles.userCardBreakdown}>
                  {u.movieCount > 0 && <span className={styles.breakdownPill} style={{ color: '#e50914' }}><HiFilm size={12} /> {u.movieCount}</span>}
                  {u.tvCount > 0 && <span className={styles.breakdownPill} style={{ color: '#00d4ff' }}><HiTv size={12} /> {u.tvCount}</span>}
                  {u.animeCount > 0 && <span className={styles.breakdownPill} style={{ color: '#a855f7' }}><HiSparkles size={12} /> {u.animeCount}</span>}
                </div>
                <div className={styles.userCardBottom}>
                  <div className={styles.userCardJoined}>
                    {u.created_at ? `Joined ${new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
                  </div>
                  {u.id === currentUserId
                    ? <span className={styles.youBadge}>You</span>
                    : <FriendButton targetUserId={u.id} compact />}
                </div>
              </Link>
            </motion.div>
          );
        })}
        {users.length === 0 && <div className={styles.emptyState}><p>No users found for &ldquo;{search}&rdquo;</p></div>}
      </div>
      {hasMoreU && (
        <ShowMoreButton shown={shownU} total={totalU} step={12} onClick={showMoreU} />
      )}
    </>
  );
}

// ─── Main ───
function GlobalContent() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = (searchParams.get('tab') as GlobalTab) || 'leaderboard';
  const [tab, setTab] = useState<GlobalTab>(initialTab);
  const [allItems, setAllItems] = useState<WatchlistItem[]>([]);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);

  useEffect(() => { void getWatchlist().then(setAllItems); }, []);
  useEffect(() => { void getAllProfiles().then(setProfiles); }, []);

  const handleTab = (t: GlobalTab) => {
    setTab(t);
    router.replace(`/global?tab=${t}`, { scroll: false });
  };

  const tabConfig: { key: GlobalTab; label: string; icon: React.ReactNode }[] = [
    { key: 'leaderboard', label: 'Leaderboard', icon: <HiTrophy size={18} /> },
    { key: 'badges', label: 'Badges', icon: <HiShieldCheck size={18} /> },
    { key: 'users', label: 'Users', icon: <HiUserGroup size={18} /> },
  ];

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div className={styles.header} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.headerIcon}><HiGlobeAlt size={28} /></div>
          <h1 className={styles.title}>Global</h1>
          <p className={styles.subtitle}>Explore the community — see who&apos;s on top, collect badges, and discover users</p>
        </motion.div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          {tabConfig.map((t) => (
            <button key={t.key} className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => handleTab(t.key)}>
              {t.icon} <span>{t.label}</span>
            </button>
          ))}
        </div>

        {tab === 'leaderboard' && <LeaderboardTab allItems={allItems} profiles={profiles} />}
        {tab === 'badges' && <BadgesTab />}
        {tab === 'users' && <UsersTab allItems={allItems} profiles={profiles} />}
      </div>
    </div>
  );
}

export default function GlobalPage() {
  return <Suspense><GlobalContent /></Suspense>;
}
