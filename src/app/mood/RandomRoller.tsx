'use client';

/**
 * Random Roller — extracted from the deprecated /random page so it can live
 * inside Mood Mode as one of two "decide for me" experiences.
 *
 * Uses TMDB discover (movies/TV) + Jikan (anime) and rolls a single random
 * pick that respects type/genre/rating/year filters.
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar, HiCalendar, HiFilm, HiTv, HiSparkles, HiXMark } from 'react-icons/hi2';
import { discoverMovies, discoverTV, normalizeMediaItem, tmdbImage } from '@/lib/tmdb';
import { getTopAnime } from '@/lib/jikan';
import type { MediaItem, AnimeItem } from '@/types';
import styles from './randomRoller.module.css';

function animeToMediaItem(anime: AnimeItem): MediaItem {
  return {
    id: anime.mal_id,
    title: anime.title_english || anime.title,
    overview: anime.synopsis || '',
    poster_path: anime.images?.jpg?.image_url || null,
    backdrop_path: anime.images?.jpg?.large_image_url || null,
    release_date: anime.aired?.from || '',
    vote_average: anime.score || 0,
    vote_count: anime.scored_by || 0,
    genre_ids: anime.genres?.map((g) => g.mal_id) || [],
    media_type: 'anime',
    popularity: anime.popularity || 0,
  };
}

const MOVIE_GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 18, name: 'Drama' },
  { id: 14, name: 'Fantasy' }, { id: 27, name: 'Horror' }, { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' }, { id: 53, name: 'Thriller' },
];

const TYPES = [
  { key: 'movie' as const, label: 'Movie', icon: <HiFilm size={16} /> },
  { key: 'tv' as const, label: 'TV Series', icon: <HiTv size={16} /> },
  { key: 'anime' as const, label: 'Anime', icon: <HiSparkles size={16} /> },
];

const YEAR_RANGES = [
  { label: 'Any Year', value: '' },
  { label: '2020s', value: '2020' },
  { label: '2010s', value: '2010' },
  { label: '2000s', value: '2000' },
  { label: '90s', value: '1990' },
  { label: '80s', value: '1980' },
];

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '6+', value: 6 },
  { label: '7+', value: 7 },
  { label: '8+', value: 8 },
  { label: '9+', value: 9 },
];

// Dot positions for each face on a 120x120 grid. Standard die layout.
const DICE_DOTS: Readonly<Record<number, ReadonlyArray<readonly [number, number]>>> = {
  1: [[60, 60]],
  2: [[35, 35], [85, 85]],
  3: [[35, 35], [60, 60], [85, 85]],
  4: [[35, 35], [85, 35], [35, 85], [85, 85]],
  5: [[35, 35], [85, 35], [60, 60], [35, 85], [85, 85]],
  6: [[35, 30], [85, 30], [35, 60], [85, 60], [35, 90], [85, 90]],
};

function DiceIcon({ size = 120, face = 5 }: Readonly<{ size?: number; face?: number }>) {
  const dots = DICE_DOTS[face] ?? DICE_DOTS[5];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="100" height="100" rx="18" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="3" />
      {dots.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8" fill="currentColor" />
      ))}
    </svg>
  );
}

function getResultType(t: 'movie' | 'tv' | 'anime'): string {
  if (t === 'movie') return 'Movie';
  if (t === 'tv') return 'TV Series';
  return 'Anime';
}

function getDetailHref(item: MediaItem): string {
  if (item.media_type === 'anime') return `/anime/${item.id}`;
  if (item.media_type === 'tv') return `/tv/${item.id}`;
  return `/movies/${item.id}`;
}

export default function RandomRoller() {
  const [types, setTypes] = useState<Set<'movie' | 'tv' | 'anime'>>(new Set());
  const [genres, setGenres] = useState<Set<number>>(new Set());
  const [minRating, setMinRating] = useState(0);
  const [yearRange, setYearRange] = useState('');
  const [result, setResult] = useState<MediaItem | null>(null);
  const [rolling, setRolling] = useState(false);
  const [hasRolled, setHasRolled] = useState(false);
  const [diceFace, setDiceFace] = useState(5);
  const rollCount = useRef(0);

  // While rolling, swap to a random face every ~120ms so the dots flicker
  // like a real tumbling die.
  useEffect(() => {
    if (!rolling) return;
    const tick = setInterval(() => {
      setDiceFace((prev) => {
        let next = prev;
        while (next === prev) next = 1 + Math.floor(Math.random() * 6);
        return next;
      });
    }, 120);
    return () => clearInterval(tick);
  }, [rolling]);

  const toggleType = (t: 'movie' | 'tv' | 'anime') => {
    setTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const toggleGenre = (id: number) => {
    setGenres((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetFilters = () => {
    setTypes(new Set());
    setGenres(new Set());
    setMinRating(0);
    setYearRange('');
  };

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);
    rollCount.current++;
    const currentRoll = rollCount.current;

    try {
      const activeTypes = types.size > 0 ? Array.from(types) : ['movie', 'tv', 'anime'];
      const chosenType = activeTypes[Math.floor(Math.random() * activeTypes.length)];
      const randomPage = Math.floor(Math.random() * 5) + 1;
      let items: MediaItem[] = [];

      if (chosenType === 'anime') {
        const res = await getTopAnime(randomPage, 'bypopularity');
        items = (res.data || []).map(animeToMediaItem);
        if (minRating > 0) items = items.filter((i) => i.vote_average >= minRating);
      } else {
        const params: Record<string, string> = {
          page: String(randomPage),
          sort_by: 'popularity.desc',
        };
        if (genres.size > 0) params.with_genres = Array.from(genres).join(',');
        if (minRating > 0) params['vote_average.gte'] = String(minRating);
        if (yearRange) {
          const startYear = yearRange;
          const endYear = String(Number(yearRange) + 9);
          if (chosenType === 'movie') {
            params['primary_release_date.gte'] = `${startYear}-01-01`;
            params['primary_release_date.lte'] = `${endYear}-12-31`;
          } else {
            params['first_air_date.gte'] = `${startYear}-01-01`;
            params['first_air_date.lte'] = `${endYear}-12-31`;
          }
        }
        const res = chosenType === 'movie'
          ? await discoverMovies(params)
          : await discoverTV(params);
        items = res.results.map((r) =>
          normalizeMediaItem(r as unknown as Record<string, unknown>, chosenType as 'movie' | 'tv')
        );
      }

      await new Promise((r) => setTimeout(r, 1500));
      if (currentRoll !== rollCount.current) return;

      if (items.length > 0) {
        const pick = items[Math.floor(Math.random() * items.length)];
        setResult(pick);
      } else {
        setResult(null);
      }
      setHasRolled(true);
    } catch {
      setHasRolled(true);
    } finally {
      if (currentRoll === rollCount.current) setRolling(false);
    }
  };

  const activeFilterCount = types.size + genres.size + (minRating > 0 ? 1 : 0) + (yearRange ? 1 : 0);

  return (
    <div className={styles.layout}>
      {/* Filters */}
      <div className={styles.filtersPanel}>
        <div className={styles.filterHeader}>
          <h2 className={styles.filterTitle}>Filters</h2>
          {activeFilterCount > 0 && (
            <button className={styles.clearBtn} onClick={resetFilters} type="button">
              <HiXMark size={14} /> Clear all
            </button>
          )}
        </div>

        <div className={styles.filterGroup}>
          <h3 className={styles.filterLabel}>Type</h3>
          <div className={styles.chipRow}>
            {TYPES.map((t) => (
              <button
                key={t.key}
                className={`${styles.chip} ${types.has(t.key) ? styles.chipActive : ''}`}
                onClick={() => toggleType(t.key)}
                type="button"
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h3 className={styles.filterLabel}>Genre</h3>
          <div className={styles.chipRow}>
            {MOVIE_GENRES.map((g) => (
              <button
                key={g.id}
                className={`${styles.chip} ${genres.has(g.id) ? styles.chipActive : ''}`}
                onClick={() => toggleGenre(g.id)}
                type="button"
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h3 className={styles.filterLabel}>Min Rating</h3>
          <div className={styles.chipRow}>
            {RATING_OPTIONS.map((r) => (
              <button
                key={r.value}
                className={`${styles.chip} ${minRating === r.value ? styles.chipActive : ''}`}
                onClick={() => setMinRating(r.value)}
                type="button"
              >
                {r.value > 0 && <HiStar size={13} />} {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <h3 className={styles.filterLabel}>Year</h3>
          <div className={styles.chipRow}>
            {YEAR_RANGES.map((y) => (
              <button
                key={y.value}
                className={`${styles.chip} ${yearRange === y.value ? styles.chipActive : ''}`}
                onClick={() => setYearRange(y.value)}
                type="button"
              >
                {y.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dice area */}
      <div className={styles.diceArea}>
        <AnimatePresence mode="wait">
          {rolling && (
            <motion.div
              key="rolling"
              className={styles.diceWrapper}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className={styles.diceRolling}
                animate={{
                  rotate: [0, 90, 180, 270, 360, 450, 540, 630, 720],
                  scale: [1, 1.1, 0.9, 1.15, 0.85, 1.1, 0.95, 1.05, 1],
                }}
                transition={{ duration: 1.5, ease: 'easeInOut' }}
              >
                <DiceIcon size={140} face={diceFace} />
              </motion.div>
              <motion.p
                className={styles.rollingText}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
              >
                Rolling...
              </motion.p>
            </motion.div>
          )}

          {!rolling && result && (
            <motion.div
              key="result"
              className={styles.resultRow}
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className={styles.resultCard}>
                <Link href={getDetailHref(result)} className={styles.resultLink}>
                  <div className={styles.resultPoster}>
                    <Image
                      src={tmdbImage(result.poster_path, 'w342')}
                      alt={result.title}
                      fill
                      sizes="240px"
                      style={{ objectFit: 'cover' }}
                    />
                    <div className={styles.resultOverlay}>
                      <span className={styles.resultType}>{getResultType(result.media_type)}</span>
                    </div>
                  </div>
                  <div className={styles.resultInfo}>
                    <h3 className={styles.resultTitle}>{result.title}</h3>
                    <div className={styles.resultMeta}>
                      {result.release_date && (
                        <span><HiCalendar size={13} /> {new Date(result.release_date).getFullYear()}</span>
                      )}
                      {result.vote_average > 0 && (
                        <span><HiStar size={13} /> {result.vote_average.toFixed(1)}</span>
                      )}
                    </div>
                    {result.overview && (
                      <p className={styles.resultOverview}>
                        {result.overview.length > 150 ? result.overview.slice(0, 150) + '...' : result.overview}
                      </p>
                    )}
                  </div>
                </Link>
              </div>

              {/* Side dice — click to re-roll. Lives in the empty right gutter. */}
              <div className={styles.rerollSide}>
                <motion.button
                  className={styles.diceBtnSmall}
                  onClick={rollDice}
                  whileHover={{ scale: 1.08, rotate: -8 }}
                  whileTap={{ scale: 0.9, rotate: 25 }}
                  type="button"
                  aria-label="Roll again"
                >
                  <DiceIcon size={90} />
                </motion.button>
                <span className={styles.rerollHint}>Roll again</span>
              </div>
            </motion.div>
          )}

          {!rolling && !result && (
            <motion.div
              key="idle"
              className={styles.diceWrapper}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <motion.button
                className={styles.diceBtn}
                onClick={rollDice}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92, rotate: 15 }}
                type="button"
              >
                <DiceIcon size={140} />
              </motion.button>
              <p className={styles.diceHint}>
                {hasRolled ? 'No results found — try different filters!' : 'Tap the dice to get a random suggestion!'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
