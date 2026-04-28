'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiHeart, HiClock } from 'react-icons/hi2';
import { Recommendation } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { MEDIA_TYPE_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import styles from './RecommendationCard.module.css';

interface RecommendationCardProps {
  rec: Recommendation;
}

export default function RecommendationCard({ rec }: RecommendationCardProps) {
  const { isDark } = useTheme();
  const detailHref =
    rec.media_type === 'movie' ? `/movies/${rec.media_id}` :
    rec.media_type === 'tv' ? `/tv/${rec.media_id}` :
    rec.media_type === 'manga' ? `/read/${rec.media_id}` :
    `/anime/${rec.media_id}`;
  const timeAgo = formatDistanceToNow(new Date(rec.created_at), { addSuffix: true });

  return (
    <motion.div
      className={`${styles.card} ${isDark ? styles.dark : styles.light}`}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <Link href={detailHref} className={styles.posterWrapper}>
        <Image
          src={tmdbImage(rec.poster_path)}
          alt={rec.title}
          fill
          sizes="(max-width: 640px) 100vw, 200px"
          className={styles.poster}
        />
        <div className={styles.heartBadge}>
          <HiHeart size={16} />
        </div>
      </Link>

      <div className={styles.content}>
        <div className={styles.recommender}>
          <Link href={`/profile/${rec.user_id}`} className={styles.avatar}>
            {rec.user?.display_name?.charAt(0).toUpperCase() || 'U'}
          </Link>
          <Link href={`/profile/${rec.user_id}`} className={styles.name}>{rec.user?.display_name || 'User'}</Link>
          <span className={styles.time}><HiClock size={12} /> {timeAgo}</span>
        </div>
        <Link href={detailHref} className={styles.title}>{rec.title}</Link>
        <span className={styles.type}>{MEDIA_TYPE_LABELS[rec.media_type]}</span>
        {rec.message && <p className={styles.message}>&ldquo;{rec.message}&rdquo;</p>}
      </div>
    </motion.div>
  );
}
