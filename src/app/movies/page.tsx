'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import MediaCard from '@/components/common/MediaCard';
import { getPopularMovies, getTopRatedMovies, getNowPlayingMovies, getUpcomingMovies, normalizeMediaItem } from '@/lib/tmdb';
import { MediaItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import styles from './movies.module.css';

const TABS = [
  { key: 'popular', label: 'Popular' },
  { key: 'top_rated', label: 'Top Rated' },
  { key: 'now_playing', label: 'Now Playing' },
  { key: 'upcoming', label: 'Upcoming' },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function MoviesPage() {
  const { isDark } = useTheme();
  const [tab, setTab] = useState<TabKey>('popular');
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchFn = {
      popular: getPopularMovies,
      top_rated: getTopRatedMovies,
      now_playing: getNowPlayingMovies,
      upcoming: getUpcomingMovies,
    }[tab];

    fetchFn()
      .then((res) => {
        if (!cancelled) setMovies(res.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie')));
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
          <h1 className={styles.title}>Movies</h1>
          <p className={styles.subtitle}>Discover, track, and rate your favorite movies</p>
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

        {loading && <p className={styles.loadingText}>Loading movies...</p>}
        {error && <p className={styles.errorText}>Failed to load: {error}</p>}

        {!loading && !error && (
          <div className={styles.grid}>
            {movies.map((movie, i) => (
              <motion.div
                key={movie.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <MediaCard item={movie} />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
