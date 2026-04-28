'use client';

import { use, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiBookmark, HiPlay, HiCalendar, HiHeart, HiCheckCircle } from 'react-icons/hi2';
import { AnimeItem, WatchlistItem } from '@/types';
import { getAnimeDetails, jikanImage } from '@/lib/jikan';
import { addRating, addToWatchlist, isInWatchlist, updateWatchlistItem, getRatings, removeRating } from '@/lib/store';
import StarRating from '@/components/common/StarRating';
import RecommendModal from '@/components/common/RecommendModal';
import WatchedDateModal from '@/components/common/WatchedDateModal';
import EpisodeRatingGrid from '@/components/common/EpisodeRatingGrid/EpisodeRatingGrid';
import Loader from '@/components/common/Loader';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import styles from './animeDetail.module.css';

export default function AnimeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [anime, setAnime] = useState<AnimeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRecommend, setShowRecommend] = useState(false);
  const [askWatchedDate, setAskWatchedDate] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [watchlistEntry, setWatchlistEntry] = useState<WatchlistItem | null>(null);
  const isWatched = watchlistEntry?.status === 'watched';
  const isInList = !!watchlistEntry;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAnimeDetails(Number(id))
      .then((res) => {
        if (!cancelled) setAnime(res.data as AnimeItem);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load anime');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!anime || !user) { setWatchlistEntry(null); setUserRating(0); return; }
    let cancelled = false;
    void Promise.all([
      isInWatchlist(user.id, anime.mal_id, 'anime'),
      getRatings({ mediaId: anime.mal_id, mediaType: 'anime', userId: user.id }),
    ]).then(([entry, mine]) => {
      if (cancelled) return;
      setWatchlistEntry(entry);
      setUserRating(mine[0]?.rating ?? 0);
    });
    return () => { cancelled = true; };
  }, [anime, user]);

  if (loading) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <Loader />
      </div>
    );
  }

  if (error || !anime) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <p className={styles.notFound}>{error || 'Anime not found'}</p>
        </div>
      </div>
    );
  }

  // ---- Per-episode progress helpers (defined post-guards so anime is non-null) ----
  const handleSetProgress = async (_season: number, episode: number) => {
    if (!user) { toast.error('Please log in first'); router.push('/login'); return; }
    let entry: WatchlistItem | null = watchlistEntry;
    if (!entry) {
      entry = await addToWatchlist({
        user_id: user.id, media_id: anime.mal_id, media_type: 'anime',
        title: anime.title_english || anime.title,
        poster_path: anime.images?.jpg?.image_url || null,
        status: 'watching', watched_date: null, notes: null,
        original_language: 'ja',
      });
    }
    if (!entry) { toast.error('Could not save progress'); return; }
    const nextStatus: typeof entry.status = entry.status === 'watched' ? 'watched' : 'watching';
    const updated = await updateWatchlistItem(entry.id, {
      status: nextStatus,
      last_watched_season: 1,
      last_watched_episode: episode,
    });
    if (updated) setWatchlistEntry(updated);
    toast.success(`Progress saved: Episode ${episode}`);
  };

  const handleResetProgress = async () => {
    if (!watchlistEntry) return;
    const updated = await updateWatchlistItem(watchlistEntry.id, {
      last_watched_season: null,
      last_watched_episode: null,
    });
    if (updated) setWatchlistEntry(updated);
    toast.success('Progress reset');
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      {/* Backdrop (use large image as backdrop) */}
      <div className={styles.backdrop} style={{ backgroundImage: `url(${anime.images?.jpg?.large_image_url || ''})` }}>
        <div className={styles.backdropGradient} />
      </div>

      <div className={styles.container}>
        <div className={styles.content}>
          <motion.div
            className={styles.posterWrapper}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Image
              src={jikanImage(anime)}
              alt={anime.title_english || anime.title}
              fill
              sizes="300px"
              className={styles.poster}
              priority
            />
          </motion.div>

          <motion.div
            className={styles.details}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={styles.badges}>
              <span className={styles.typeBadge}>{anime.type}</span>
              <span className={styles.statusBadge}>{anime.status}</span>
              {isWatched && (
                <span className={styles.watchedBadge}>
                  <HiCheckCircle size={14} /> Watched
                </span>
              )}
              {anime.genres.map((g) => (
                <span key={g.mal_id} className={styles.genreBadge}>{g.name}</span>
              ))}
            </div>

            <h1 className={styles.title}>{anime.title_english || anime.title}</h1>
            {anime.title_english && anime.title !== anime.title_english && (
              <p className={styles.altTitle}>{anime.title}</p>
            )}

            <div className={styles.meta}>
              {anime.year && <span><HiCalendar size={14} /> {anime.year}</span>}
              {anime.score && <span><HiStar size={14} /> {anime.score}</span>}
              {anime.episodes && <span>{anime.episodes} episodes</span>}
              {anime.duration && <span>{anime.duration}</span>}
            </div>

            {anime.synopsis && (
              <p className={styles.overview}>{anime.synopsis}</p>
            )}

            {/* Score info */}
            {anime.score && (
              <div className={styles.scoreBox}>
                <div className={styles.scoreMain}>
                  <HiStar size={28} />
                  <span className={styles.scoreValue}>{anime.score}</span>
                  <span className={styles.scoreLabel}>/ 10</span>
                </div>
                {anime.scored_by && (
                  <span className={styles.scoredBy}>{anime.scored_by.toLocaleString()} users scored</span>
                )}
              </div>
            )}

            {/* Stats */}
            <div className={styles.stats}>
              {anime.rank && (
                <Link href="/rankings?type=anime&cat=top" className={styles.stat} title="View top-ranked anime">
                  <span className={styles.statValue}>#{anime.rank}</span>
                  <span className={styles.statLabel}>Rank</span>
                </Link>
              )}
              {anime.popularity && (
                <Link href="/rankings?type=anime&cat=popular" className={styles.stat} title="View most popular anime">
                  <span className={styles.statValue}>#{anime.popularity}</span>
                  <span className={styles.statLabel}>Popularity</span>
                </Link>
              )}
              {anime.members && (
                <Link href="/rankings?type=anime&cat=favorite" className={styles.stat} title="View most favorited anime">
                  <span className={styles.statValue}>{(anime.members / 1000).toFixed(0)}K</span>
                  <span className={styles.statLabel}>Members</span>
                </Link>
              )}
            </div>

            {/* Rate */}
            <div className={styles.rateSection}>
              <div className={styles.rateHeader}>
                <h3>Rate this anime</h3>
                {userRating > 0 && (
                  <button
                    type="button"
                    className={styles.clearRatingBtn}
                    onClick={async () => {
                      if (!user) return;
                      if (!window.confirm('Clear your rating for this anime?')) return;
                      const ok = await removeRating(user.id, anime.mal_id, 'anime');
                      if (ok) { setUserRating(0); toast.success('Rating cleared'); }
                      else toast.error('Could not clear rating');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <StarRating rating={userRating} onRate={async (r) => {
                if (!user) { toast.error('Please log in first'); router.push('/login'); return; }
                setUserRating(r);
                const today = new Date().toISOString().split('T')[0];
                await addRating({ user_id: user.id, media_id: anime.mal_id, media_type: 'anime', rating: r, review: null, title: anime.title_english || anime.title, poster_path: anime.images?.jpg?.image_url || null });
                let entry: WatchlistItem | null = null;
                if (watchlistEntry) {
                  entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: today });
                } else {
                  entry = await addToWatchlist({ user_id: user.id, media_id: anime.mal_id, media_type: 'anime', title: anime.title_english || anime.title, poster_path: anime.images?.jpg?.image_url || null, status: 'watched', watched_date: today, notes: null, original_language: 'ja' });
                }
                if (entry) setWatchlistEntry({ ...entry, user_rating: r });
                toast.success(`Rated ${r}/10`);
              }} maxRating={10} size={24} />
            </div>

            <div className={styles.actions}>
              <button className={`${styles.primaryBtn} ${isInList ? styles.addedBtn : ''}`} disabled={isInList} onClick={async () => {
                if (!user) { toast.error('Please log in first'); router.push('/login'); return; }
                if (isInList) { toast('Already in your watchlist!'); return; }
                const entry = await addToWatchlist({ user_id: user.id, media_id: anime.mal_id, media_type: 'anime', title: anime.title_english || anime.title, poster_path: anime.images?.jpg?.image_url || null, status: 'watchlist', watched_date: null, notes: null, original_language: 'ja' });
                if (entry) setWatchlistEntry(entry);
                toast.success('Added to watchlist!');
              }}>
                {isInList ? <HiCheckCircle size={18} /> : <HiBookmark size={18} />}
                {isInList ? 'Added' : 'Add to Watchlist'}
              </button>
              <button className={`${styles.secondaryBtn} ${isWatched ? styles.watchedActiveBtn : ''}`} onClick={async () => {
                if (!user) { toast.error('Please log in first'); router.push('/login'); return; }
                if (isWatched && watchlistEntry) {
                  const updated = await updateWatchlistItem(watchlistEntry.id, { status: 'watchlist', watched_date: null });
                  if (updated) setWatchlistEntry(updated);
                  toast.success('Unmarked as watched');
                  return;
                }
                setAskWatchedDate(true);
              }}>
                {isWatched ? <HiCheckCircle size={18} /> : <HiPlay size={18} />}
                {isWatched ? 'Watched' : 'Mark as Watched'}
              </button>
              <button className={styles.recommendBtn} onClick={() => setShowRecommend(true)}>
                <HiHeart size={18} />
                Recommend
              </button>
            </div>

            <RecommendModal
              isOpen={showRecommend}
              onClose={() => setShowRecommend(false)}
              mediaTitle={anime.title_english || anime.title}
              mediaId={anime.mal_id}
              mediaType="anime"
              posterPath={anime.images?.jpg?.image_url || null}
            />

            <WatchedDateModal
              open={askWatchedDate}
              title={anime.title_english || anime.title}
              initialDate={watchlistEntry?.watched_date}
              onCancel={() => setAskWatchedDate(false)}
              onConfirm={async (date) => {
                setAskWatchedDate(false);
                if (!user) return;
                let entry: WatchlistItem | null;
                if (watchlistEntry) {
                  entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: date });
                } else {
                  entry = await addToWatchlist({ user_id: user.id, media_id: anime.mal_id, media_type: 'anime', title: anime.title_english || anime.title, poster_path: anime.images?.jpg?.image_url || null, status: 'watched', watched_date: date, notes: null, original_language: 'ja' });
                }
                if (entry) setWatchlistEntry(entry);
                toast.success('Marked as watched!');
              }}
            />

            {/* Episode rating grid */}
            <EpisodeRatingGrid
              mode="anime"
              malId={anime.mal_id}
              progress={
                watchlistEntry?.last_watched_episode
                  ? { season: 1, episode: watchlistEntry.last_watched_episode }
                  : null
              }
              onSetProgress={handleSetProgress}
              onResetProgress={handleResetProgress}
              onMarkAll={() => {
                if (isWatched) { toast('Already marked as watched'); return; }
                setAskWatchedDate(true);
              }}
            />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
