'use client';

import { motion } from 'framer-motion';
import { useTheme } from '@/context/ThemeContext';
import styles from './RatingDisplay.module.css';
import { HiStar, HiUsers, HiGlobeAlt } from 'react-icons/hi2';

interface RatingDisplayProps {
  platformAverage: number;
  platformCount: number;
  globalAverage: number;
  maxRating?: number;
}

export default function RatingDisplay({
  platformAverage,
  platformCount,
  globalAverage,
  maxRating = 10,
}: RatingDisplayProps) {
  const { isDark } = useTheme();

  return (
    <div className={`${styles.container} ${isDark ? styles.dark : styles.light}`}>
      {/* Platform Rating */}
      <motion.div
        className={styles.ratingCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className={styles.cardIcon}>
          <HiUsers size={24} />
        </div>
        <div className={styles.cardContent}>
          <span className={styles.label}>Viewtopia Rating</span>
          <div className={styles.ratingValue}>
            <HiStar className={styles.starIcon} />
            <span className={styles.number}>{platformAverage > 0 ? platformAverage.toFixed(1) : '—'}</span>
            <span className={styles.max}>/{maxRating}</span>
          </div>
          <span className={styles.count}>{platformCount} {platformCount === 1 ? 'rating' : 'ratings'}</span>
        </div>
        <div className={styles.progressBar}>
          <motion.div
            className={styles.progressFill}
            style={{ background: 'linear-gradient(90deg, #e50914, #ff6b6b)' }}
            initial={{ width: 0 }}
            animate={{ width: `${(platformAverage / maxRating) * 100}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>

      {/* Global Rating */}
      <motion.div
        className={styles.ratingCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className={styles.cardIcon}>
          <HiGlobeAlt size={24} />
        </div>
        <div className={styles.cardContent}>
          <span className={styles.label}>Global Rating</span>
          <div className={styles.ratingValue}>
            <HiStar className={styles.starIcon} />
            <span className={styles.number}>{globalAverage > 0 ? globalAverage.toFixed(1) : '—'}</span>
            <span className={styles.max}>/{maxRating}</span>
          </div>
          <span className={styles.count}>TMDB / MAL</span>
        </div>
        <div className={styles.progressBar}>
          <motion.div
            className={styles.progressFill}
            style={{ background: 'linear-gradient(90deg, #ffd700, #ffaa00)' }}
            initial={{ width: 0 }}
            animate={{ width: `${(globalAverage / maxRating) * 100}%` }}
            transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </div>
  );
}
