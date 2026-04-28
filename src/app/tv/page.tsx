'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MediaCard from '@/components/common/MediaCard';
import { getPopularTV, getTopRatedTV, getOnAirTV, normalizeMediaItem } from '@/lib/tmdb';
import { MediaItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import styles from './tv.module.css';

const TABS = [
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'on_air', label: 'On The Air' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function TVPage() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<TabKey>('popular');
  const [shows, setShows] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchFn = {
      popular: getPopularTV,
      top_rated: getTopRatedTV,
      on_air: getOnAirTV,
    }[tab];

    fetchFn()
      .then((res) => {
        if (!cancelled) setShows(res.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv')));
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [tab]);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>TV Series</h1>
          <p className={styles.subtitle}>Binge-worthy shows to track and share</p>
        </motion.div>

        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <p className={styles.loadingText}>Loading shows...</p>}
        {error && <p className={styles.errorText}>Failed to load: {error}</p>}

        {!loading && !error && (
          <div className={styles.grid}>
            {shows.map((show, i) => (
              <motion.div
                key={show.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <MediaCard item={show} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
