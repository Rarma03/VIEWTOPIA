'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiXMark, HiFilm, HiTv, HiSparkles, HiFunnel } from 'react-icons/hi2';
import { getWatchlist, getRatings } from '@/lib/store';
import { WatchlistItem } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { MEDIA_TYPE_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import styles from './watched.module.css';

const RATING_COLORS = [
  '', // 0 - unused
  '#ef4444', // 1
  '#f97316', // 2
  '#f97316', // 3
  '#eab308', // 4
  '#eab308', // 5
  '#84cc16', // 6
  '#22c55e', // 7
  '#10b981', // 8
  '#06b6d4', // 9
  '#8b5cf6', // 10
];

export default function WatchedPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<WatchlistItem[]>([]);

  useEffect(() => {
    if (!user) { setAllItems([]); return; }
    let cancelled = false;
    (async () => {
      const [items, ratings] = await Promise.all([
        getWatchlist(user.id),
        getRatings({ userId: user.id }),
      ]);
      if (cancelled) return;
      const ratingMap = new Map(ratings.map((r) => [`${r.media_type}:${r.media_id}`, r.rating]));
      const merged = items.map((it) => ({
        ...it,
        user_rating: ratingMap.get(`${it.media_type}:${it.media_id}`) ?? null,
      }));
      setAllItems(merged);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Only show items with status 'watched' and a rating
  const watchedItems = useMemo(() =>
    allItems.filter((item) => item.status === 'watched' && item.user_rating != null),
    [allItems]
  );

  // Build rating distribution (1-10, including half steps)
  const distribution = useMemo(() => {
    const counts = Array(11).fill(0); // index 0 unused, index 1-10 for whole numbers
    watchedItems.forEach((item) => {
      if (item.user_rating) {
        // Round to nearest integer bucket for chart display
        const bucket = Math.round(item.user_rating);
        if (bucket >= 1 && bucket <= 10) counts[bucket]++;
      }
    });
    return counts;
  }, [watchedItems]);

  const maxCount = Math.max(...distribution.slice(1), 1);

  // Filtered items based on selected bar + type
  const filteredItems = useMemo(() => {
    let items = watchedItems;
    if (selectedRating !== null) {
      items = items.filter((item) => Math.round(item.user_rating!) === selectedRating);
    }
    if (typeFilter) {
      items = items.filter((item) => item.media_type === typeFilter);
    }
    return items;
  }, [watchedItems, selectedRating, typeFilter]);

  const {
    visible: visibleItems,
    shown: shownWatched,
    total: totalWatchedCount,
    hasMore: hasMoreWatched,
    showMore: showMoreWatched,
  } = useShowMore(filteredItems, 24);

  const totalWatched = watchedItems.length;
  const avgRating = totalWatched > 0
    ? (watchedItems.reduce((sum, i) => sum + (i.user_rating || 0), 0) / totalWatched).toFixed(1)
    : '0';

  const handleBarClick = (rating: number) => {
    setSelectedRating((prev) => (prev === rating ? null : rating));
  };

  const clearFilter = () => {
    setSelectedRating(null);
    setTypeFilter(null);
  };

  const getHref = (item: typeof watchedItems[0]) => {
    if (item.media_type === 'anime') return `/anime/${item.media_id}`;
    if (item.media_type === 'tv') return `/tv/${item.media_id}`;
    return `/movies/${item.media_id}`;
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        {/* Header */}
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>Watched Stats</h1>
          <p className={styles.subtitle}>Your rating distribution &amp; watched history</p>
        </motion.div>

        {/* Stats Overview */}
        <motion.div
          className={styles.statsRow}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className={styles.statCard}>
            <span className={styles.statValue}>{totalWatched}</span>
            <span className={styles.statLabel}>Total Watched</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{avgRating}</span>
            <span className={styles.statLabel}>Avg Rating</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {watchedItems.filter((i) => i.media_type === 'movie').length}
            </span>
            <span className={styles.statLabel}>Movies</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {watchedItems.filter((i) => i.media_type === 'tv').length}
            </span>
            <span className={styles.statLabel}>TV Shows</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {watchedItems.filter((i) => i.media_type === 'anime').length}
            </span>
            <span className={styles.statLabel}>Anime</span>
          </div>
        </motion.div>

        {/* Rating Bar Chart */}
        <motion.div
          className={styles.chartSection}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className={styles.chartTitle}>Rating Distribution</h2>
          <p className={styles.chartHint}>Click a bar to filter by rating</p>

          <div className={styles.chart}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((rating) => {
              const count = distribution[rating];
              const height = count > 0 ? (count / maxCount) * 100 : 4;
              const isSelected = selectedRating === rating;
              const isInactive = selectedRating !== null && !isSelected;

              return (
                <motion.div
                  key={rating}
                  className={`${styles.barCol} ${isSelected ? styles.barSelected : ''} ${isInactive ? styles.barInactive : ''}`}
                  onClick={() => handleBarClick(rating)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className={styles.barCount}>{count || ''}</span>
                  <motion.div
                    className={styles.bar}
                    style={{
                      backgroundColor: RATING_COLORS[rating],
                      boxShadow: isSelected ? `0 0 16px ${RATING_COLORS[rating]}60` : 'none',
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, delay: rating * 0.05, type: 'spring' }}
                  />
                  <span className={styles.barLabel}>
                    <HiStar size={12} /> {rating}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Filters Bar */}
        <motion.div
          className={styles.filterBar}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className={styles.filterLeft}>
            <HiFunnel size={16} />
            <span className={styles.filterLabel}>
              {selectedRating !== null || typeFilter
                ? `Showing ${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''}`
                : `All ${totalWatched} watched`
              }
            </span>
            {selectedRating !== null && (
              <span className={styles.filterTag} style={{ background: `${RATING_COLORS[selectedRating]}25`, color: RATING_COLORS[selectedRating] }}>
                ★ {selectedRating}
              </span>
            )}
            {typeFilter && (
              <span className={styles.filterTag}>
                {MEDIA_TYPE_LABELS[typeFilter]}
              </span>
            )}
          </div>
          <div className={styles.filterRight}>
            {/* Type filter pills */}
            {['movie', 'tv', 'anime'].map((t) => (
              <button
                key={t}
                className={`${styles.typePill} ${typeFilter === t ? styles.typePillActive : ''}`}
                onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
              >
                {t === 'movie' && <HiFilm size={14} />}
                {t === 'tv' && <HiTv size={14} />}
                {t === 'anime' && <HiSparkles size={14} />}
                {MEDIA_TYPE_LABELS[t]}
              </button>
            ))}
            {(selectedRating !== null || typeFilter) && (
              <button className={styles.clearBtn} onClick={clearFilter}>
                <HiXMark size={14} />
                Clear
              </button>
            )}
          </div>
        </motion.div>

        {/* Watched Items Grid */}
        <AnimatePresence mode="popLayout">
          <motion.div className={styles.grid} layout>
            {visibleItems.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <Link href={getHref(item)} className={styles.card}>
                  <div className={styles.cardPoster}>
                    {item.poster_path ? (
                      <Image
                        src={tmdbImage(item.poster_path, 'w342')}
                        alt={item.title}
                        fill
                        sizes="200px"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div className={styles.noPoster}></div>
                    )}
                    {item.user_rating && (
                      <div
                        className={styles.ratingBadge}
                        style={{ background: RATING_COLORS[item.user_rating] }}
                      >
                        <HiStar size={12} />
                        {item.user_rating}
                      </div>
                    )}
                    <div className={styles.typeBadge}>
                      {MEDIA_TYPE_LABELS[item.media_type]}
                    </div>
                  </div>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    {item.watched_date && (
                      <span className={styles.cardDate}>
                        {new Date(item.watched_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                    {item.notes && (
                      <p className={styles.cardNote}>{item.notes}</p>
                    )}
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {hasMoreWatched && (
          <ShowMoreButton shown={shownWatched} total={totalWatchedCount} step={24} onClick={showMoreWatched} />
        )}

        {filteredItems.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}></span>
            <p>No items match this filter</p>
            <button className={styles.clearBtn} onClick={clearFilter}>Clear Filters</button>
          </div>
        )}
      </div>
    </div>
  );
}
