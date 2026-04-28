'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiStar } from 'react-icons/hi2';
import { AnimeItem } from '@/types';
import { getTopAnime, getSeasonalAnime, jikanImage } from '@/lib/jikan';
import { useTheme } from '@/context/ThemeContext';
import Loader from '@/components/common/Loader';
import styles from './anime.module.css';

type Tab = 'top' | 'airing' | 'upcoming' | 'popular';

export default function AnimePage() {
  const { isDark } = useTheme();
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('top');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchAnime = async () => {
      try {
        let res;
        switch (tab) {
          case 'top':
            res = await getTopAnime(1);
            break;
          case 'airing':
            res = await getSeasonalAnime();
            break;
          case 'upcoming':
            res = await getTopAnime(1, 'upcoming');
            break;
          case 'popular':
            res = await getTopAnime(1, 'bypopularity');
            break;
        }
        if (!cancelled) setAnimeList(res.data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch anime');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAnime();
    return () => { cancelled = true; };
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'top', label: 'Top Rated' },
    { key: 'airing', label: 'Airing Now' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'popular', label: 'Most Popular' },
  ];

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>Anime</h1>
          <p className={styles.subtitle}>Explore anime, powered by MyAnimeList</p>
        </motion.div>

        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.activeTab : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader />
        ) : error ? (
          <div className={styles.errorMsg}>
            <p>{error}</p>
            <button className={styles.retryBtn} onClick={() => setTab(tab)}>Retry</button>
          </div>
        ) : (
          <div className={styles.grid}>
            {animeList.map((anime, i) => (
              <motion.div
                key={anime.mal_id}
                className={styles.animeCard}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <Link href={`/anime/${anime.mal_id}`} className={styles.imageWrapper}>
                  <Image
                    src={jikanImage(anime)}
                    alt={anime.title_english || anime.title}
                    fill
                    sizes="(max-width: 640px) 45vw, 220px"
                    className={styles.poster}
                  />
                  {anime.score && (
                    <div className={styles.scoreBadge}>
                      <HiStar size={12} />
                      <span>{anime.score}</span>
                    </div>
                  )}
                  <div className={styles.typeBadge}>{anime.type}</div>
                </Link>
                <div className={styles.info}>
                  <Link href={`/anime/${anime.mal_id}`} className={styles.animeTitle}>
                    {anime.title_english || anime.title}
                  </Link>
                  <div className={styles.meta}>
                    {anime.episodes && <span>{anime.episodes} eps</span>}
                    {anime.year && <span>{anime.year}</span>}
                  </div>
                  <div className={styles.genres}>
                    {anime.genres.slice(0, 3).map((g) => (
                      <span key={g.mal_id} className={styles.genreTag}>{g.name}</span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
