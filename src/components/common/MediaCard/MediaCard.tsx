'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { HiStar, HiBookmark } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { MediaItem } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { GENRE_MAP, MEDIA_TYPE_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import styles from './MediaCard.module.css';

interface MediaCardProps {
  item: MediaItem;
  onAddToWatchlist?: (item: MediaItem) => void;
  variant?: 'default' | 'compact' | 'wide';
}

export default function MediaCard({ item, onAddToWatchlist, variant = 'default' }: MediaCardProps) {
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const detailHref = item.media_type === 'movie' ? `/movies/${item.id}` : item.media_type === 'anime' ? `/anime/${item.id}` : `/tv/${item.id}`;
  const year = item.release_date ? new Date(item.release_date).getFullYear() : '';
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
  const genreNames = item.genre_ids?.slice(0, 2).map((id) => GENRE_MAP[id]).filter(Boolean) || [];

  return (
    <motion.div
      className={`${styles.card} ${styles[variant]} ${isDark ? styles.dark : styles.light}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Link href={detailHref} className={styles.imageWrapper}>
        <Image
          src={tmdbImage(item.poster_path)}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          className={styles.poster}
        />
        <div className={styles.ratingBadge}>
          <HiStar size={12} />
          <span>{rating}</span>
        </div>
        <div className={styles.typeBadge}>
          {MEDIA_TYPE_LABELS[item.media_type] || item.media_type}
        </div>
      </Link>

      <div className={styles.info}>
        <Link href={detailHref} className={styles.title}>
          {item.title}
        </Link>
        <div className={styles.meta}>
          {year && <span className={styles.year}>{year}</span>}
          {genreNames.length > 0 && (
            <span className={styles.genres}>{genreNames.join(' · ')}</span>
          )}
        </div>
        {onAddToWatchlist && (
          <button
            className={styles.watchlistBtn}
            onClick={(e) => {
              e.preventDefault();
              if (!isAuthenticated) {
                toast.error('Please log in to use your watchlist');
                router.push('/login');
                return;
              }
              onAddToWatchlist(item);
            }}
            aria-label="Add to watchlist"
          >
            <HiBookmark size={14} />
            <span>Watchlist</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
