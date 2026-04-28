'use client';

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { HiChevronLeft, HiChevronRight, HiArrowRight } from 'react-icons/hi2';
import { MediaItem } from '@/types';
import MediaCard from '@/components/common/MediaCard';
import { useTheme } from '@/context/ThemeContext';
import Link from 'next/link';
import styles from './MediaRow.module.css';

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  viewAllHref?: string;
  onAddToWatchlist?: (item: MediaItem) => void;
}

export default function MediaRow({ title, items, viewAllHref, onAddToWatchlist }: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
    }
  };

  return (
    <section className={`${styles.section} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className={styles.viewAll}>
            View All <HiArrowRight size={16} />
          </Link>
        )}
      </div>
      <div className={styles.rowWrapper}>
        <button className={`${styles.scrollBtn} ${styles.scrollLeft}`} onClick={() => scroll('left')} aria-label="Scroll left">
          <HiChevronLeft size={24} />
        </button>
        <div className={styles.row} ref={scrollRef}>
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              className={styles.cardWrapper}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <MediaCard item={item} onAddToWatchlist={onAddToWatchlist} variant="compact" />
            </motion.div>
          ))}
        </div>
        <button className={`${styles.scrollBtn} ${styles.scrollRight}`} onClick={() => scroll('right')} aria-label="Scroll right">
          <HiChevronRight size={24} />
        </button>
      </div>
    </section>
  );
}
