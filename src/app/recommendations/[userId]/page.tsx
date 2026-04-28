'use client';

import { use, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiArrowLeft, HiHeart, HiClock, HiFilm, HiTv, HiSparkles, HiBookOpen } from 'react-icons/hi2';
import { getRecommendations, getProfilesByIds, PublicProfile } from '@/lib/store';
import { Recommendation, RecommendableMediaType } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { MEDIA_TYPE_LABELS } from '@/lib/constants';
import { useTheme } from '@/context/ThemeContext';
import { formatDistanceToNow } from 'date-fns';
import styles from './userRecs.module.css';

export default function UserRecommendationsPage({ params }: Readonly<{ params: Promise<{ userId: string }> }>) {
  const { userId } = use(params);
  const { isDark } = useTheme();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [typeFilter, setTypeFilter] = useState<RecommendableMediaType | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    void getRecommendations(userId).then(async (list) => {
      if (cancelled) return;
      setRecs(list);
      const profiles = await getProfilesByIds([userId]);
      if (!cancelled) setProfile(profiles[userId] ?? null);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const user = profile;
  const filtered = typeFilter === 'all' ? recs : recs.filter((r) => r.media_type === typeFilter);

  const typeIcon = (type: RecommendableMediaType) => {
    if (type === 'movie') return <HiFilm size={13} />;
    if (type === 'tv') return <HiTv size={13} />;
    if (type === 'manga') return <HiBookOpen size={13} />;
    return <HiSparkles size={13} />;
  };

  const getHref = (rec: Recommendation) => {
    if (rec.media_type === 'movie') return `/movies/${rec.media_id}`;
    if (rec.media_type === 'tv') return `/tv/${rec.media_id}`;
    if (rec.media_type === 'manga') return `/read/${rec.media_id}`;
    return `/anime/${rec.media_id}`;
  };

  const bundleColors = [
    ['#e50914', '#ff4757'],
    ['#8b5cf6', '#a78bfa'],
    ['#06b6d4', '#22d3ee'],
    ['#f59e0b', '#fbbf24'],
    ['#10b981', '#34d399'],
    ['#ec4899', '#f472b6'],
  ];

  // Stable color hash from userId
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const [c1, c2] = bundleColors[h % bundleColors.length];

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      {/* Hero header */}
      <div className={styles.hero} style={{ background: `linear-gradient(135deg, ${c1}18, ${c2}08)` }}>
        <div className={styles.heroInner}>
          <Link href="/recommendations" className={styles.backBtn}>
            <HiArrowLeft size={18} />
            Recommendations
          </Link>

          <motion.div
            className={styles.userInfo}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link href={`/profile/${userId}`} className={styles.avatar} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
              {user?.display_name?.charAt(0).toUpperCase() || 'U'}
            </Link>
            <div>
              <h1 className={styles.heroTitle}>
                <Link href={`/profile/${userId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {user?.display_name || 'User'}
                </Link>&apos;s Picks
              </h1>
              <p className={styles.heroSub}>
                <HiHeart size={14} /> {recs.length} recommendation{recs.length === 1 ? '' : 's'} curated just for you
              </p>
            </div>
          </motion.div>

          {/* Type filter pills */}
          <motion.div
            className={styles.filters}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {(['all', 'movie', 'tv', 'anime', 'manga'] as const).map((t) => (
              <button
                key={t}
                className={`${styles.filterPill} ${typeFilter === t ? styles.filterActive : ''}`}
                onClick={() => setTypeFilter(t)}
                style={typeFilter === t ? { background: c1, borderColor: c1 } : {}}
              >
                {t !== 'all' && typeIcon(t as RecommendableMediaType)}
                {t === 'all' ? 'All' : MEDIA_TYPE_LABELS[t]}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Recommendations Grid */}
      <div className={styles.container}>
        <AnimatePresence mode="popLayout">
          <motion.div className={styles.grid} layout>
            {filtered.map((rec, i) => (
              <motion.div
                key={rec.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <Link href={getHref(rec)} className={`${styles.card} ${isDark ? styles.cardDark : styles.cardLight}`}>
                  <div className={styles.cardPoster}>
                    <Image
                      src={tmdbImage(rec.poster_path, 'w342')}
                      alt={rec.title}
                      fill
                      sizes="(max-width: 640px) 50vw, 200px"
                      style={{ objectFit: 'cover' }}
                    />
                    <div className={styles.cardOverlay} />
                    <div className={styles.cardTypeBadge}>
                      {typeIcon(rec.media_type)}
                      {MEDIA_TYPE_LABELS[rec.media_type]}
                    </div>
                  </div>

                  <div className={styles.cardContent}>
                    <h3 className={styles.cardTitle}>{rec.title}</h3>
                    {rec.message && (
                      <p className={styles.cardMessage}>&ldquo;{rec.message}&rdquo;</p>
                    )}
                    <div className={styles.cardTime}>
                      <HiClock size={12} />
                      {formatDistanceToNow(new Date(rec.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <p>No recommendations match this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
}
