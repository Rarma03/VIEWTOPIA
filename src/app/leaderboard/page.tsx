'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { HiTrophy, HiClock, HiFilm, HiStar, HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import { getWatchlist, getProfilesByIds, PublicProfile } from '@/lib/store';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import { WatchlistItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import styles from './leaderboard.module.css';

type Category = 'hours' | 'count' | 'avgRating';
type TimeMode = 'monthly' | 'yearly' | 'all';

const CATEGORY_CONFIG: Record<Category, { label: string; icon: React.ReactNode; suffix: string }> = {
  hours: { label: 'Hours Watched', icon: <HiClock size={18} />, suffix: 'hrs' },
  count: { label: 'Titles Watched', icon: <HiFilm size={18} />, suffix: '' },
  avgRating: { label: 'Avg Rating', icon: <HiStar size={18} />, suffix: '' },
};

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

// Estimate hours per media type
function estimateHours(item: WatchlistItem): number {
  switch (item.media_type) {
    case 'movie': return 2;
    case 'tv': return 0.75; // ~45min per show entry
    case 'anime': return 0.4; // ~24min
    default: return 1;
  }
}

interface UserStats {
  userId: string;
  username: string | null;
  displayName: string;
  initial: string;
  avatarUrl: string | null;
  hoursWatched: number;
  titleCount: number;
  avgRating: number;
  ratedCount: number;
  movieCount: number;
  tvCount: number;
  animeCount: number;
}

export default function LeaderboardPage() {
  const { isDark } = useTheme();
  const [category, setCategory] = useState<Category>('hours');
  const [timeMode, setTimeMode] = useState<TimeMode>('all');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [allItems, setAllItems] = useState<WatchlistItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});

  useEffect(() => {
    let cancelled = false;
    void getWatchlist().then(async (items) => {
      if (cancelled) return;
      setAllItems(items);
      const ids = Array.from(new Set(items.map((i) => i.user_id)));
      const map = await getProfilesByIds(ids);
      if (!cancelled) setProfiles(map);
    });
    return () => { cancelled = true; };
  }, []);

  const filteredItems = useMemo(() => {
    if (timeMode === 'all') return allItems;
    return allItems.filter((item) => {
      if (!item.watched_date) return false;
      const d = new Date(item.watched_date);
      if (timeMode === 'yearly') return d.getFullYear() === selectedYear;
      // monthly
      return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
    });
  }, [allItems, timeMode, selectedMonth, selectedYear]);

  const leaderboard: UserStats[] = useMemo(() => {
    const statsMap = new Map<string, UserStats>();

    // Initialize all known profiles (everyone we've seen via the watchlist)
    for (const p of Object.values(profiles)) {
      const name = p.display_name || p.username || 'User';
      statsMap.set(p.id, {
        userId: p.id,
        username: p.username,
        displayName: name,
        initial: name.charAt(0).toUpperCase(),
        avatarUrl: p.avatar_url ?? null,
        hoursWatched: 0,
        titleCount: 0,
        avgRating: 0,
        ratedCount: 0,
        movieCount: 0,
        tvCount: 0,
        animeCount: 0,
      });
    }

    // Accumulate watched items
    for (const item of filteredItems) {
      if (item.status !== 'watched') continue;
      const s = statsMap.get(item.user_id);
      if (!s) continue;

      s.titleCount += 1;
      s.hoursWatched += estimateHours(item);

      if (item.media_type === 'movie') s.movieCount++;
      else if (item.media_type === 'tv') s.tvCount++;
      else if (item.media_type === 'anime') s.animeCount++;

      if (item.user_rating != null) {
        s.avgRating = (s.avgRating * s.ratedCount + item.user_rating) / (s.ratedCount + 1);
        s.ratedCount++;
      }
    }

    const arr = Array.from(statsMap.values());

    // Sort based on active category
    if (category === 'hours') arr.sort((a, b) => b.hoursWatched - a.hoursWatched);
    else if (category === 'count') arr.sort((a, b) => b.titleCount - a.titleCount);
    else arr.sort((a, b) => b.avgRating - a.avgRating);

    return arr;
  }, [filteredItems, category, profiles]);

  function getValue(s: UserStats): string {
    if (category === 'hours') return s.hoursWatched.toFixed(1);
    if (category === 'count') return String(s.titleCount);
    return s.ratedCount > 0 ? s.avgRating.toFixed(1) : '—';
  }

  // Max value for bar width calculation
  const maxVal = useMemo(() => {
    if (leaderboard.length === 0) return 1;
    const vals = leaderboard.map((s) => {
      if (category === 'hours') return s.hoursWatched;
      if (category === 'count') return s.titleCount;
      return s.avgRating;
    });
    return Math.max(...vals, 1);
  }, [leaderboard, category]);

  const { visible: visibleLeaders, shown, total, hasMore, showMore } = useShowMore(leaderboard, 20);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.trophyIcon}><HiTrophy size={32} /></div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>See who&apos;s been watching the most</p>
        </div>

        {/* Category Tabs */}
        <div className={styles.tabs}>
          {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                className={`${styles.tab} ${category === cat ? styles.tabActive : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cfg.icon}
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>

        {/* Time Mode Tabs */}
        <div className={styles.timeFilter}>
          {([['monthly', 'Monthly'], ['yearly', 'Yearly'], ['all', 'All Time']] as const).map(([val, label]) => (
            <button
              key={val}
              className={`${styles.timeBtn} ${timeMode === val ? styles.timeBtnActive : ''}`}
              onClick={() => setTimeMode(val)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Month / Year Picker */}
        {timeMode !== 'all' && (
          <div className={styles.periodPicker}>
            <button
              className={styles.periodArrow}
              onClick={() => {
                if (timeMode === 'monthly') {
                  if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear((y) => y - 1); }
                  else setSelectedMonth((m) => m - 1);
                } else {
                  setSelectedYear((y) => y - 1);
                }
              }}
            >
              <HiChevronLeft size={20} />
            </button>
            <span className={styles.periodLabel}>
              {timeMode === 'monthly'
                ? new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long', year: 'numeric' })
                : String(selectedYear)}
            </span>
            <button
              className={styles.periodArrow}
              disabled={
                timeMode === 'monthly'
                  ? selectedYear === now.getFullYear() && selectedMonth === now.getMonth()
                  : selectedYear === now.getFullYear()
              }
              onClick={() => {
                if (timeMode === 'monthly') {
                  if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear((y) => y + 1); }
                  else setSelectedMonth((m) => m + 1);
                } else {
                  setSelectedYear((y) => y + 1);
                }
              }}
            >
              <HiChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Leaderboard List */}
        <div className={styles.list}>
          {visibleLeaders.map((user, idx) => {
            const barPercent = category === 'avgRating'
              ? (user.avgRating / 10) * 100
              : (parseFloat(getValue(user)) / maxVal) * 100;

            return (
              <motion.div
                key={user.userId}
                className={styles.row}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
              >
                {/* Rank */}
                <div className={styles.rank}>
                  {idx < 3 ? (
                    <span className={styles.medal} style={{ color: MEDAL_COLORS[idx] }}>
                      <HiTrophy size={22} />
                    </span>
                  ) : (
                    <span className={styles.rankNum}>{idx + 1}</span>
                  )}
                </div>

                {/* User Info */}
                <Link href={user.username ? `/u/${user.username}` : `/profile/${user.userId}`} className={styles.userInfo}>
                  <div className={styles.avatar} style={idx < 3 ? { borderColor: MEDAL_COLORS[idx] } : {}}>
                    {user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt={user.displayName}
                        className={styles.avatarImg}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      user.initial
                    )}
                  </div>
                  <div className={styles.nameBlock}>
                    <span className={styles.name}>{user.displayName}</span>
                    <span className={styles.breakdown}>
                      {user.movieCount > 0 && `${user.movieCount} movies`}
                      {user.tvCount > 0 && `${user.movieCount > 0 ? ' · ' : ''}${user.tvCount} TV`}
                      {user.animeCount > 0 && `${(user.movieCount + user.tvCount) > 0 ? ' · ' : ''}${user.animeCount} anime`}
                    </span>
                  </div>
                </Link>

                {/* Bar + Value */}
                <div className={styles.barArea}>
                  <div className={styles.barTrack}>
                    <motion.div
                      className={styles.barFill}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(barPercent, 2)}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.08 }}
                      style={idx < 3 ? { background: MEDAL_COLORS[idx] } : {}}
                    />
                  </div>
                  <span className={styles.value}>
                    {getValue(user)}{CATEGORY_CONFIG[category].suffix && ` ${CATEGORY_CONFIG[category].suffix}`}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {hasMore && (
          <ShowMoreButton shown={shown} total={total} step={20} onClick={showMore} />
        )}
      </div>
    </div>
  );
}
