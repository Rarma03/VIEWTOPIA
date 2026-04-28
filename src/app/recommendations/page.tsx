'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  HiHeart, HiFilm, HiChevronRight, HiUserGroup, HiGlobeAlt,
} from 'react-icons/hi2';
import {
  getRecommendations, getProfilesByIds, getFriends, PublicProfile,
} from '@/lib/store';
import { Recommendation, User } from '@/types';
import { tmdbImage } from '@/lib/tmdb';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import styles from './recommendations.module.css';

type RecTab = 'friends' | 'global';

const BUNDLE_COLORS = [
  ['#e50914', '#ff4757'],
  ['#8b5cf6', '#a78bfa'],
  ['#06b6d4', '#22d3ee'],
  ['#f59e0b', '#fbbf24'],
  ['#10b981', '#34d399'],
  ['#ec4899', '#f472b6'],
];

function RecContent() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const currentUserId = user?.id || '';

  const initialTab = (searchParams.get('tab') as RecTab) || 'friends';
  const [tab, setTab] = useState<RecTab>(initialTab);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [profileMap, setProfileMap] = useState<Record<string, PublicProfile>>({});
  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFriendIds([]);
      return;
    }
    let cancelled = false;
    void getFriends(currentUserId).then((ids) => { if (!cancelled) setFriendIds(ids); });
    return () => { cancelled = true; };
  }, [currentUserId]);

  useEffect(() => {
    let cancelled = false;
    void getRecommendations().then(async (allRecs) => {
      if (cancelled) return;
      setRecs(allRecs);
      const profiles = await getProfilesByIds(allRecs.map((r) => r.user_id));
      if (!cancelled) setProfileMap(profiles);
    });
    return () => { cancelled = true; };
  }, [currentUserId]);

  const handleTab = (t: RecTab) => {
    setTab(t);
    router.replace(`/recommendations?tab=${t}`, { scroll: false });
  };

  // Group by user, filtered by tab
  const bundles = useMemo(() => {
    // 'friends' = your accepted friends + your own picks; 'global' = everyone.
    const friendSet = new Set([currentUserId, ...friendIds]);
    const filtered = tab === 'friends'
      ? recs.filter((r) => friendSet.has(r.user_id))
      : recs;

    const grouped = filtered.reduce((acc, rec) => {
      const userId = rec.user_id;
      if (!acc[userId]) acc[userId] = [];
      acc[userId].push(rec);
      return acc;
    }, {} as Record<string, Recommendation[]>);

    return Object.entries(grouped).map(([userId, items]) => {
      const profile = profileMap[userId];
      const u: User | undefined = profile ? {
        id: profile.id,
        email: '',
        username: profile.username || 'user',
        display_name: profile.display_name || profile.username || 'User',
        avatar_url: profile.avatar_url || null,
        city: profile.city || null,
        is_premium: false,
        created_at: '',
        updated_at: '',
      } : items[0]?.user;
      return { userId, user: u, items };
    });
  }, [recs, tab, profileMap, currentUserId, friendIds]);

  const tabConfig: { key: RecTab; label: string; icon: React.ReactNode }[] = [
    { key: 'friends', label: 'Friends', icon: <HiUserGroup size={18} /> },
    { key: 'global', label: 'Global', icon: <HiGlobeAlt size={18} /> },
  ];

  const { visible: visibleBundles, shown, total, hasMore, showMore } = useShowMore(bundles, 6);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          className={styles.header}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={styles.title}>Recommendations</h1>
          <p className={styles.subtitle}>
            {tab === 'friends'
              ? 'Curated picks from your friends — tap a collection to explore'
              : 'Discover what the community is recommending'}
          </p>
        </motion.div>

        {/* Sub-tab bar */}
        <div className={styles.tabBar}>
          {tabConfig.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => handleTab(t.key)}
            >
              {t.icon} <span>{t.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {bundles.length === 0 ? (
            <motion.div
              key="empty"
              className={styles.empty}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <span className={styles.emptyIcon}>{tab === 'friends' ? '👥' : '🌍'}</span>
              <p>
                {tab === 'friends'
                  ? 'No friend recommendations yet. Add friends from the Global page to see their picks here!'
                  : 'No recommendations yet. Be the first to recommend something!'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={tab}
              className={styles.bundleGrid}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {visibleBundles.map(({ userId, user: bundleUser, items }, idx) => {
                const [c1, c2] = BUNDLE_COLORS[idx % BUNDLE_COLORS.length];
                const previewPosters = items.slice(0, 4).map((r) => r.poster_path).filter(Boolean);
                const isFriend = userId === currentUserId;

                return (
                  <motion.div
                    key={userId}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1, type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <Link
                      href={`/recommendations/${userId}`}
                      className={`${styles.bundleCard} ${isDark ? styles.bundleDark : styles.bundleLight}`}
                    >
                      {/* Poster Stack Preview */}
                      <div className={styles.posterStack}>
                        {previewPosters.map((poster, i) => (
                          <div
                            key={i}
                            className={styles.stackPoster}
                            style={{
                              zIndex: previewPosters.length - i,
                              transform: `rotate(${(i - 1) * 6}deg) translateX(${i * 8}px)`,
                            }}
                          >
                            <Image
                              src={tmdbImage(poster, 'w342')}
                              alt=""
                              fill
                              sizes="120px"
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                        ))}
                        <div
                          className={styles.stackOverlay}
                          style={{ background: `linear-gradient(135deg, ${c1}40, ${c2}20)` }}
                        />
                      </div>

                      {/* Bundle Info */}
                      <div className={styles.bundleInfo}>
                        <div className={styles.bundleUser}>
                          {/* Avatar acts as a sub-link to the user's profile,
                              but it's rendered as a <button> because it sits
                              inside the outer card <Link> — nesting <a> in
                              <a> is invalid HTML and breaks hydration. */}
                          <button
                            type="button"
                            className={styles.bundleAvatar}
                            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, border: 0, cursor: 'pointer' }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(`/profile/${userId}`);
                            }}
                            aria-label={`Open ${bundleUser?.display_name || 'user'}'s profile`}
                          >
                            {bundleUser?.display_name?.charAt(0).toUpperCase() || 'U'}
                          </button>
                          <div className={styles.bundleUserText}>
                            <span className={styles.bundleUserName}>
                              {bundleUser?.display_name || 'User'}&apos;s Picks
                            </span>
                            <span className={styles.bundleCount}>
                              <HiFilm size={13} /> {items.length} title{items.length !== 1 ? 's' : ''}
                              {isFriend && <span className={styles.friendTag}>Friend</span>}
                            </span>
                          </div>
                        </div>

                        {items[0]?.message && (
                          <p className={styles.bundlePreview}>
                            &ldquo;{items[0].message.slice(0, 60)}{items[0].message.length > 60 ? '...' : ''}&rdquo;
                          </p>
                        )}

                        <div className={styles.bundleFooter}>
                          <div className={styles.bundleTitles}>
                            {items.slice(0, 3).map((r) => r.title).join(' • ')}
                            {items.length > 3 && ` +${items.length - 3} more`}
                          </div>
                          <span className={styles.bundleArrow}>
                            <HiChevronRight size={20} />
                          </span>
                        </div>
                      </div>

                      {/* Heart badge */}
                      <div
                        className={styles.heartBadge}
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                      >
                        <HiHeart size={16} />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        {hasMore && (
          <ShowMoreButton shown={shown} total={total} step={6} onClick={showMore} />
        )}
      </div>
    </div>
  );
}

export default function RecommendationsPage() {
  return <Suspense><RecContent /></Suspense>;
}
