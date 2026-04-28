'use client';

/**
 * Mood Mode — a single-decision recommender.
 *
 * The user adjusts two sliders (energy + brain), picks a time budget, and
 * (optionally) tags a vibe. We hand all of that to the moodEngine, which
 * returns a ranked list of picks. The UI then presents ONE pick at a time
 * (the top of the list) with a "Try another" button to walk through the
 * rest — no decision-fatigue grids.
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import {
  HiSparkles, HiFire, HiBolt, HiClock, HiArrowPath, HiBookmark, HiPlay,
  HiArrowLeft, HiFilm, HiTv, HiCubeTransparent,
} from 'react-icons/hi2';
import { tmdbImage } from '@/lib/tmdb';
import { addToWatchlist } from '@/lib/store';
import { pickForMood, VIBE_LABELS, type MoodInput, type MoodPick, type Vibe } from '@/lib/moodEngine';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import toast from 'react-hot-toast';
import RandomRoller from './RandomRoller';
import styles from './mood.module.css';

const TIME_OPTIONS: ReadonlyArray<{ value: MoodInput['timeMinutes']; label: string; sub: string }> = [
  { value: 30,  label: '30m', sub: '1 episode' },
  { value: 60,  label: '1h',  sub: 'Quick watch' },
  { value: 120, label: '2h',  sub: 'A film' },
  { value: 180, label: '3h+', sub: 'Epic night' },
];

const VIBE_OPTIONS: ReadonlyArray<Vibe> = ['funny', 'dark', 'cozy', 'romantic', 'epic', 'weird'];

function energyLabel(v: number): string {
  if (v < 35) return 'Chill';
  if (v > 65) return 'Intense';
  return 'Balanced';
}

function brainLabel(v: number): string {
  if (v < 35) return 'Popcorn';
  if (v > 65) return 'Thinky';
  return 'Balanced';
}

function renderTypeBadge(type: 'movie' | 'tv' | 'anime') {
  if (type === 'tv') return <><HiTv /> TV Series</>;
  if (type === 'anime') return <><HiSparkles /> Anime</>;
  return <><HiFilm /> Movie</>;
}

export default function MoodPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();

  // Which experience the user picked. Both cards stay visible at the top;
  // the chosen one renders below.
  const [mode, setMode] = useState<'mood' | 'random' | null>(null);

  const [energy, setEnergy] = useState(50);
  const [brain, setBrain] = useState(50);
  const [timeMinutes, setTimeMinutes] = useState<MoodInput['timeMinutes']>(120);
  const [vibes, setVibes] = useState<Vibe[]>([]);

  const [picks, setPicks] = useState<MoodPick[]>([]);
  const [pickIndex, setPickIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const current: MoodPick | undefined = picks[pickIndex];
  const remaining = picks.length - pickIndex - 1;

  const toggleVibe = (v: Vibe) =>
    setVibes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  const handlePick = useCallback(async () => {
    setLoading(true);
    setHasSubmitted(true);
    try {
      const results = await pickForMood(
        { energy, brain, timeMinutes, vibes },
        user?.id ?? null
      );
      setPicks(results);
      setPickIndex(0);
      if (results.length === 0) {
        toast.error('No matches — try widening your filters.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [energy, brain, timeMinutes, vibes, user?.id]);

  const handleTryAnother = () => {
    if (pickIndex < picks.length - 1) {
      setPickIndex((i) => i + 1);
    } else {
      toast('That was the last pick — adjust the sliders for fresh ideas.', { icon: '🎲' });
    }
  };

  const handleReset = () => {
    setPicks([]);
    setPickIndex(0);
    setHasSubmitted(false);
  };

  const handleSave = async () => {
    if (!user || !current) {
      toast.error(user ? 'Nothing to save.' : 'Sign in to save picks.');
      return;
    }
    const saved = await addToWatchlist({
      user_id: user.id,
      media_id: current.item.id,
      media_type: current.item.media_type,
      title: current.item.title,
      poster_path: current.item.poster_path,
      original_language: current.item.original_language ?? null,
      status: 'watchlist',
    });
    if (saved) toast.success('Added to your list');
    else toast.error('Could not save');
  };

  const detailHref = useMemo(() => {
    if (!current) return '/';
    const t = current.item.media_type;
    if (t === 'anime') return `/anime/${current.item.id}`;
    if (t === 'tv') return `/tv/${current.item.id}`;
    return `/movies/${current.item.id}`;
  }, [current]);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>
            <HiSparkles className={styles.titleIcon} /> Discover
          </h1>
          <p className={styles.subtitle}>
            Two ways to find your next watch. Pick one and let us do the work.
          </p>
        </header>

        {/* Mode picker — both cards always visible at the top */}
        <div className={styles.modePicker}>
          <button
            type="button"
            onClick={() => setMode('mood')}
            className={`${styles.modeCard} ${styles.modeCardMood} ${mode === 'mood' ? styles.modeCardActive : ''}`}
            aria-pressed={mode === 'mood'}
          >
            <div className={styles.modeEmoji}>🎭</div>
            <h2 className={styles.modeTitle}>Mood Generator</h2>
            <p className={styles.modeDesc}>
              Tell us your energy, brain, time and vibe. We pick ONE thing tailored to you.
            </p>
            <span className={styles.modeChip}><HiSparkles /> Personalized</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('random')}
            className={`${styles.modeCard} ${styles.modeCardRandom} ${mode === 'random' ? styles.modeCardActive : ''}`}
            aria-pressed={mode === 'random'}
          >
            <div className={styles.modeEmoji}>🎲</div>
            <h2 className={styles.modeTitle}>Random Generator</h2>
            <p className={styles.modeDesc}>
              Roll the dice. Filter by type/genre/year and let chance choose.
            </p>
            <span className={styles.modeChip}><HiCubeTransparent /> Surprise me</span>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'random' && (
            <motion.div
              key="random"
              className={styles.modeContent}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <RandomRoller />
            </motion.div>
          )}

          {mode === 'mood' && !current && (
            <motion.div
              key="form"
              className={styles.formCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              {/* Energy slider */}
              <div className={styles.sliderBlock}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderLabel}>Energy</span>
                  <span className={styles.sliderValue}>
                    {energyLabel(energy)}
                  </span>
                </div>
                <div className={styles.sliderRow}>
                  <span className={styles.sliderEnd} aria-hidden>🛋️</span>
                  <input
                    type="range" min={0} max={100} value={energy}
                    onChange={(e) => setEnergy(Number(e.target.value))}
                    className={styles.slider}
                    aria-label="Energy level"
                  />
                  <span className={styles.sliderEnd} aria-hidden><HiBolt /></span>
                </div>
              </div>

              {/* Brain slider */}
              <div className={styles.sliderBlock}>
                <div className={styles.sliderHeader}>
                  <span className={styles.sliderLabel}>Brain</span>
                  <span className={styles.sliderValue}>
                    {brainLabel(brain)}
                  </span>
                </div>
                <div className={styles.sliderRow}>
                  <span className={styles.sliderEnd} aria-hidden>🍿</span>
                  <input
                    type="range" min={0} max={100} value={brain}
                    onChange={(e) => setBrain(Number(e.target.value))}
                    className={styles.slider}
                    aria-label="Brain level"
                  />
                  <span className={styles.sliderEnd} aria-hidden>🧠</span>
                </div>
              </div>

              {/* Time budget */}
              <div className={styles.block}>
                <div className={styles.blockLabel}>
                  <HiClock /> Time tonight
                </div>
                <div className={styles.timeRow}>
                  {TIME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`${styles.timeBtn} ${timeMinutes === opt.value ? styles.timeBtnActive : ''}`}
                      onClick={() => setTimeMinutes(opt.value)}
                      type="button"
                    >
                      <span className={styles.timeBig}>{opt.label}</span>
                      <span className={styles.timeSub}>{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vibes */}
              <div className={styles.block}>
                <div className={styles.blockLabel}>
                  <HiFire /> Vibe <span className={styles.optional}>(optional)</span>
                </div>
                <div className={styles.vibeRow}>
                  {VIBE_OPTIONS.map((v) => (
                    <button
                      key={v}
                      className={`${styles.vibeChip} ${vibes.includes(v) ? styles.vibeChipActive : ''}`}
                      onClick={() => toggleVibe(v)}
                      type="button"
                    >
                      {VIBE_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className={styles.pickBtn}
                onClick={handlePick}
                disabled={loading}
                type="button"
              >
                {loading ? 'Reading the room…' : (
                  <>🎲 Pick for me</>
                )}
              </button>

              {hasSubmitted && !loading && picks.length === 0 && (
                <p className={styles.empty}>
                  No matches with these settings. Try widening your filters.
                </p>
              )}
            </motion.div>
          )}

          {mode === 'mood' && current && (
            <motion.div
              key={`pick-${current.item.media_type}-${current.item.id}`}
              className={styles.pickCard}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              <button className={styles.backBtn} onClick={handleReset} type="button">
                <HiArrowLeft /> Adjust mood
              </button>

              <div className={styles.pickBody}>
                <div className={styles.posterWrap}>
                  {current.item.poster_path ? (
                    <Image
                      src={tmdbImage(current.item.poster_path, 'w500') ?? ''}
                      alt={current.item.title}
                      width={300}
                      height={450}
                      className={styles.poster}
                      priority
                    />
                  ) : (
                    <div className={styles.posterFallback}>
                      <HiFilm size={48} />
                    </div>
                  )}
                </div>

                <div className={styles.pickMeta}>
                  <div className={styles.typeBadge}>
                    {renderTypeBadge(current.item.media_type)}
                  </div>

                  <h2 className={styles.pickTitle}>{current.item.title}</h2>

                  {current.item.vote_average > 0 && (
                    <div className={styles.rating}>
                      ★ {current.item.vote_average.toFixed(1)}
                      {current.item.release_date && (
                        <span className={styles.year}>
                          · {current.item.release_date.slice(0, 4)}
                        </span>
                      )}
                    </div>
                  )}

                  {current.reasons.length > 0 && (
                    <ul className={styles.reasons}>
                      {current.reasons.map((r) => (
                        <li key={r} className={styles.reasonChip}>{r}</li>
                      ))}
                    </ul>
                  )}

                  {current.item.overview && (
                    <p className={styles.overview}>{current.item.overview}</p>
                  )}

                  <div className={styles.actions}>
                    <Link href={detailHref} className={styles.actionPrimary}>
                      <HiPlay /> View details
                    </Link>
                    <button
                      className={styles.actionSecondary}
                      onClick={handleTryAnother}
                      type="button"
                      disabled={remaining < 0}
                    >
                      <HiArrowPath /> Try another
                      {remaining > 0 && <span className={styles.remainingBadge}>{remaining}</span>}
                    </button>
                    <button
                      className={styles.actionGhost}
                      onClick={handleSave}
                      type="button"
                    >
                      <HiBookmark /> Save
                    </button>
                  </div>

                  <div className={styles.sourceTag}>
                    {current.source === 'watchlist' && '📌 From your watchlist'}
                    {current.source === 'friends' && '👥 Loved by your friends'}
                    {current.source === 'discover' && '🔭 Fresh discovery'}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
