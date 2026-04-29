'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { HiFilm, HiTv, HiSparkles, HiEye, HiClock, HiHeart, HiArrowRight, HiFire, HiTrophy, HiBookOpen, HiGlobeAlt, HiUserGroup } from 'react-icons/hi2';
import { GiPunchBlast, GiDramaMasks, GiRocket, GiGhost, GiMagnifyingGlass, GiRose, GiTheaterCurtains } from 'react-icons/gi';
import { useAuth } from '@/context/AuthContext';
import HeroBanner from '@/components/home/HeroBanner';
import MediaRow from '@/components/home/MediaRow';
import Loader from '@/components/common/Loader';
import { getTrending, getPopularMovies, getPopularTV, getTopRatedMovies, getNowPlayingMovies, getUpcomingMovies, getTopRatedTV, getOnAirTV, discoverMovies, normalizeMediaItem } from '@/lib/tmdb';
import { getTopAnime, getSeasonalAnime } from '@/lib/jikan';
import { cachedFetch } from '@/lib/api-cache';
import { GENRE_MAP } from '@/lib/constants';
import { MediaItem, AnimeItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import styles from './home.module.css';

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

// Shown to authenticated users — personal/quick-access items
const QUICK_NAV_AUTH = [
  { href: '/watched', label: 'Watched', icon: HiEye, color: '#10b981' },
  { href: '/activity', label: 'History', icon: HiClock, color: '#6366f1' },
  { href: '/recommendations', label: 'Friends Rec', icon: HiHeart, color: '#ec4899' },
];

// Shown to logged-out visitors — public nav destinations they might miss
// because the hamburger/menu isn't immediately visible on small screens.
const QUICK_NAV_PUBLIC = [
  { href: '/mood', label: 'Mood', icon: HiSparkles, color: '#a855f7' },
  { href: '/rankings', label: 'Rankings', icon: HiTrophy, color: '#f59e0b' },
  { href: '/read', label: 'Read', icon: HiBookOpen, color: '#10b981' },
  { href: '/global', label: 'Global', icon: HiGlobeAlt, color: '#06b6d4' },
  { href: '/watch-parties', label: 'Watch Parties', icon: HiUserGroup, color: '#ec4899' },
];

// Module-level cache — survives component unmount/remount during client-side navigation
let _homeCache: {
  trending: MediaItem[];
  popularMovies: MediaItem[];
  popularTV: MediaItem[];
  topRated: MediaItem[];
  nowPlaying: MediaItem[];
  upcoming: MediaItem[];
  topRatedTV: MediaItem[];
  onAirTV: MediaItem[];
  topAnime: MediaItem[];
  seasonalAnime: MediaItem[];
  loadedTabs: string[];
} | null = null;

const GENRE_PICKS = [
  { id: 28, name: 'Action', icon: GiPunchBlast, color: '#ef4444' },
  { id: 35, name: 'Comedy', icon: GiTheaterCurtains, color: '#f59e0b' },
  { id: 18, name: 'Drama', icon: GiDramaMasks, color: '#8b5cf6' },
  { id: 878, name: 'Sci-Fi', icon: GiRocket, color: '#06b6d4' },
  { id: 27, name: 'Horror', icon: GiGhost, color: '#ef4444' },
  { id: 80, name: 'Crime', icon: GiMagnifyingGlass, color: '#64748b' },
  { id: 10749, name: 'Romance', icon: GiRose, color: '#ec4899' },
  { id: 53, name: 'Thriller', icon: HiFire, color: '#f97316' },
];

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(!_homeCache);
  const [selectedGenres, setSelectedGenres] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState<'movies' | 'tv' | 'anime'>('movies');
  const [trending, setTrending] = useState<MediaItem[]>(_homeCache?.trending ?? []);
  const [popularMovies, setPopularMovies] = useState<MediaItem[]>(_homeCache?.popularMovies ?? []);
  const [popularTV, setPopularTV] = useState<MediaItem[]>(_homeCache?.popularTV ?? []);
  const [topRated, setTopRated] = useState<MediaItem[]>(_homeCache?.topRated ?? []);
  const [genreItems, setGenreItems] = useState<MediaItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  // Tab-specific data
  const [nowPlaying, setNowPlaying] = useState<MediaItem[]>(_homeCache?.nowPlaying ?? []);
  const [upcoming, setUpcoming] = useState<MediaItem[]>(_homeCache?.upcoming ?? []);
  const [topRatedTV, setTopRatedTV] = useState<MediaItem[]>(_homeCache?.topRatedTV ?? []);
  const [onAirTV, setOnAirTV] = useState<MediaItem[]>(_homeCache?.onAirTV ?? []);
  const [topAnime, setTopAnime] = useState<MediaItem[]>(_homeCache?.topAnime ?? []);
  const [seasonalAnime, setSeasonalAnime] = useState<MediaItem[]>(_homeCache?.seasonalAnime ?? []);
  const [tabLoading, setTabLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(() => new Set(_homeCache?.loadedTabs ?? []));
  const { isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  // Until hydrated, render the public set so SSR markup matches the
  // unauthenticated initial render and avoids hydration mismatch.
  const quickNavItems = mounted && isAuthenticated ? QUICK_NAV_AUTH : QUICK_NAV_PUBLIC;

  useEffect(() => {
    if (_homeCache) return; // Already have data from previous visit
    let cancelled = false;
    const HOUR = 60 * 60 * 1000;
    Promise.all([
      cachedFetch('trending_week', () => getTrending('all', 'week'), HOUR, true),
      cachedFetch('popular_movies', () => getPopularMovies(), HOUR, true),
      cachedFetch('popular_tv', () => getPopularTV(), HOUR, true),
      cachedFetch('top_rated_movies', () => getTopRatedMovies(), HOUR, true),
    ])
      .then(([trendingRes, moviesRes, tvRes, topRes]) => {
        if (cancelled) return;
        const t = trendingRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>));
        const pm = moviesRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'));
        const pt = tvRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv'));
        const tr = topRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'));
        setTrending(t);
        setPopularMovies(pm);
        setPopularTV(pt);
        setTopRated(tr);
        setLoadedTabs(new Set(['movies']));
        _homeCache = { trending: t, popularMovies: pm, popularTV: pt, topRated: tr, nowPlaying: [], upcoming: [], topRatedTV: [], onAirTV: [], topAnime: [], seasonalAnime: [], loadedTabs: ['movies'] };
      })
      .catch((err) => console.error('Failed to load home data:', err))
      .finally(() => setIsLoading(false));

    return () => { cancelled = true; };
  }, []);

  // Load tab-specific data on demand
  useEffect(() => {
    if (loadedTabs.has(activeTab)) return;
    let cancelled = false;
    setTabLoading(true);

    if (activeTab === 'movies') {
      Promise.all([
        cachedFetch('now_playing', () => getNowPlayingMovies(), 60 * 60 * 1000, true),
        cachedFetch('upcoming', () => getUpcomingMovies(), 60 * 60 * 1000, true),
      ])
        .then(([npRes, upRes]) => {
          if (cancelled) return;
          const np = npRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'));
          const up = upRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'));
          setNowPlaying(np);
          setUpcoming(up);
          setLoadedTabs((prev) => new Set([...prev, 'movies']));
          if (_homeCache) { _homeCache.nowPlaying = np; _homeCache.upcoming = up; _homeCache.loadedTabs = [...new Set([..._homeCache.loadedTabs, 'movies'])]; }
        })
        .catch((err) => console.error('Failed to load movies tab:', err))
        .finally(() => setTabLoading(false));
    } else if (activeTab === 'tv') {
      Promise.all([
        cachedFetch('top_rated_tv', () => getTopRatedTV(), 60 * 60 * 1000, true),
        cachedFetch('on_air_tv', () => getOnAirTV(), 60 * 60 * 1000, true),
      ])
        .then(([trRes, oaRes]) => {
          if (cancelled) return;
          const trtv = trRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv'));
          const oa = oaRes.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv'));
          setTopRatedTV(trtv);
          setOnAirTV(oa);
          setLoadedTabs((prev) => new Set([...prev, 'tv']));
          if (_homeCache) { _homeCache.topRatedTV = trtv; _homeCache.onAirTV = oa; _homeCache.loadedTabs = [...new Set([..._homeCache.loadedTabs, 'tv'])]; }
        })
        .catch((err) => console.error('Failed to load TV tab:', err))
        .finally(() => setTabLoading(false));
    } else if (activeTab === 'anime') {
      Promise.all([
        cachedFetch('top_anime', () => getTopAnime(), 60 * 60 * 1000, true),
        cachedFetch('seasonal_anime', () => getSeasonalAnime(), 60 * 60 * 1000, true),
      ])
        .then(([topRes, seaRes]) => {
          if (cancelled) return;
          const ta = (topRes.data || []).map(animeToMediaItem);
          const sa = (seaRes.data || []).map(animeToMediaItem);
          setTopAnime(ta);
          setSeasonalAnime(sa);
          setLoadedTabs((prev) => new Set([...prev, 'anime']));
          if (_homeCache) { _homeCache.topAnime = ta; _homeCache.seasonalAnime = sa; _homeCache.loadedTabs = [...new Set([..._homeCache.loadedTabs, 'anime'])]; }
        })
        .catch((err) => console.error('Failed to load anime tab:', err))
        .finally(() => setTabLoading(false));
    }

    return () => { cancelled = true; };
  }, [activeTab, loadedTabs]);

  // Fetch genre-filtered movies when genres are selected
  useEffect(() => {
    if (selectedGenres.length === 0) {
      setGenreItems([]);
      return;
    }
    let cancelled = false;
    setGenreLoading(true);
    const genreStr = selectedGenres.join(',');
    cachedFetch(`genre_${genreStr}`, () => discoverMovies({ with_genres: genreStr, sort_by: 'popularity.desc' }))
      .then((res) => {
        if (!cancelled) setGenreItems(res.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie')));
      })
      .catch(() => { if (!cancelled) setGenreItems([]); })
      .finally(() => { if (!cancelled) setGenreLoading(false); });
    return () => { cancelled = true; };
  }, [selectedGenres]);

  if (isLoading) return <Loader />;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <HeroBanner items={trending.slice(0, 5)} />

      <div className={styles.container}>
        {/* "What we offer" CTA — mobile/tablet only, signed-out only.
            Single tappable card that takes new visitors to /help where
            every feature is documented. Hidden on desktop (full nav is
            already visible) and once the user signs in. */}
        {mounted && !isAuthenticated && (
          <Link href="/help" className={styles.offerCard} aria-label="Discover everything Viewtopia offers">
            <div className={styles.offerIcon} aria-hidden="true">
              <HiSparkles size={24} />
            </div>
            <div className={styles.offerBody}>
              <span className={styles.offerBadge}>NEW HERE?</span>
              <h2 className={styles.offerTitle}>Discover everything Viewtopia offers</h2>
              <p className={styles.offerSubtitle}>
                Movies, TV, anime, manga, mood picks, watch parties &amp; more — tap to explore.
              </p>
            </div>
            <HiArrowRight size={20} className={styles.offerArrow} />
          </Link>
        )}

        {/* Quick Nav Section */}
        <section className={styles.quickNav}>
          <motion.h2
            className={styles.sectionTitle}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Explore Viewtopia
          </motion.h2>
          <div className={styles.navGrid}>
            {quickNavItems.map((item, i) => (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Link href={item.href} className={styles.navCard}>
                  <div className={styles.navCardIcon} style={{ background: `${item.color}18` }}>
                    <item.icon size={22} style={{ color: item.color }} />
                  </div>
                  <span className={styles.navLabel}>{item.label}</span>
                  <HiArrowRight size={14} className={styles.navArrow} />
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Genre Recommendations */}
        <section className={styles.genreSection}>
          <motion.h2
            className={styles.sectionTitle}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Browse by Genre
          </motion.h2>
          <div className={styles.genrePills}>
            {GENRE_PICKS.map((genre, i) => (
              <motion.button
                key={genre.id}
                className={`${styles.genrePill} ${selectedGenres.includes(genre.id) ? styles.genrePillActive : ''}`}
                onClick={() => setSelectedGenres((prev) => prev.includes(genre.id) ? prev.filter((g) => g !== genre.id) : [...prev, genre.id])}
                style={selectedGenres.includes(genre.id) ? { background: genre.color, borderColor: genre.color } : {}}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <genre.icon size={14} />
                {genre.name}
              </motion.button>
            ))}
          </div>
          {selectedGenres.length > 0 && genreLoading && (
            <p className={styles.noResults}>Loading...</p>
          )}
          {selectedGenres.length > 0 && !genreLoading && genreItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <MediaRow
                title={`${selectedGenres.map((id) => GENRE_MAP[id]).filter(Boolean).join(' + ')} Picks`}
                items={genreItems}
              />
            </motion.div>
          )}
          {selectedGenres.length > 0 && !genreLoading && genreItems.length === 0 && (
            <p className={styles.noResults}>No items found for this genre combo</p>
          )}
        </section>

        {/* Live Data Rows */}
        <MediaRow
          title="Trending Now"
          items={trending}
        />

        {/* Category Tabs: Movies / TV / Anime */}
        <section className={styles.categorySection}>
          <motion.h2
            className={styles.sectionTitle}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            Browse
          </motion.h2>
          <div className={styles.categoryTabs}>
            {([
              { key: 'movies' as const, label: 'Movies', icon: <HiFilm size={18} />, color: '#e50914' },
              { key: 'tv' as const, label: 'TV Series', icon: <HiTv size={18} />, color: '#0ea5e9' },
              { key: 'anime' as const, label: 'Anime', icon: <HiSparkles size={18} />, color: '#8b5cf6' },
            ]).map((tab) => (
              <button
                key={tab.key}
                className={`${styles.categoryTab} ${activeTab === tab.key ? styles.categoryTabActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
                style={activeTab === tab.key ? { borderColor: tab.color, color: tab.color } : {}}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.key && (
                  <motion.div
                    className={styles.tabIndicator}
                    layoutId="categoryTab"
                    style={{ background: tab.color }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tabLoading ? (
              <motion.div key="loading" className={styles.tabLoading} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Loader />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'movies' && (
                  <>
                    <MediaRow title="Popular Movies" items={popularMovies} viewAllHref="/movies" />
                    <MediaRow title="Top Rated" items={topRated} viewAllHref="/movies" />
                    {nowPlaying.length > 0 && <MediaRow title="Now Playing" items={nowPlaying} viewAllHref="/movies" />}
                    {upcoming.length > 0 && <MediaRow title="Upcoming" items={upcoming} viewAllHref="/movies" />}
                  </>
                )}
                {activeTab === 'tv' && (
                  <>
                    <MediaRow title="Popular TV Series" items={popularTV} viewAllHref="/tv" />
                    {topRatedTV.length > 0 && <MediaRow title="Top Rated TV" items={topRatedTV} viewAllHref="/tv" />}
                    {onAirTV.length > 0 && <MediaRow title="On The Air" items={onAirTV} viewAllHref="/tv" />}
                  </>
                )}
                {activeTab === 'anime' && (
                  <>
                    {topAnime.length > 0 && <MediaRow title="Top Anime" items={topAnime} viewAllHref="/anime" />}
                    {seasonalAnime.length > 0 && <MediaRow title="This Season" items={seasonalAnime} viewAllHref="/anime" />}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}