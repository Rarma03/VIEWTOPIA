'use client';

import { useEffect, useMemo, useState } from 'react';
import { HiSquares2X2, HiMagnifyingGlass, HiCheckCircle, HiCheck, HiArrowPath } from 'react-icons/hi2';
import { getTVSeason } from '@/lib/tmdb';
import { getAnimeEpisodes } from '@/lib/jikan';
import { useTheme } from '@/context/ThemeContext';
import styles from './EpisodeRatingGrid.module.css';

export type RatingTier = 'cinema' | 'awesome' | 'great' | 'good' | 'regular' | 'bad' | 'garbage';

export function getRatingTier(score: number | null | undefined): RatingTier | null {
  if (score == null || Number.isNaN(score) || score <= 0) return null;
  if (score >= 9.5) return 'cinema';
  if (score >= 9.0) return 'awesome';
  if (score >= 8.0) return 'great';
  if (score >= 7.0) return 'good';
  if (score >= 6.0) return 'regular';
  if (score >= 4.0) return 'bad';
  return 'garbage';
}

const TIER_LABELS: Record<RatingTier, string> = {
  cinema: 'Absolute Cinema',
  awesome: 'Awesome',
  great: 'Great',
  good: 'Good',
  regular: 'Regular',
  bad: 'Bad',
  garbage: 'Garbage',
};

const TIER_ORDER: RatingTier[] = ['cinema', 'awesome', 'great', 'good', 'regular', 'bad', 'garbage'];

interface EpisodeCell {
  score: number | null;
  title: string;
}

interface BaseProps {
  /** Display title above the grid; defaults to "Episode Ratings". */
  title?: string;
  /**
   * If provided, the grid renders an interactive progress overlay:
   * cells up to and including (season, episode) are visually marked watched.
   * Click any cell to set progress up to that episode.
   */
  progress?: { season: number; episode: number } | null;
  /** Called when the user clicks an episode cell to set their progress. */
  onSetProgress?: (season: number, episode: number) => void;
  /** Called when the user clicks the "Mark all as watched" button. */
  onMarkAll?: () => void;
  /** Called when the user resets their progress (clears last-watched). */
  onResetProgress?: () => void;
}

interface TVProps extends BaseProps {
  mode: 'tv';
  tvId: number;
  /** Season numbers to render (typically 1..N, excluding specials/season 0). */
  seasons: number[];
}

interface AnimeProps extends BaseProps {
  mode: 'anime';
  malId: number;
}

type Props = TVProps | AnimeProps;

export default function EpisodeRatingGrid(props: Props) {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  // Map: seasonNumber -> episodeNumber -> cell
  const [data, setData] = useState<Map<number, Map<number, EpisodeCell>>>(new Map());
  const [maxEpisode, setMaxEpisode] = useState(0);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  // Reset visible window when source data changes.
  useEffect(() => { setVisibleCount(20); }, [data]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(new Map());
    setMaxEpisode(0);

    const load = async () => {
      const next = new Map<number, Map<number, EpisodeCell>>();
      let maxEp = 0;

      if (props.mode === 'tv') {
        const seasons = props.seasons.filter((n) => n > 0);
        if (seasons.length === 0) {
          if (!cancelled) { setData(next); setMaxEpisode(0); setLoading(false); }
          return;
        }
        const results = await Promise.all(
          seasons.map((s) =>
            getTVSeason(props.tvId, s).catch(() => null),
          ),
        );
        results.forEach((season, idx) => {
          const sNum = seasons[idx];
          const epMap = new Map<number, EpisodeCell>();
          (season?.episodes || []).forEach((e) => {
            epMap.set(e.episode_number, {
              score: e.vote_average ?? null,
              title: e.name || `Episode ${e.episode_number}`,
            });
            if (e.episode_number > maxEp) maxEp = e.episode_number;
          });
          next.set(sNum, epMap);
        });
      } else {
        const eps = await getAnimeEpisodes(props.malId).catch(() => [] as Awaited<ReturnType<typeof getAnimeEpisodes>>);
        const epMap = new Map<number, EpisodeCell>();
        eps.forEach((e, i) => {
          // Jikan does not always include an episode number; fall back to 1-based index.
          const num = i + 1;
          // Jikan returns per-episode scores on a 0–5 scale. Normalize to 0–10
          // so the same tier thresholds (used for TMDB) apply.
          const raw = e.score;
          const normalized = raw == null || Number.isNaN(raw) ? null : raw * 2;
          epMap.set(num, {
            score: normalized,
            title: e.title || `Episode ${num}`,
          });
          if (num > maxEp) maxEp = num;
        });
        next.set(1, epMap);
      }

      if (!cancelled) {
        setData(next);
        setMaxEpisode(maxEp);
        setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [props]);

  const seasonNumbers = useMemo(
    () => Array.from(data.keys()).sort((a, b) => a - b),
    [data],
  );

  const hasAny = useMemo(() => {
    for (const epMap of data.values()) {
      for (const cell of epMap.values()) {
        if (cell.score != null && cell.score > 0) return true;
      }
    }
    return false;
  }, [data]);

  // Episode numbers matching the search query (matches by episode number or title).
  const matchingEpisodes = useMemo(() => {
    const all = Array.from({ length: maxEpisode }, (_, i) => i + 1);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((epNum) => {
      if (String(epNum).includes(q) || `e${epNum}`.includes(q)) return true;
      for (const epMap of data.values()) {
        const cell = epMap.get(epNum);
        if (cell?.title.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [data, maxEpisode, search]);

  const isSearching = search.trim().length > 0;
  const visibleEpisodes = isSearching
    ? matchingEpisodes
    : matchingEpisodes.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < matchingEpisodes.length;

  const gridStyle = {
    gridTemplateColumns: `auto repeat(${seasonNumbers.length || 1}, minmax(44px, 1fr))`,
  } as const;

  const progressEnabled = !!props.onSetProgress;
  const progressSeason = props.progress?.season ?? 0;
  const progressEpisode = props.progress?.episode ?? 0;

  // Determine if a (season, episode) cell is at-or-before the current progress mark.
  const isWatched = (season: number, epNum: number): boolean => {
    if (!props.progress) return false;
    if (season < progressSeason) return true;
    if (season > progressSeason) return false;
    return epNum <= progressEpisode;
  };

  const isExactProgress = (season: number, epNum: number): boolean => {
    return !!props.progress && season === progressSeason && epNum === progressEpisode;
  };

  const totalEpisodes = useMemo(() => {
    let total = 0;
    for (const epMap of data.values()) total += epMap.size;
    return total;
  }, [data]);

  const watchedCount = useMemo(() => {
    if (!props.progress) return 0;
    let count = 0;
    for (const s of seasonNumbers) {
      const epMap = data.get(s);
      if (!epMap) continue;
      if (s < progressSeason) {
        count += epMap.size;
      } else if (s === progressSeason) {
        for (const ep of epMap.keys()) if (ep <= progressEpisode) count++;
      }
    }
    return count;
  }, [data, seasonNumbers, props.progress, progressSeason, progressEpisode]);

  return (
    <div className={`${styles.wrapper} ${isDark ? '' : styles.light}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <HiSquares2X2 size={18} /> {props.title || 'Episode Ratings'}
        </h3>
        <div className={styles.legend}>
          {TIER_ORDER.map((tier) => (
            <span key={tier} className={styles.legendItem}>
              <span className={`${styles.dot} ${styles[tier]}`} />
              {TIER_LABELS[tier]}
            </span>
          ))}
        </div>
      </div>

      {progressEnabled && !loading && totalEpisodes > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressInfo}>
            <HiCheckCircle size={16} className={styles.progressIcon} />
            {props.progress ? (
              <span>
                Watched <strong>{watchedCount}</strong> / {totalEpisodes} episodes
                {props.mode === 'tv' && ` — last: S${progressSeason}·E${progressEpisode}`}
                {props.mode === 'anime' && ` — last: Episode ${progressEpisode}`}
              </span>
            ) : (
              <span>Click any episode to mark it as your last-watched.</span>
            )}
          </div>
          <div className={styles.progressActions}>
            {props.progress && props.onResetProgress && (
              <button type="button" className={styles.progressBtnGhost} onClick={props.onResetProgress}>
                <HiArrowPath size={14} /> Reset
              </button>
            )}
            {props.onMarkAll && watchedCount < totalEpisodes && (
              <button type="button" className={styles.progressBtn} onClick={props.onMarkAll}>
                <HiCheck size={14} /> Mark all as watched
              </button>
            )}
          </div>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${totalEpisodes ? (watchedCount / totalEpisodes) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>Loading episode ratings…</p>
      ) : !hasAny || maxEpisode === 0 ? (
        <p className={styles.empty}>No per-episode ratings available.</p>
      ) : (
        <>
          <div className={styles.searchRow}>
            <div className={styles.searchInputWrap}>
              <HiMagnifyingGlass size={15} className={styles.searchIcon} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search episode by number or title…"
                className={styles.searchInput}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className={styles.searchClear}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <span className={styles.searchMeta}>
              {isSearching
                ? `${matchingEpisodes.length} match${matchingEpisodes.length === 1 ? '' : 'es'}`
                : `Showing ${Math.min(visibleCount, matchingEpisodes.length)} of ${maxEpisode}`}
            </span>
          </div>

          {visibleEpisodes.length === 0 ? (
            <p className={styles.empty}>No episodes match “{search}”.</p>
          ) : (
            <div className={styles.scrollX}>
              <div className={styles.grid} style={gridStyle}>
                {/* Top-left blank corner */}
                <div />
                {/* Season headers */}
                {seasonNumbers.map((s) => (
                  <div key={`h-${s}`} className={styles.cellHeader}>
                    {props.mode === 'tv' ? `S${s}` : 'Eps'}
                  </div>
                ))}

                {/* Rows */}
                {visibleEpisodes.map((epNum) => (
                  <RowFragment
                    key={epNum}
                    epNum={epNum}
                    seasonNumbers={seasonNumbers}
                    data={data}
                    isWatched={isWatched}
                    isExactProgress={isExactProgress}
                    onSetProgress={props.onSetProgress}
                  />
                ))}
              </div>
            </div>
          )}

          {hasMore && (
            <div className={styles.moreRow}>
              <button
                type="button"
                className={styles.moreBtn}
                onClick={() => setVisibleCount((c) => Math.min(c + 20, matchingEpisodes.length))}
              >
                Show next {Math.min(20, matchingEpisodes.length - visibleCount)} episodes
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RowFragment({
  epNum,
  seasonNumbers,
  data,
  isWatched,
  isExactProgress,
  onSetProgress,
}: {
  epNum: number;
  seasonNumbers: number[];
  data: Map<number, Map<number, EpisodeCell>>;
  isWatched: (season: number, epNum: number) => boolean;
  isExactProgress: (season: number, epNum: number) => boolean;
  onSetProgress?: (season: number, epNum: number) => void;
}) {
  const interactive = !!onSetProgress;
  // Row is considered watched if every column the row appears in is watched.
  const rowWatched = seasonNumbers.length > 0 && seasonNumbers.every((s) => isWatched(s, epNum));
  return (
    <>
      <div className={`${styles.cellRowLabel} ${rowWatched ? styles.rowLabelWatched : ''}`}>
        E{epNum}
        {rowWatched && <span className={styles.rowCheck} aria-label="watched">✓</span>}
      </div>
      {seasonNumbers.map((s) => {
        const cell = data.get(s)?.get(epNum);
        const tier = cell ? getRatingTier(cell.score) : null;
        const watched = isWatched(s, epNum);
        const exact = isExactProgress(s, epNum);
        const baseClasses = [
          styles.cell,
          interactive ? styles.interactive : '',
          watched ? styles.watched : '',
          exact ? styles.exactProgress : '',
        ];
        const handleClick = () => onSetProgress?.(s, epNum);
        const tooltipText = cell?.title;

        if (!cell || cell.score == null || cell.score <= 0) {
          return (
            <button
              type="button"
              key={`${s}-${epNum}`}
              className={[...baseClasses, styles.cellEmpty].filter(Boolean).join(' ')}
              onClick={interactive ? handleClick : undefined}
              disabled={!interactive}
              aria-label={interactive ? `Mark progress to season ${s} episode ${epNum}` : undefined}
              title={tooltipText}
            >
              –
            </button>
          );
        }
        return (
          <button
            type="button"
            key={`${s}-${epNum}`}
            className={[...baseClasses, tier ? styles[tier] : ''].filter(Boolean).join(' ')}
            onClick={interactive ? handleClick : undefined}
            disabled={!interactive}
            aria-label={interactive ? `Mark progress to season ${s} episode ${epNum}` : undefined}
            title={tooltipText}
          >
            {cell.score.toFixed(1)}
          </button>
        );
      })}
    </>
  );
}
