'use client';

import { use, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiClock, HiBookmark, HiPlay, HiCalendar, HiHeart, HiCheckCircle, HiUserGroup } from 'react-icons/hi2';
import { getMovieDetails, tmdbImage, tmdbBackdrop } from '@/lib/tmdb';
import { MovieDetails, WatchlistItem, UserRating } from '@/types';
import { getRatings, addRating, addToWatchlist, isInWatchlist, updateWatchlistItem, removeRating } from '@/lib/store';
import RatingDisplay from '@/components/common/RatingDisplay';
import StarRating from '@/components/common/StarRating';
import RecommendModal from '@/components/common/RecommendModal';
import WatchedDateModal from '@/components/common/WatchedDateModal';
import Loader from '@/components/common/Loader';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import styles from './movieDetail.module.css';

export default function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [showRecommend, setShowRecommend] = useState(false);
  const [askWatchedDate, setAskWatchedDate] = useState(false);
  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRating, setUserRating] = useState(0);
  const [watchlistEntry, setWatchlistEntry] = useState<WatchlistItem | null>(null);
  const [movieRatings, setMovieRatings] = useState<UserRating[]>([]);
  const isWatched = watchlistEntry?.status === 'watched';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMovieDetails(Number(id))
      .then((data) => { if (!cancelled) setMovie(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!movie) return;
    let cancelled = false;
    void getRatings({ mediaId: movie.id, mediaType: 'movie' }).then((r) => { if (!cancelled) setMovieRatings(r); });
    return () => { cancelled = true; };
  }, [movie]);

  useEffect(() => {
    if (!movie || !user) { setWatchlistEntry(null); setUserRating(0); return; }
    let cancelled = false;
    void Promise.all([
      isInWatchlist(user.id, movie.id, 'movie'),
      getRatings({ mediaId: movie.id, mediaType: 'movie', userId: user.id }),
    ]).then(([entry, mine]) => {
      if (cancelled) return;
      setWatchlistEntry(entry);
      setUserRating(mine[0]?.rating ?? 0);
    });
    return () => { cancelled = true; };
  }, [movie, user]);

  if (loading) return <Loader />;
  if (error || !movie) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <p className={styles.notFound}>{error || 'Movie not found'}</p>
        </div>
      </div>
    );
  }

  const genres = movie.genres?.map((g) => g.name) || [];
  const platformAvg = movieRatings.length > 0
    ? movieRatings.reduce((sum, r) => sum + r.rating, 0) / movieRatings.length
    : 0;
  const cast = movie.credits?.cast?.slice(0, 8) || [];
  const directors = movie.credits?.crew?.filter((c) => c.job === 'Director') || [];
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null;

  const requireAuth = () => { if (!user) { toast.error('Please log in first'); router.push('/login'); return false; } return true; };

  const handleRate = async (r: number) => {
    if (!requireAuth() || !user) return;
    setUserRating(r);
    const today = new Date().toISOString().split('T')[0];
    await addRating({ user_id: user.id, media_id: movie.id, media_type: 'movie', rating: r, review: null, title: movie.title, poster_path: movie.poster_path });
    let entry: WatchlistItem | null = null;
    if (watchlistEntry) {
      entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: today });
    } else {
      entry = await addToWatchlist({ user_id: user.id, media_id: movie.id, media_type: 'movie', title: movie.title, poster_path: movie.poster_path, status: 'watched', watched_date: today, notes: null, original_language: movie.original_language ?? null });
    }
    if (entry) setWatchlistEntry({ ...entry, user_rating: r });
    void getRatings({ mediaId: movie.id, mediaType: 'movie' }).then(setMovieRatings);
    toast.success(`Rated ${r}/10`);
  };

  const inWatchlist = !!watchlistEntry;

  const handleAddToWatchlist = async () => {
    if (!requireAuth() || !user) return;
    if (inWatchlist) { toast('Already in your watchlist!'); return; }
    const entry = await addToWatchlist({ user_id: user.id, media_id: movie.id, media_type: 'movie', title: movie.title, poster_path: movie.poster_path, status: 'watchlist', watched_date: null, notes: null, original_language: movie.original_language ?? null });
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
    // Ask the user when they actually watched it before persisting.
    setAskWatchedDate(true);
  };

  const persistWatched = async (watchedDate: string | null) => {
    if (!user) return;
    let entry: WatchlistItem | null;
    if (watchlistEntry) {
      entry = await updateWatchlistItem(watchlistEntry.id, { status: 'watched', watched_date: watchedDate });
    } else {
      entry = await addToWatchlist({ user_id: user.id, media_id: movie.id, media_type: 'movie', title: movie.title, poster_path: movie.poster_path, status: 'watched', watched_date: watchedDate, notes: null, original_language: movie.original_language ?? null });
    }
    if (entry) setWatchlistEntry(entry);
    toast.success('Marked as watched!');
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      {/* Backdrop */}
      <div className={styles.backdrop} style={{ backgroundImage: `url(${tmdbBackdrop(movie.backdrop_path, 'original')})` }}>
        <div className={styles.backdropGradient} />
      </div>

      <div className={styles.container}>
        <div className={styles.content}>
          {/* Poster */}
          <motion.div
            className={styles.posterWrapper}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <Image
              src={tmdbImage(movie.poster_path, 'w500')}
              alt={movie.title}
              fill
              sizes="300px"
              className={styles.poster}
              priority
            />
          </motion.div>

          {/* Details */}
          <motion.div
            className={styles.details}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className={styles.badges}>
              <span className={styles.typeBadge}>Movie</span>
              {isWatched && (
                <span className={styles.watchedBadge}>
                  <HiCheckCircle size={14} /> Watched
                </span>
              )}
              {genres.map((g) => (
                <span key={g} className={styles.genreBadge}>{g}</span>
              ))}
            </div>

            <h1 className={styles.title}>{movie.title}</h1>
            {movie.tagline && <p className={styles.tagline}>{movie.tagline}</p>}

            <div className={styles.meta}>
              <span><HiCalendar size={14} /> {movie.release_date ? new Date(movie.release_date).getFullYear() : 'TBA'}</span>
              {runtime && <span><HiClock size={14} /> {runtime}</span>}
              <span><HiStar size={14} /> {movie.vote_average.toFixed(1)}</span>
            </div>

            <p className={styles.overview}>{movie.overview}</p>

            {/* Director(s) */}
            {directors.length > 0 && (
              <div className={styles.directorSection}>
                <span className={styles.directorLabel}>Directed by</span>
                <span className={styles.directorNames}>{directors.map((d) => d.name).join(', ')}</span>
              </div>
            )}

            {/* Ratings */}
            <RatingDisplay
              platformAverage={platformAvg}
              platformCount={movieRatings.length}
              globalAverage={movie.vote_average}
            />

            {/* User Rating */}
            <div className={styles.rateSection}>
              <div className={styles.rateHeader}>
                <h3>Rate this movie</h3>
                {userRating > 0 && (
                  <button
                    type="button"
                    className={styles.clearRatingBtn}
                    onClick={async () => {
                      if (!user) return;
                      if (!window.confirm('Clear your rating for this movie?')) return;
                      const ok = await removeRating(user.id, movie.id, 'movie');
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

            {/* Actions */}
            <div className={styles.actions}>
              <button className={`${styles.primaryBtn} ${(inWatchlist || isWatched) ? styles.addedBtn : ''}`} onClick={handleAddToWatchlist} disabled={inWatchlist || isWatched}>
                {(inWatchlist || isWatched) ? <HiCheckCircle size={18} /> : <HiBookmark size={18} />}
                {(inWatchlist || isWatched) ? 'Added' : 'Add to Watchlist'}
              </button>
              <button className={`${styles.secondaryBtn} ${isWatched ? styles.watchedActiveBtn : ''}`} onClick={handleMarkWatched}>
                {isWatched ? <HiCheckCircle size={18} /> : <HiPlay size={18} />}
                {isWatched ? 'Watched' : 'Mark as Watched'}
              </button>
              {/* Recommend is a social action — only meaningful for signed-in users. */}
              {user && (
                <button className={styles.recommendBtn} onClick={() => setShowRecommend(true)}>
                  <HiHeart size={18} />
                  Recommend
                </button>
              )}
              <Link
                href={`/watch-parties?movie=${movie.id}&title=${encodeURIComponent(movie.title)}&poster=${encodeURIComponent(movie.poster_path || '')}`}
                className={styles.partyBtn}
              >
                <HiUserGroup size={18} />
                Watch Party
              </Link>
            </div>

            {user && (
              <RecommendModal
                isOpen={showRecommend}
                onClose={() => setShowRecommend(false)}
                mediaTitle={movie.title}
                mediaId={movie.id}
                mediaType="movie"
                posterPath={movie.poster_path}
              />
            )}

            <WatchedDateModal
              open={askWatchedDate}
              title={movie.title}
              initialDate={watchlistEntry?.watched_date}
              onCancel={() => setAskWatchedDate(false)}
              onConfirm={(date) => { setAskWatchedDate(false); void persistWatched(date); }}
            />

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

            {/* Friend Reviews (from sample for now) */}
            {movieRatings.length > 0 && (
              <div className={styles.reviewsSection}>
                <h3>Friend Reviews</h3>
                <div className={styles.reviews}>
                  {movieRatings.map((r) => (
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