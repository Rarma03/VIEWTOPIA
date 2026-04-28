'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiClock, HiBookmark, HiHeart, HiEye } from 'react-icons/hi2';
import { ActivityItem, ActivityType } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { MEDIA_TYPE_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { formatDistanceToNow, format } from 'date-fns';
import styles from './ActivityFeed.module.css';

const activityIcons: Record<ActivityType, React.ComponentType<{ size?: number }>> = {
  watched: HiEye,
  rated: HiStar,
  added_to_watchlist: HiBookmark,
  recommended: HiHeart,
};

const activityLabels: Record<ActivityType, string> = {
  watched: 'watched',
  rated: 'rated',
  added_to_watchlist: 'added to watchlist',
  recommended: 'recommended',
};

interface ActivityFeedProps {
  activities: ActivityItem[];
}

export default function ActivityFeed({ activities }: ActivityFeedProps) {
  const { isDark } = useTheme();

  return (
    <div className={styles.feed}>
      {activities.map((activity, i) => {
        const Icon = activityIcons[activity.activity_type];
        let detailHref: string;
        if (activity.media_type === 'movie') detailHref = `/movies/${activity.media_id}`;
        else if (activity.media_type === 'tv') detailHref = `/tv/${activity.media_id}`;
        else if (activity.media_type === 'manga') detailHref = `/read/${activity.media_id}`;
        else detailHref = `/anime/${activity.media_id}`;
        const actionLabel = activity.activity_type === 'watched' && activity.media_type === 'manga'
          ? 'completed' : activityLabels[activity.activity_type];
        // Manga posters from Jikan come as full URLs; movie/TV use TMDB paths.
        const posterSrc = activity.poster_path
          ? (activity.poster_path.startsWith('http') ? activity.poster_path : tmdbImage(activity.poster_path, 'w92'))
          : null;
        const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });
        const dateObj = new Date(activity.created_at);
        const dayNum = format(dateObj, 'd');
        const monthLabel = format(dateObj, 'MMM');

        return (
          <motion.div
            key={activity.id}
            className={`${styles.activityItem} ${isDark ? styles.dark : styles.light}`}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div className={styles.dateColumn}>
              <span className={styles.dateNum}>{dayNum}</span>
              <span className={styles.dateMonth}>{monthLabel}</span>
            </div>

            <div className={styles.timeline}>
              <div className={styles.iconCircle}>
                <Icon size={16} />
              </div>
              {i < activities.length - 1 && <div className={styles.line} />}
            </div>

            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.userInfo}>
                  <Link href={`/profile/${activity.user_id}`} className={styles.avatar}>
                    {activity.user?.display_name?.charAt(0).toUpperCase() || 'U'}
                  </Link>
                  <div>
                    <Link href={`/profile/${activity.user_id}`} className={styles.username}>{activity.user?.display_name || 'User'}</Link>
                    <span className={styles.action}> {actionLabel}</span>
                  </div>
                </div>
                <span className={styles.time}>
                  <HiClock size={12} /> {timeAgo}
                </span>
              </div>

              <Link href={detailHref} className={styles.mediaLink}>
                {posterSrc && (
                  <div className={styles.miniPoster}>
                    <Image
                      src={posterSrc}
                      alt={activity.title}
                      fill
                      sizes="48px"
                      className={styles.posterImg}
                    />
                  </div>
                )}
                <div className={styles.mediaInfo}>
                  <span className={styles.mediaTitle}>{activity.title}</span>
                  <span className={styles.mediaType}>{MEDIA_TYPE_LABELS[activity.media_type]}</span>
                </div>
              </Link>

              {activity.rating && (
                <div className={styles.ratingRow}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <HiStar key={i} size={14} className={i < activity.rating! ? styles.starFilled : styles.starEmpty} />
                  ))}
                  <span className={styles.ratingNum}>{activity.rating}/10</span>
                </div>
              )}

              {activity.message && (
                <p className={styles.message}>&ldquo;{activity.message}&rdquo;</p>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
