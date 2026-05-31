'use client';

import { use, useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiBookmark, HiPlay, HiCalendar, HiHeart, HiCheckCircle } from 'react-icons/hi2';
import { getTVDetails, tmdbImage, tmdbBackdrop } from '@/lib/tmdb';
import { TVDetails, WatchlistItem, UserRating } from '@/types';
import { getRatings, addRating, addToWatchlist, isInWatchlist, updateWatchlistItem, removeRating } from '@/lib/store';
import RatingDisplay from '@/components/common/RatingDisplay';
import StarRating from '@/components/common/StarRating';
import RecommendModal from '@/components/common/RecommendModal';
import WatchedDateModal from '@/components/common/WatchedDateModal';
import EpisodeRatingGrid from '@/components/common/EpisodeRatingGrid/EpisodeRatingGrid';
import Loader from '@/components/common/Loader';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import styles from './tvDetail.module.css';

export default function TVDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [showRecommend, setShowRecommend] = useState(false);
  const [askWatchedDate, setAskWatchedDate] = useState(false);
  const [show, setShow] = useState<TVDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [watchlistEntry, setWatchlistEntry] = useState<WatchlistItem | null>(null);
  const [showRatings, setShowRatings] = useState<UserRating[]>([]);
  const isWatched = watchlistEntry?.status === 'watched';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTVDetails(Number(id))
      .then((data) => { if (!cancelled) setShow(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    void getRatings({ mediaId: show.id, mediaType: 'tv' }).then((r) => { if (!cancelled) setShowRatings(r); });
    return () => { cancelled = true; };
  }, [show]);

  useEffect(() => {
    if (!show || !user) { setWatchlistEntry(null); setUserRating(0); return; }
    let cancelled = false;
    void Promise.all([
      isInWatchlist(user.id, show.id, 'tv'),
      getRatings({ mediaId: show.id, mediaType: 'tv', userId: user.id }),
    ]).then(([entry, mine]) => {
      if (cancelled) return;
      setWatchlistEntry(entry);
      setUserRating(mine[0]?.rating ?? 0);
    });
    return () => { cancelled = true; };
  }, [show, user]);

  if (loading) return <Loader />;
  if (error || !show) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <p className={styles.notFound}>{error || 'TV show not found'}</p>
        </div>
      </div>
    );
  }

  const title = show.title || (show as unknown as Record<string, string>).name || '';
  const genres = show.genres?.map((g) => g.name) || [];
  const platformAvg = showRatings.length > 0
    ? showRatings.reduce((sum, r) => sum + r.rating, 0) / showRatings.length
    : 0;
  const cast = show.credits?.cast?.slice(0, 8) || [];
  const releaseYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : (show.release_date ? new Date(show.release_date).getFullYear() : 'TBA');

  const requireAuth = () => { if (!user) { toast.error('Please log in first'); router.push('/login'); return false; } return true; };

  const handleRate = async (r: number) => {
    if (!requireAuth() || !user) return;
    setUserRating(r);
    const today = new Date().toISOString().split('T')[0];
    await addRating({ user_id: user.id, media_id: show.id, media_type: 'tv', rating: r, review: null, title, poster_path: show.poster_path });
    let entry: WatchlistItem | null = null;
    if (watchlistEntry) {
      entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: today });
    } else {
      entry = await addToWatchlist({ user_id: user.id, media_id: show.id, media_type: 'tv', title, poster_path: show.poster_path, status: 'watched', watched_date: today, notes: null, original_language: show.original_language ?? null });
    }
    if (entry) setWatchlistEntry({ ...entry, user_rating: r });
    void getRatings({ mediaId: show.id, mediaType: 'tv' }).then(setShowRatings);
    toast.success(`Rated ${r}/10`);
  };

  const inWatchlist = !!watchlistEntry;

  const handleAddToWatchlist = async () => {
    if (!requireAuth() || !user) return;
    if (inWatchlist) { toast('Already in your watchlist!'); return; }
    const entry = await addToWatchlist({ user_id: user.id, media_id: show.id, media_type: 'tv', title, poster_path: show.poster_path, status: 'watchlist', watched_date: null, notes: null, original_language: show.original_language ?? null });
    if (entry) setWatchlistEntry(entry);
    toast.success('Added to watchlist!');
  };

  const handleMarkWatched = async () => {
    if (!requireAuth() || !user) return;
    if (isWatched && watchlistEntry) {
      const updated = await updateWatchlistItem(watchlistEntry.id, { status: 'watchlist', watched_date: null });
      if (updated) setWatchlistEntry(updated);
      toast.success('Unmarked as watched');
      return;
    }
    setAskWatchedDate(true);
  };

  const persistWatched = async (watchedDate: string | null) => {
    if (!user) return;
    let entry: WatchlistItem | null;
    if (watchlistEntry) {
      entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: watchedDate });
    } else {
      entry = await addToWatchlist({ user_id: user.id, media_id: show.id, media_type: 'tv', title, poster_path: show.poster_path, status: 'watched', watched_date: watchedDate, notes: null, original_language: show.original_language ?? null });
    }
    if (entry) setWatchlistEntry(entry);
    toast.success('Marked as watched!');
  };

  // Persist per-episode progress; ensures a watchlist row exists and bumps status to 'watching'.
  const handleSetProgress = async (season: number, episode: number) => {
    if (!requireAuth() || !user) return;
    let entry: WatchlistItem | null = watchlistEntry;
    if (!entry) {
      entry = await addToWatchlist({
        user_id: user.id, media_id: show.id, media_type: 'tv',
        title, poster_path: show.poster_path,
        status: 'watching', watched_date: null, notes: null,
        original_language: show.original_language ?? null,
      });
    }
    if (!entry) { toast.error('Could not save progress'); return; }
    const nextStatus: typeof entry.status = entry.status === 'watched' ? 'watched' : 'watching';
    const updated = await updateWatchlistItem(entry.id, {
      status: nextStatus,
      last_watched_season: season,
      last_watched_episode: episode,
    });
    if (updated) setWatchlistEntry(updated);
    toast.success(`Progress saved: S${season}\u00b7E${episode}`);
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

  // Status dropdown state + helpers
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      const el = statusMenuRef.current;
      if (el && !el.contains(e.target as Node)) setStatusMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const handleMarkButtonClick = async () => {
    if (!requireAuth() || !user) return;
    if (isWatched && watchlistEntry) {
      const updated = await updateWatchlistItem(watchlistEntry.id, { status: 'watchlist', watched_date: null });
      if (updated) setWatchlistEntry(updated);
      toast.success('Unmarked as watched');
      return;
    }
    setAskWatchedDate(true);
  };

  const handleChangeStatus = async (status: 'watching' | 'dropped' | 'watchlist') => {
    if (!requireAuth() || !user) return;
    setStatusMenuOpen(false);
    let entry: WatchlistItem | null = watchlistEntry;
    if (!entry) {
      const newEntry = await addToWatchlist({
        user_id: user.id,
        media_id: show.id,
        media_type: 'tv',
        title,
        poster_path: show.poster_path,
        status,
        watched_date: null,
        notes: null,
        original_language: show.original_language ?? null,
      });
      if (newEntry) setWatchlistEntry(newEntry);
      toast.success(`Marked as ${status}`);
      return;
    }
    const updated = await updateWatchlistItem(entry.id, { status, watched_date: null });
    if (updated) setWatchlistEntry(updated);
    toast.success(`Marked as ${status}`);
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.backdrop} style={{ backgroundImage: `url(${tmdbBackdrop(show.backdrop_path, 'original')})` }}>
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
              src={tmdbImage(show.poster_path, 'w500')}
              alt={title}
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
              <span className={styles.typeBadge}>TV Series</span>
              {isWatched && (
                <span className={styles.watchedBadge}>
                  <HiCheckCircle size={14} /> Watched
                </span>
              )}
              {genres.map((g) => (
                <span key={g} className={styles.genreBadge}>{g}</span>
              ))}
            </div>

            <h1 className={styles.title}>{title}</h1>
            {show.tagline && <p className={styles.tagline}>{show.tagline}</p>}

            <div className={styles.meta}>
              <span><HiCalendar size={14} /> {releaseYear}</span>
              {show.number_of_seasons && <span>{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}</span>}
              <span><HiStar size={14} /> {show.vote_average.toFixed(1)}</span>
              <span>{show.status}</span>
            </div>

            <p className={styles.overview}>{show.overview}</p>

            <RatingDisplay
              platformAverage={platformAvg}
              platformCount={showRatings.length}
              globalAverage={show.vote_average}
            />

            <div className={styles.rateSection}>
              <div className={styles.rateHeader}>
                <h3>Rate this show</h3>
                {userRating > 0 && (
                  <button
                    type="button"
                    className={styles.clearRatingBtn}
                    onClick={async () => {
                      if (!user) return;
                      if (!window.confirm('Clear your rating for this show?')) return;
                      const ok = await removeRating(user.id, show.id, 'tv');
                      if (ok) { setUserRating(0); toast.success('Rating cleared'); }
                      else toast.error('Could not clear rating');
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
              <StarRating rating={userRating} onRate={handleRate} maxRating={10} size={24} />
            </div>

            <div className={styles.actions}>
              <button className={`${styles.primaryBtn} ${(inWatchlist || isWatched) ? styles.addedBtn : ''}`} onClick={handleAddToWatchlist} disabled={inWatchlist || isWatched}>
                {(inWatchlist || isWatched) ? <HiCheckCircle size={18} /> : <HiBookmark size={18} />}
                {(inWatchlist || isWatched) ? 'Added' : 'Add to Watchlist'}
              </button>
              <div className={styles.statusMenuWrap} ref={statusMenuRef}>
                <button className={`${styles.secondaryBtn} ${isWatched ? styles.watchedActiveBtn : ''}`} onClick={handleMarkButtonClick}>
                  {isWatched ? <HiCheckCircle size={18} /> : <HiPlay size={18} />}
                  {isWatched ? 'Watched' : 'Mark as Watched'}
                </button>
                <button
                  type="button"
                  className={styles.statusMenuToggle}
                  onClick={(e) => { e.stopPropagation(); setStatusMenuOpen((s) => !s); }}
                  aria-label="Change status"
                >
                  ▾
                </button>
                {statusMenuOpen && (
                  <div className={styles.statusMenu} role="menu">
                    <button type="button" className={styles.statusMenuItem} onClick={() => { setStatusMenuOpen(false); handleMarkButtonClick(); }}>
                      {isWatched ? 'Unmark as watched' : 'Mark as watched'}
                    </button>
                    <button type="button" className={styles.statusMenuItem} onClick={() => handleChangeStatus('watching')}>
                      Mark as watching
                    </button>
                    <button type="button" className={styles.statusMenuItem} onClick={() => handleChangeStatus('dropped')}>
                      Mark as dropped
                    </button>
                    <button type="button" className={styles.statusMenuItem} onClick={() => handleChangeStatus('watchlist')}>
                      Add to watchlist
                    </button>
                  </div>
                )}
              </div>
              {/* Recommend is a social action — only meaningful for signed-in users. */}
              {user && (
                <button className={styles.recommendBtn} onClick={() => setShowRecommend(true)}>
                  <HiHeart size={18} />
                  Recommend
                </button>
              )}
            </div>

            {user && (
              <RecommendModal
                isOpen={showRecommend}
                onClose={() => setShowRecommend(false)}
                mediaTitle={title}
                mediaId={show.id}
                mediaType="tv"
                posterPath={show.poster_path}
              />
            )}

            <WatchedDateModal
              open={askWatchedDate}
              title={title}
              initialDate={watchlistEntry?.watched_date}
              onCancel={() => setAskWatchedDate(false)}
              onConfirm={(date) => { setAskWatchedDate(false); void persistWatched(date); }}
            />

            {/* Episode rating grid */}
            {show.seasons && show.seasons.length > 0 && (
              <EpisodeRatingGrid
                mode="tv"
                tvId={show.id}
                seasons={show.seasons
                  .map((s) => s.season_number)
                  .filter((n) => n > 0)}
                progress={
                  watchlistEntry?.last_watched_season && watchlistEntry?.last_watched_episode
                    ? { season: watchlistEntry.last_watched_season, episode: watchlistEntry.last_watched_episode }
                    : null
                }
                onSetProgress={handleSetProgress}
                onResetProgress={handleResetProgress}
                onMarkAll={() => {
                  if (isWatched) { toast('Already marked as watched'); return; }
                  setAskWatchedDate(true);
                }}
              />
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div className={styles.castSection}>
                <h3>Cast</h3>
                <div className={styles.castList}>
                  {cast.map((c) => (
                    <Link
                      key={c.id}
                      href={`/search?personId=${c.id}&personName=${encodeURIComponent(c.name)}`}
                      className={styles.castMember}
                    >
                      {c.profile_path ? (
                        <Image
                          src={tmdbImage(c.profile_path, 'w185')}
                          alt={c.name}
                          width={48}
                          height={48}
                          className={styles.castPhoto}
                        />
                      ) : (
                        <div className={styles.castPhotoPlaceholder}>{c.name.charAt(0)}</div>
                      )}
                      <div>
                        <span className={styles.castName}>{c.name}</span>
                        <span className={styles.castChar}>{c.character}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {showRatings.length > 0 && (
              <div className={styles.reviewsSection}>
                <h3>Friend Reviews</h3>
                <div className={styles.reviews}>
                  {showRatings.map((r) => (
                    <div key={r.id} className={styles.review}>
                      <div className={styles.reviewHeader}>
                        <div className={styles.reviewAvatar}>
                          {r.user?.display_name?.charAt(0) || 'U'}
                        </div>
                        <span className={styles.reviewName}>{r.user?.display_name}</span>
                        <span className={styles.reviewRating}>
                          <HiStar size={14} /> {r.rating}/10
                        </span>
                      </div>
                      {r.review && <p className={styles.reviewText}>{r.review}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}