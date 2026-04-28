'use client';

/**
 * LeetCode-style circular progress rings for the profile page.
 *
 * Each ring shows `watched / universe_total` for a media category, where
 * `universe_total` is sourced from TMDB / Jikan via `getUniverseTotals()` and
 * cached for 24h. The Movies ring is split into colored sub-arcs for
 * Hollywood (`en`), Bollywood (`hi`), and Other.
 *
 * Items added before the `original_language` column existed (legacy rows with
 * NULL) are bucketed as Other so the ring remains usable without a backfill.
 */

import { useEffect, useMemo, useState } from 'react';
import { HiFilm, HiTv, HiSparkles } from 'react-icons/hi2';
import { WatchlistItem } from '@/types';
import { getUniverseTotals, UniverseTotals } from '@/lib/universeTotals';
import styles from './CategoryRings.module.css';

const TRACK = 'rgba(255,255,255,0.08)';

// Hollywood / Bollywood / Other palette (mirrors the LeetCode Easy/Med/Hard vibe).
const LANG_COLORS = {
  hollywood: '#22d3ee', // cyan
  bollywood: '#f59e0b', // amber
  other: '#ef4444',     // red
} as const;

const TV_COLOR = '#00d4ff';
const ANIME_COLOR = '#a855f7';

interface RingArc { color: string; value: number }

interface RingProps {
  /** Center label (numerator). */
  watched: number;
  /** Center label (denominator) — universe total. */
  total: number;
  /** Arc segments, drawn in order. Sum of values may be << total. */
  arcs: RingArc[];
  /** Single emphasized accent color when no breakdown exists. */
  accent?: string;
}

function formatTotal(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function Ring({ watched, total, arcs, accent }: Readonly<RingProps>) {
  const SIZE = 160;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;

  // Total fill = sum(arcs) / total. Rotate -90deg so arcs start at 12 o'clock.
  const filled = total > 0 ? Math.min(arcs.reduce((s, a) => s + a.value, 0), total) : 0;
  const fillFrac = total > 0 ? filled / total : 0;

  // For a ring measured against a huge denominator, raw fractions can be so
  // small the arc is invisible. Enforce a 1.5° minimum visible sweep per
  // non-zero segment so users can still see they've made progress.
  const MIN_VISIBLE_FRAC = 1.5 / 360;

  let cursor = 0;
  const segments = arcs.filter((a) => a.value > 0).map((arc) => {
    const rawFrac = total > 0 ? arc.value / total : 0;
    const frac = Math.max(rawFrac, MIN_VISIBLE_FRAC);
    const dashLen = frac * C;
    const dashOff = -((cursor / total) * C);
    cursor += arc.value;
    return { color: arc.color, dashLen, dashOff };
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.ringSvg}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={TRACK} strokeWidth={STROKE} />

      {segments.length === 0 && fillFrac > 0 && accent && (
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke={accent} strokeWidth={STROKE} strokeLinecap="round"
          strokeDasharray={`${Math.max(fillFrac, MIN_VISIBLE_FRAC) * C} ${C}`}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      )}
      {segments.map((seg, i) => (
        <circle
          key={`${seg.color}-${i}`}
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none" stroke={seg.color} strokeWidth={STROKE} strokeLinecap="butt"
          strokeDasharray={`${seg.dashLen} ${C - seg.dashLen}`}
          strokeDashoffset={seg.dashOff}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      ))}

      <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" className={styles.ringNum}>
        {watched}
      </text>
      <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" className={styles.ringDen}>
        /{formatTotal(total)}
      </text>
    </svg>
  );
}

interface BreakdownRowProps { label: string; value: number; total: number; color: string }
function BreakdownRow({ label, value, total, color }: Readonly<BreakdownRowProps>) {
  return (
    <div className={styles.breakRow}>
      <span className={styles.breakLabel} style={{ color }}>{label}</span>
      <span className={styles.breakVal}>
        {value}<span className={styles.breakTotal}>/{formatTotal(total || 0)}</span>
      </span>
    </div>
  );
}

export default function CategoryRings({ items }: Readonly<{ items: WatchlistItem[] }>) {
  const [universe, setUniverse] = useState<UniverseTotals | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getUniverseTotals().then((t) => { if (!cancelled) setUniverse(t); });
    return () => { cancelled = true; };
  }, []);

  // Watched-only counts from the user's library.
  const watched = useMemo(() => {
    let movieWatched = 0, tvWatched = 0, animeWatched = 0;
    let mHollywood = 0, mBollywood = 0, mOther = 0;
    for (const it of items) {
      if (it.status !== 'watched') continue;
      if (it.media_type === 'movie') {
        movieWatched++;
        const lang = (it.original_language ?? '').toLowerCase();
        if (lang === 'en') mHollywood++;
        else if (lang === 'hi') mBollywood++;
        else mOther++;
      } else if (it.media_type === 'tv') {
        tvWatched++;
      } else {
        animeWatched++;
      }
    }
    return { movieWatched, tvWatched, animeWatched, mHollywood, mBollywood, mOther };
  }, [items]);

  // Until the universe totals load, render with zero denominators (track only).
  const u = universe ?? {
    movieTotal: 0, movieHollywood: 0, movieBollywood: 0, movieOther: 0,
    tvTotal: 0, animeTotal: 0,
  };

  return (
    <section className={styles.wrap} aria-label="Category progress">
      <h2 className={styles.title}>Library Progress</h2>

      <div className={styles.row}>
        {/* Movies — split arcs */}
        <div className={styles.card}>
          <div className={styles.ringWrap}>
            <Ring
              watched={watched.movieWatched}
              total={u.movieTotal}
              arcs={[
                { color: LANG_COLORS.hollywood, value: watched.mHollywood },
                { color: LANG_COLORS.bollywood, value: watched.mBollywood },
                { color: LANG_COLORS.other, value: watched.mOther },
              ]}
            />
            <div className={styles.ringFooter}><HiFilm size={14} /> Movies</div>
          </div>
          <div className={styles.breakdown}>
            <BreakdownRow label="Hollywood" value={watched.mHollywood} total={u.movieHollywood} color={LANG_COLORS.hollywood} />
            <BreakdownRow label="Bollywood" value={watched.mBollywood} total={u.movieBollywood} color={LANG_COLORS.bollywood} />
            <BreakdownRow label="Other" value={watched.mOther} total={u.movieOther} color={LANG_COLORS.other} />
          </div>
        </div>

        {/* TV Series */}
        <div className={styles.card}>
          <div className={styles.ringWrap}>
            <Ring watched={watched.tvWatched} total={u.tvTotal} arcs={[]} accent={TV_COLOR} />
            <div className={styles.ringFooter}><HiTv size={14} /> TV Series</div>
          </div>
          <div className={styles.breakdown}>
            <BreakdownRow label="Completed" value={watched.tvWatched} total={u.tvTotal} color={TV_COLOR} />
          </div>
        </div>

        {/* Anime */}
        <div className={styles.card}>
          <div className={styles.ringWrap}>
            <Ring watched={watched.animeWatched} total={u.animeTotal} arcs={[]} accent={ANIME_COLOR} />
            <div className={styles.ringFooter}><HiSparkles size={14} /> Anime</div>
          </div>
          <div className={styles.breakdown}>
            <BreakdownRow label="Completed" value={watched.animeWatched} total={u.animeTotal} color={ANIME_COLOR} />
          </div>
        </div>
      </div>

      {!universe && (
        <p className={styles.loading}>Fetching universe totals…</p>
      )}
    </section>
  );
}
