'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { HiTrophy, HiFire, HiStar, HiHeart, HiCalendar, HiPlay, HiTv, HiFilm, HiSparkles } from 'react-icons/hi2';
import MediaCard from '@/components/common/MediaCard';
import Loader from '@/components/common/Loader';
import { useTheme } from '@/context/ThemeContext';
import {
  getTopAnime, getSeasonalAnime, jikanImage,
} from '@/lib/jikan';
import {
  getPopularMovies, getTopRatedMovies, getNowPlayingMovies, getUpcomingMovies,
  getPopularTV, getTopRatedTV, getOnAirTV,
  normalizeMediaItem,
} from '@/lib/tmdb';
import type { AnimeItem, MediaItem } from '@/types';
import styles from './rankings.module.css';

type Tab = 'anime' | 'movies' | 'tv';

interface CategoryDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}

const ANIME_CATS: CategoryDef[] = [
  { key: 'top',      label: 'Top Ranked',      icon: HiTrophy },
  { key: 'popular',  label: 'Most Popular',    icon: HiFire },
  { key: 'airing',   label: 'Top Airing',      icon: HiPlay },
  { key: 'upcoming', label: 'Upcoming',        icon: HiCalendar },
  { key: 'favorite', label: 'Most Favorited',  icon: HiHeart },
  { key: 'season',   label: 'This Season',     icon: HiSparkles },
];

const MOVIE_CATS: CategoryDef[] = [
  { key: 'popular',  label: 'Popular',         icon: HiFire },
  { key: 'top',      label: 'Top Rated',       icon: HiStar },
  { key: 'now',      label: 'Now Playing',     icon: HiPlay },
  { key: 'upcoming', label: 'Upcoming',        icon: HiCalendar },
];

const TV_CATS: CategoryDef[] = [
  { key: 'popular',  label: 'Popular',         icon: HiFire },
  { key: 'top',      label: 'Top Rated',       icon: HiStar },
  { key: 'airing',   label: 'On The Air',      icon: HiPlay },
];

function getCats(tab: Tab): CategoryDef[] {
  if (tab === 'anime') return ANIME_CATS;
  if (tab === 'movies') return MOVIE_CATS;
  return TV_CATS;
}

function RankingsContent() {
  const { isDark } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get('type') as Tab) || 'anime';
  const initialCat = searchParams.get('cat') || getCats(initialTab)[0].key;

  const [tab, setTab] = useState<Tab>(initialTab);
  const [cat, setCat] = useState<string>(initialCat);
  const [page, setPage] = useState(1);
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const cats = useMemo(() => getCats(tab), [tab]);

  // Sync URL when tab/cat changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('type', tab);
    params.set('cat', cat);
    router.replace(`/rankings?${params.toString()}`, { scroll: false });
  }, [tab, cat, router]);

  // Reset page + lists when switching tab/cat
  useEffect(() => {
    setPage(1);
    setAnimeList([]);
    setMediaList([]);
  }, [tab, cat]);

  // Fetch data
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchIt = async () => {
      try {
        if (tab === 'anime') {
          let res;
          if (cat === 'season') {
            res = await getSeasonalAnime(undefined, undefined, page);
          } else {
            const filter = cat === 'top' ? undefined
              : cat === 'popular' ? 'bypopularity'
              : cat === 'airing' ? 'airing'
              : cat === 'upcoming' ? 'upcoming'
              : cat === 'favorite' ? 'favorite'
              : undefined;
            res = await getTopAnime(page, filter);
          }
          if (cancelled) return;
          const items = (res.data || []) as AnimeItem[];
          setAnimeList((prev) => page === 1 ? items : [...prev, ...items]);
          setHasMore(Boolean((res as { pagination?: { has_next_page?: boolean } }).pagination?.has_next_page));
        } else {
          const type: 'movie' | 'tv' = tab === 'movies' ? 'movie' : 'tv';
          const fetcher =
            tab === 'movies'
              ? cat === 'popular' ? getPopularMovies
              : cat === 'top' ? getTopRatedMovies
              : cat === 'now' ? getNowPlayingMovies
              : getUpcomingMovies
              : cat === 'popular' ? getPopularTV
              : cat === 'top' ? getTopRatedTV
              : getOnAirTV;
          const res = await fetcher(page);
          if (cancelled) return;
          const items = (res.results || []).map((r) =>
            normalizeMediaItem(r as unknown as Record<string, unknown>, type),
          );
          setMediaList((prev) => page === 1 ? items : [...prev, ...items]);
          setHasMore(page < (res.total_pages || 1));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load rankings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchIt();
    return () => { cancelled = true; };
  }, [tab, cat, page]);

  const activeCatLabel = cats.find((c) => c.key === cat)?.label || '';

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <HiTrophy size={28} /> Rankings
          </h1>
          <p className={styles.subtitle}>
            Browse the highest-rated, most popular, and trending titles across anime, movies, and TV.
          </p>
        </header>

        <div className={styles.tabs}>
          {[
            { key: 'anime', label: 'Anime', Icon: HiSparkles },
            { key: 'movies', label: 'Movies', Icon: HiFilm },
            { key: 'tv', label: 'TV Series', Icon: HiTv },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`}
              onClick={() => {
                const t = key as Tab;
                setTab(t);
                setCat(getCats(t)[0].key);
              }}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Filter</h3>
            <ul className={styles.catList}>
              {cats.map(({ key, label, icon: Icon }) => (
                <li key={key}>
                  <button
                    className={`${styles.catBtn} ${cat === key ? styles.catActive : ''}`}
                    onClick={() => setCat(key)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <section className={styles.results}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>{activeCatLabel}</h2>
              {!loading && (
                <span className={styles.resultsCount}>
                  {tab === 'anime' ? animeList.length : mediaList.length} results
                </span>
              )}
            </div>

            {error ? (
              <div className={styles.errorMsg}>{error}</div>
            ) : (
              <>
                {tab === 'anime' ? (
                  <div className={styles.grid}>
                    {animeList.map((anime, i) => (
                      <motion.div
                        key={`${anime.mal_id}-${i}`}
                        className={styles.animeCard}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      >
                        <Link href={`/anime/${anime.mal_id}`} className={styles.imageWrapper}>
                          <Image
                            src={jikanImage(anime)}
                            alt={anime.title_english || anime.title}
                            fill
                            sizes="(max-width: 640px) 45vw, 220px"
                            className={styles.poster}
                          />
                          {anime.rank && cat !== 'upcoming' && (
                            <div className={styles.rankBadge}>#{anime.rank}</div>
                          )}
                          {anime.score && (
                            <div className={styles.scoreBadge}>
                              <HiStar size={12} /> {anime.score}
                            </div>
                          )}
                        </Link>
                        <div className={styles.info}>
                          <Link href={`/anime/${anime.mal_id}`} className={styles.cardTitle}>
                            {anime.title_english || anime.title}
                          </Link>
                          <div className={styles.meta}>
                            {anime.episodes && <span>{anime.episodes} eps</span>}
                            {anime.year && <span>{anime.year}</span>}
                            {anime.members && <span>{(anime.members / 1000).toFixed(0)}K members</span>}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.grid}>
                    {mediaList.map((item, i) => (
                      <motion.div
                        key={`${item.id}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      >
                        <MediaCard item={item} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {loading && <Loader />}

                {!loading && hasMore && (
                  <div className={styles.loadMoreRow}>
                    <button
                      className={styles.loadMoreBtn}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Load more
                    </button>
                  </div>
                )}

                {!loading && !hasMore && (animeList.length > 0 || mediaList.length > 0) && (
                  <p className={styles.endNote}>You&apos;ve reached the end.</p>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<Loader />}>
      <RankingsContent />
    </Suspense>
  );
}
