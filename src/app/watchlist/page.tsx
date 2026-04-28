'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { HiArrowDownTray, HiLockClosed } from 'react-icons/hi2';
import WatchlistCard from '@/components/watchlist/WatchlistCard';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import { getWatchlist, updateWatchlistItem, removeFromWatchlist, isPremiumUser } from '@/lib/store';
import { exportWatchlist, PREMIUM_EXPORT_FORMATS, type ExportFormat } from '@/lib/export';
import { WatchlistItem, WatchStatus } from '@/types';
import { WATCH_STATUS_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import styles from './watchlist.module.css';

const EXPORT_OPTIONS: ReadonlyArray<{ format: ExportFormat; label: string }> = [
  { format: 'pdf', label: 'PDF (.pdf)' },
  { format: 'md', label: 'Markdown (.md)' },
  { format: 'txt', label: 'Plain Text (.txt)' },
  { format: 'csv', label: 'CSV (.csv)' },
  { format: 'json', label: 'JSON (.json)' },
];

export default function WatchlistPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [filter, setFilter] = useState<WatchStatus | 'all'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [premium, setPremium] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return; }
    const list = await getWatchlist(user.id);
    setItems(list);
  }, [user]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setPremium(false); return; }
    void isPremiumUser(user.id).then((v) => { if (!cancelled) setPremium(v); });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setShowExportMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExport = (format: ExportFormat) => {
    if (!user) {
      toast.error('Sign in to export your watchlist');
      setShowExportMenu(false);
      return;
    }
    if (PREMIUM_EXPORT_FORMATS.has(format) && !premium) {
      toast.error(`${format.toUpperCase()} export is a Premium feature`);
      setShowExportMenu(false);
      router.push('/premium');
      return;
    }
    try {
      exportWatchlist(filteredItems, user.username || user.display_name || 'User', format);
      toast.success(`Exported as .${format}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    }
    setShowExportMenu(false);
  };

  const filteredItems = filter === 'all' ? items : items.filter((i) => i.status === filter);
  const { visible, shown, total, hasMore, showMore } = useShowMore(filteredItems, 20);

  const handleUpdateStatus = async (id: string, status: WatchStatus, watchedDate?: string | null) => {
    const updates: { status: WatchStatus; watched_date?: string | null } = { status };
    if (status === 'watched') updates.watched_date = watchedDate ?? null;
    await updateWatchlistItem(id, updates);
    void refresh();
    toast.success(`Moved to ${WATCH_STATUS_LABELS[status]}`);
  };

  const handleRate = async (id: string, rating: number) => {
    // Rating now lives in the ratings table; mark this item as watched here.
    await updateWatchlistItem(id, { status: 'watched' });
    void refresh();
    toast.success(`Rated ${rating}/10`);
  };

  const handleRemove = async (id: string) => {
    await removeFromWatchlist(id);
    void refresh();
    toast.success('Removed from list');
  };

  const handleUpdateDate = async (id: string, date: string | null) => {
    await updateWatchlistItem(id, { watched_date: date });
    void refresh();
    toast.success(date ? 'Watch date updated' : 'Watch date cleared');
  };

  const counts = {
    all: items.length,
    watchlist: items.filter((i) => i.status === 'watchlist').length,
    watching: items.filter((i) => i.status === 'watching').length,
    watched: items.filter((i) => i.status === 'watched').length,
    dropped: items.filter((i) => i.status === 'dropped').length,
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>My Watchlist</h1>
          <p className={styles.subtitle}>Track everything you&apos;re watching and want to watch</p>
        </motion.div>

        {/* Filter Tabs + Export */}
        <div className={styles.filters}>
          {(['all', 'watchlist', 'watching', 'watched', 'dropped'] as const).map((status) => (
            <button
              key={status}
              className={`${styles.filterTab} ${filter === status ? styles.activeTab : ''}`}
              onClick={() => setFilter(status)}
            >
              <span>{status === 'all' ? 'All' : WATCH_STATUS_LABELS[status]}</span>
              <span className={styles.count}>{counts[status]}</span>
            </button>
          ))}

          {items.length > 0 && (
            <div className={styles.exportWrap} ref={exportRef}>
              <button
                className={styles.exportBtn}
                onClick={() => setShowExportMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showExportMenu}
                title="Download your list"
              >
                <HiArrowDownTray /> Download
              </button>
              {showExportMenu && (
                <div className={styles.exportMenu} role="menu">
                  {EXPORT_OPTIONS.map(({ format, label }) => {
                    const locked = PREMIUM_EXPORT_FORMATS.has(format) && !premium;
                    return (
                      <button
                        key={format}
                        role="menuitem"
                        onClick={() => handleExport(format)}
                        className={locked ? styles.lockedItem : ''}
                      >
                        <span>{label}</span>
                        {locked && (
                          <span className={styles.lockBadge} title="Premium only">
                            <HiLockClosed /> PRO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* List */}
        <div className={styles.list}>
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <motion.div
                className={styles.empty}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className={styles.emptyIcon}></span>
                <p>No items here yet. Start adding from Movies, TV, or Anime pages!</p>
              </motion.div>
            ) : (
              visible.map((item) => (
                <WatchlistCard
                  key={item.id}
                  item={item}
                  onUpdateStatus={handleUpdateStatus}
                  onRate={handleRate}
                  onRemove={handleRemove}
                  onUpdateDate={handleUpdateDate}
                />
              ))
            )}
          </AnimatePresence>
        </div>

        {hasMore && (
          <ShowMoreButton shown={shown} total={total} step={20} onClick={showMore} />
        )}
      </div>
    </div>
  );
}
