'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { HiArrowLeft } from 'react-icons/hi2';
import ActivityFeed from '@/components/activity/ActivityFeed';
import MonthlyCalendar from '@/components/activity/MonthlyCalendar';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import { getActivity, getWatchlist } from '@/lib/store';
import {
  getAllEntries as getMangaEntries,
  subscribe as subscribeMangaTracker,
  MangaTrackerEntry,
} from '@/lib/mangaTracker';
import { ActivityItem, WatchlistItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import styles from './activity.module.css';

export default function ActivityPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [mangaEntries, setMangaEntries] = useState<MangaTrackerEntry[]>([]);
  const { visible, shown, total, hasMore, showMore } = useShowMore(activities, 15);

  useEffect(() => {
    if (!user) { setActivities([]); setWatchlist([]); setMangaEntries([]); return; }
    let cancelled = false;
    void Promise.all([
      getActivity(user.id),
      getWatchlist(user.id),
      getMangaEntries(user.id),
    ]).then(([acts, wl, manga]) => {
      if (cancelled) return;
      // Defensive client-side dedupe by (media_id, media_type, activity_type) so any
      // legacy duplicate rows from before the dedupe-on-write fix don't bloat the UI.
      // The newest row (acts is already ordered newest-first by the store) wins.
      const seen = new Set<string>();
      const deduped: ActivityItem[] = [];
      for (const a of acts) {
        const key = `${a.media_type}:${a.media_id}:${a.activity_type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(a);
      }
      setActivities(deduped);
      setWatchlist(wl);
      setMangaEntries(manga);
    });
    // Refresh the manga slice when the tracker emits updates so a "completed"
    // mark from another tab / page lights up the calendar without a reload.
    const unsub = subscribeMangaTracker(() => {
      if (!user) return;
      void getMangaEntries(user.id).then((m) => { if (!cancelled) setMangaEntries(m); });
    });
    return () => { cancelled = true; unsub(); };
  }, [user]);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <button
          type="button"
          className={styles.backLink}
          onClick={() => {
            // Prefer real history when present so users return to wherever
            // they came from (e.g. profile, home). When the page was opened
            // directly (no referrer in this tab), fall back to home.
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              router.push('/');
            }
          }}
        >
          <HiArrowLeft size={16} /> Back
        </button>

        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>History</h1>
          <p className={styles.subtitle}>Your viewing history at a glance</p>
        </motion.div>

        <div className={styles.layout}>
          <div className={styles.feedCol}>
            <ActivityFeed activities={visible} />
            {hasMore && (
              <ShowMoreButton shown={shown} total={total} step={15} onClick={showMore} />
            )}
          </div>

          <aside className={styles.calendarCol}>
            <MonthlyCalendar items={watchlist} mangaEntries={mangaEntries} />
          </aside>
        </div>
      </div>
    </div>
  );
}
