'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiPlay, HiBookmark, HiFire, HiStar, HiCheck } from 'react-icons/hi2';
import { MediaItem } from '@/types';
import { tmdbBackdrop } from '@/lib/tmdb';
import { GENRE_MAP } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { isInWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './HeroBanner.module.css';

const AUTO_ROTATE_MS = 6000;

interface HeroBannerProps {
  items: MediaItem[];
}

export default function HeroBanner({ items }: HeroBannerProps) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [watchlistState, setWatchlistState] = useState<Record<number, boolean>>({});
  const displayItems = useMemo(() => items.slice(0, 5), [items]);

  const goNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % displayItems.length);
  }, [displayItems.length]);

  // Sync watchlist state for displayed items
  useEffect(() => {
    if (!user) { setWatchlistState({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        displayItems.map(async (item) => {
          const mediaType = (item.media_type as 'movie' | 'tv') || 'movie';
          const found = await isInWatchlist(user.id, item.id, mediaType);
          return [item.id, !!found] as const;
        })
      );
      if (cancelled) return;
      const state: Record<number, boolean> = {};
      for (const [id, present] of entries) state[id] = present;
      setWatchlistState(state);
    })();
    return () => { cancelled = true; };
  }, [displayItems, user]);

  const handleToggleWatchlist = async (item: MediaItem) => {
    if (!user) { toast.error('Please log in first'); router.push('/login'); return; }
    const mediaType = (item.media_type as 'movie' | 'tv') || 'movie';
    const existing = await isInWatchlist(user.id, item.id, mediaType);
    if (existing) {
      await removeFromWatchlist(existing.id);
      setWatchlistState((prev) => ({ ...prev, [item.id]: false }));
      toast.success(`Removed "${item.title}" from watchlist`);
    } else {
      await addToWatchlist({
        user_id: user.id,
        media_id: item.id,
        media_type: mediaType,
        title: item.title,
        poster_path: item.poster_path,
        status: 'watchlist',
        watched_date: null,
        notes: null,
        original_language: item.original_language ?? null,
      });
      setWatchlistState((prev) => ({ ...prev, [item.id]: true }));
      toast.success(`Added "${item.title}" to watchlist`);
    }
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max).trimEnd() + '…' : text;

  // Auto-rotate
  useEffect(() => {
    if (displayItems.length <= 1) return;
    const timer = setInterval(goNext, AUTO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [goNext, displayItems.length]);

  const featured = displayItems[activeIndex];
  if (!featured) return null;

  const detailHref = featured.media_type === 'movie' ? `/movies/${featured.id}` : `/tv/${featured.id}`;
  const genres = featured.genre_ids?.slice(0, 3).map((id) => GENRE_MAP[id]).filter(Boolean) || [];

  return (
    <div className={`${styles.hero} ${isDark ? styles.dark : styles.light}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={featured.id}
          className={styles.backdrop}
          style={{ backgroundImage: `url(${tmdbBackdrop(featured.backdrop_path, 'original')})` }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
        />
      </AnimatePresence>
      <div className={styles.gradient} />
      <div className={styles.content}>
        <AnimatePresence mode="wait">
          <motion.div
            key={featured.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className={styles.badges}>
              <span className={styles.trendingBadge}><HiFire size={14} /> Trending Now</span>
              {genres.map((g) => (
                <span key={g} className={styles.genreBadge}>{g}</span>
              ))}
            </div>
            <h1 className={styles.title}>{featured.title}</h1>
            <p className={styles.overview}>{truncate(featured.overview || '', 180)}</p>
            <div className={styles.meta}>
              <span className={styles.rating}><HiStar size={14} /> {featured.vote_average.toFixed(1)}</span>
              {featured.release_date && (
                <span className={styles.year}>{new Date(featured.release_date).getFullYear()}</span>
              )}
            </div>
            <div className={styles.actions}>
              <Link href={detailHref} className={styles.primaryBtn}>
                <HiPlay size={20} />
                <span>View Details</span>
              </Link>
              <button
                className={`${styles.secondaryBtn} ${watchlistState[featured.id] ? styles.inList : ''}`}
                onClick={() => handleToggleWatchlist(featured)}
              >
                {watchlistState[featured.id] ? <HiCheck size={18} /> : <HiBookmark size={18} />}
                <span>{watchlistState[featured.id] ? 'In Watchlist' : 'Add to List'}</span>
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className={styles.progressTrack}>
        {displayItems.map((_, i) => (
          <div key={i} className={`${styles.progressSegment} ${i === activeIndex ? styles.progressActive : ''}`}>
            {i === activeIndex && (
              <motion.div
                className={styles.progressFill}
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: AUTO_ROTATE_MS / 1000, ease: 'linear' }}
                key={`progress-${activeIndex}-${Date.now()}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Thumbnail strip */}
      <div className={styles.thumbnails}>
        {displayItems.map((item, i) => (
          <button
            key={item.id}
            className={`${styles.thumb} ${i === activeIndex ? styles.activeThumb : ''}`}
            onClick={() => setActiveIndex(i)}
          >
            <div
              className={styles.thumbImg}
              style={{ backgroundImage: `url(${tmdbBackdrop(item.backdrop_path, 'w300')})` }}
            />
            <span className={styles.thumbTitle}>{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
