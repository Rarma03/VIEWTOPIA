'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiCalendar, HiTrash, HiEye, HiBookmark, HiXMark } from 'react-icons/hi2';
import { WatchlistItem, WatchStatus } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { WATCH_STATUS_LABELS, WATCH_STATUS_COLORS, MEDIA_TYPE_LABELS } from '@/lib/constants';
import StarRating from '@/components/common/StarRating';
import WatchedDateModal from '@/components/common/WatchedDateModal';
import { useTheme } from '@/context/ThemeContext';
import styles from './WatchlistCard.module.css';

interface WatchlistCardProps {
  item: WatchlistItem;
  /** When status becomes 'watched' the optional watchedDate is the user's chosen date (or null = don't remember). */
  onUpdateStatus?: (id: string, status: WatchStatus, watchedDate?: string | null) => void;
  onRate?: (id: string, rating: number) => void;
  onRemove?: (id: string) => void;
  onUpdateDate?: (id: string, date: string | null) => void;
}

export default function WatchlistCard({ item, onUpdateStatus, onRate, onRemove, onUpdateDate }: WatchlistCardProps) {
  const { isDark } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateValue, setDateValue] = useState(item.watched_date || '');
  const [askDateOpen, setAskDateOpen] = useState(false);

  const detailHref = item.media_type === 'movie' ? `/movies/${item.media_id}` : item.media_type === 'tv' ? `/tv/${item.media_id}` : `/anime/${item.media_id}`;

  const handleDateSave = () => {
    onUpdateDate?.(item.id, dateValue || null);
    setShowDatePicker(false);
  };

  return (
    <motion.div
      className={`${styles.card} ${isDark ? styles.dark : styles.light}`}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <Link href={detailHref} className={styles.posterWrapper}>
        <Image
          src={tmdbImage(item.poster_path)}
          alt={item.title}
          fill
          sizes="120px"
          className={styles.poster}
        />
        <div
          className={styles.statusBadge}
          style={{ background: WATCH_STATUS_COLORS[item.status] }}
        >
          {WATCH_STATUS_LABELS[item.status]}
        </div>
      </Link>

      <div className={styles.info}>
        <div className={styles.topRow}>
          <Link href={detailHref} className={styles.title}>{item.title}</Link>
          <span className={styles.typeBadge}>{MEDIA_TYPE_LABELS[item.media_type]}</span>
        </div>

        {/* Rating */}
        {item.status === 'watched' && (
          <div className={styles.ratingRow}>
            <StarRating
              rating={item.user_rating || 0}
              onRate={(r) => onRate?.(item.id, r)}
              size={16}
              maxRating={10}
              showValue
            />
          </div>
        )}

        {/* Watch date */}
        {item.watched_date && (
          <div className={styles.dateRow}>
            <HiCalendar size={14} />
            <span>Watched: {new Date(item.watched_date).toLocaleDateString()}</span>
          </div>
        )}

        {item.notes && <p className={styles.notes}>{item.notes}</p>}

        {/* Actions */}
        <div className={styles.actions}>
          {/* Status selector */}
          <div className={styles.statusSelector}>
            {(['watchlist', 'watching', 'watched', 'dropped'] as WatchStatus[]).map((status) => (
              <button
                key={status}
                className={`${styles.statusBtn} ${item.status === status ? styles.activeStatus : ''}`}
                style={item.status === status ? { background: WATCH_STATUS_COLORS[status], color: '#fff' } : {}}
                onClick={() => {
                  if (status === 'watched' && item.status !== 'watched') {
                    setAskDateOpen(true);
                  } else {
                    onUpdateStatus?.(item.id, status);
                  }
                }}
              >
                {status === 'watchlist' && <HiBookmark size={12} />}
                {status === 'watching' && <HiEye size={12} />}
                {status === 'watched' && <HiStar size={12} />}
                {status === 'dropped' && <HiXMark size={12} />}
                <span>{WATCH_STATUS_LABELS[status]}</span>
              </button>
            ))}
          </div>

          <div className={styles.actionBtns}>
            <button className={styles.actionBtn} onClick={() => setShowDatePicker(!showDatePicker)} title="Set watch date">
              <HiCalendar size={16} />
            </button>
            <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onRemove?.(item.id)} title="Remove">
              <HiTrash size={16} />
            </button>
          </div>
        </div>

        {/* Date picker */}
        <AnimatePresence>
          {showDatePicker && (
            <motion.div
              className={styles.datePicker}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className={styles.dateInput}
              />
              <div className={styles.dateActions}>
                <button onClick={handleDateSave} className={styles.dateSaveBtn}>Save</button>
                <button onClick={() => { setDateValue(''); onUpdateDate?.(item.id, null); setShowDatePicker(false); }} className={styles.dateClearBtn}>
                  Don&apos;t Remember
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <WatchedDateModal
        open={askDateOpen}
        title={item.title}
        initialDate={item.watched_date}
        onCancel={() => setAskDateOpen(false)}
        onConfirm={(date) => {
          setAskDateOpen(false);
          onUpdateStatus?.(item.id, 'watched', date);
        }}
      />
    </motion.div>
  );
}
