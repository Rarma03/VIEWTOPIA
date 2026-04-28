'use client';

import { use, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  HiStar,
  HiArrowLeft,
  HiPlus,
  HiCheck,
  HiClock,
  HiBookOpen,
  HiTrash,
  HiArrowTopRightOnSquare,
  HiPencilSquare,
  HiXMark,
  HiHeart,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { MangaItem } from '@/types';
import { getMangaDetails, mangaImage } from '@/lib/jikan';
import {
  getEntry,
  upsertEntry,
  removeEntry,
  subscribe,
  STATUS_LABELS,
  STATUS_COLORS,
  ReadStatus,
  MangaTrackerEntry,
} from '@/lib/mangaTracker';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Loader from '@/components/common/Loader';
import ChapterPicker from '@/components/common/ChapterPicker/ChapterPicker';
import RecommendModal from '@/components/common/RecommendModal';
import styles from './mangaDetail.module.css';

const STATUS_OPTIONS: { key: ReadStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'plan', label: 'Plan to Read', icon: <HiClock size={14} /> },
  { key: 'reading', label: 'Reading', icon: <HiBookOpen size={14} /> },
  { key: 'completed', label: 'Completed', icon: <HiCheck size={14} /> },
  { key: 'dropped', label: 'Dropped', icon: <HiXMark size={14} /> },
];

export default function MangaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [manga, setManga] = useState<MangaItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entry, setEntry] = useState<MangaTrackerEntry | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Fetch manga details
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getMangaDetails(Number(id))
      .then((res) => { if (!cancelled) setManga(res.data as MangaItem); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Load tracker entry whenever user or manga changes; refresh on tracker change events.
  const refreshEntry = useCallback(async () => {
    if (!manga) return;
    const e = await getEntry(user?.id ?? null, manga.mal_id);
    setEntry(e);
  }, [user?.id, manga]);

  useEffect(() => { void refreshEntry(); }, [refreshEntry]);
  useEffect(() => subscribe(() => { void refreshEntry(); }), [refreshEntry]);

  // Close status menu on outside click
  useEffect(() => {
    if (!statusOpen) return;
    const onClick = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [statusOpen]);

  if (loading) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <Loader />
      </div>
    );
  }
  if (error || !manga) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <Link href="/read" className={styles.backLink}>
            <HiArrowLeft size={16} /> Back to Read
          </Link>
          <p className={styles.notFound}>{error || 'Title not found'}</p>
        </div>
      </div>
    );
  }

  const handleSetStatus = async (status: ReadStatus) => {
    setStatusOpen(false);
    const updated = await upsertEntry(user?.id ?? null, manga, { status });
    if (updated) {
      setEntry(updated);
      toast.success(`Marked as ${STATUS_LABELS[status]}`);
      // When the user picks "Reading", offer the chapter picker right away.
      if (status === 'reading') setShowChapterPicker(true);
    }
  };

  const handleSaveChapters = async (chaptersRead: number) => {
    const status: ReadStatus =
      manga.chapters && chaptersRead >= manga.chapters ? 'completed' : 'reading';
    const updated = await upsertEntry(user?.id ?? null, manga, {
      chapters_read: chaptersRead,
      status,
    });
    if (updated) {
      setEntry(updated);
      toast.success(`Saved: ${chaptersRead}${manga.chapters ? ` / ${manga.chapters}` : ''} chapters`);
    }
    setShowChapterPicker(false);
  };

  const handleRemove = async () => {
    await removeEntry(user?.id ?? null, manga.mal_id);
    setEntry(null);
    toast.success('Removed from your list');
  };

  const tracked = Boolean(entry);
  const posterUrl = mangaImage(manga, 'large');
  const totalCh = manga.chapters ?? entry?.total_chapters ?? null;
  const readCh = entry?.chapters_read ?? 0;
  const pct = totalCh ? Math.min(100, Math.round((readCh / totalCh) * 100)) : 0;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.backdrop} style={{ backgroundImage: `url(${posterUrl})` }} />
      <div className={styles.backdropGradient} />

      <div className={styles.container}>
        <Link href="/read" className={styles.backLink}>
          <HiArrowLeft size={16} /> Back to Read
        </Link>

        <div className={styles.hero}>
          <div className={styles.posterWrap}>
            <Image
              src={posterUrl}
              alt={manga.title_english || manga.title}
              fill
              sizes="(max-width: 720px) 240px, 280px"
              className={styles.poster}
              priority
            />
          </div>

          <div className={styles.details}>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{manga.title_english || manga.title}</h1>
              {manga.title_english && manga.title !== manga.title_english && (
                <span className={styles.englishTitle}>· {manga.title}</span>
              )}
            </div>

            <div className={styles.badges}>
              <span className={`${styles.badge} ${styles.badgeType}`}>{manga.type}</span>
              {manga.status && <span className={`${styles.badge} ${styles.badgeStatus}`}>{manga.status}</span>}
              {manga.score && (
                <span className={`${styles.badge} ${styles.badgeScore}`}>
                  <HiStar size={12} /> {manga.score}
                </span>
              )}
              {manga.rank && <span className={`${styles.badge} ${styles.badgeRank}`}>#{manga.rank} ranked</span>}
            </div>

            <div className={styles.statsRow}>
              {manga.chapters != null && (
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Chapters</div>
                  <div className={styles.statValue}>{manga.chapters}</div>
                </div>
              )}
              {manga.volumes != null && (
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Volumes</div>
                  <div className={styles.statValue}>{manga.volumes}</div>
                </div>
              )}
              {manga.scored_by != null && (
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Scored by</div>
                  <div className={styles.statValue}>{formatNumber(manga.scored_by)}</div>
                </div>
              )}
              {manga.popularity != null && (
                <div className={styles.statCard}>
                  <div className={styles.statLabel}>Popularity</div>
                  <div className={styles.statValue}>#{manga.popularity}</div>
                </div>
              )}
            </div>

            {manga.genres.length > 0 && (
              <div className={styles.genres}>
                {manga.genres.map((g) => (
                  <span key={g.mal_id} className={styles.genre}>{g.name}</span>
                ))}
              </div>
            )}

            <div className={styles.actionRow}>
              <div className={styles.statusMenu} ref={statusMenuRef}>
                <button
                  className={`${styles.actionBtn} ${tracked ? '' : styles.actionPrimary}`}
                  onClick={() => setStatusOpen((o) => !o)}
                  style={tracked && entry ? { borderColor: STATUS_COLORS[entry.status] } : undefined}
                >
                  {tracked ? <HiCheck size={16} /> : <HiPlus size={16} />}
                  {tracked && entry ? STATUS_LABELS[entry.status] : 'Add to my list'}
                </button>
                <AnimatePresence>
                  {statusOpen && (
                    <motion.div
                      className={styles.statusDropdown}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <button
                          key={s.key}
                          className={`${styles.statusItem} ${entry?.status === s.key ? styles.statusItemActive : ''}`}
                          onClick={() => handleSetStatus(s.key)}
                        >
                          <span className={styles.statusDot} style={{ background: STATUS_COLORS[s.key] }} />
                          {s.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {tracked && (
                <button
                  className={styles.actionBtn}
                  onClick={() => setShowChapterPicker(true)}
                  title="Update chapters read"
                >
                  <HiPencilSquare size={16} />
                  {readCh > 0
                    ? `${readCh}${totalCh ? ` / ${totalCh}` : ''} chapters`
                    : 'Set progress'}
                </button>
              )}

              {tracked && (
                <button
                  className={`${styles.actionBtn} ${styles.actionDanger}`}
                  onClick={handleRemove}
                >
                  <HiTrash size={16} /> Remove
                </button>
              )}

              <button
                className={styles.actionBtn}
                onClick={() => setShowRecommend(true)}
                title="Recommend this title"
              >
                <HiHeart size={16} /> Recommend
              </button>
            </div>

            {tracked && totalCh != null && (
              <div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                </div>
                <div className={styles.progressLabel}>
                  <span>{pct}% complete</span>
                  <span>{readCh} / {totalCh} chapters</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {manga.synopsis && (
          <div className={styles.synopsis}>
            <div className={styles.sectionTitle}>Synopsis</div>
            <p className={styles.synopsisText}>{manga.synopsis}</p>
          </div>
        )}

        <div className={styles.metaSection}>
          {manga.authors && manga.authors.length > 0 && (
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Author{manga.authors.length > 1 ? 's' : ''}</div>
              <div className={styles.metaValue}>{manga.authors.map((a) => a.name).join(', ')}</div>
            </div>
          )}
          {manga.serializations && manga.serializations.length > 0 && (
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Serialization</div>
              <div className={styles.metaValue}>
                {manga.serializations.map((s) => s.name).join(', ')}
              </div>
            </div>
          )}
          {manga.published?.string && (
            <div className={styles.metaCard}>
              <div className={styles.metaLabel}>Published</div>
              <div className={styles.metaValue}>{manga.published.string}</div>
            </div>
          )}
        </div>

        <a
          href={`https://myanimelist.net/manga/${manga.mal_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.malLink}
        >
          View on MyAnimeList <HiArrowTopRightOnSquare size={12} />
        </a>
      </div>

      <ChapterPicker
        open={showChapterPicker}
        title={manga.title_english || manga.title}
        totalChapters={totalCh}
        initialValue={readCh}
        onCancel={() => setShowChapterPicker(false)}
        onSave={handleSaveChapters}
      />

      <RecommendModal
        isOpen={showRecommend}
        onClose={() => setShowRecommend(false)}
        mediaTitle={manga.title_english || manga.title}
        mediaId={manga.mal_id}
        mediaType="manga"
        posterPath={manga.images?.jpg?.image_url ?? null}
      />
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
