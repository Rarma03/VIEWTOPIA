'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { HiMagnifyingGlass, HiXMark, HiFilm, HiTv, HiSparkles, HiStar } from 'react-icons/hi2';
import { motion, AnimatePresence } from 'framer-motion';
import { searchMulti, searchMovies, searchTV, normalizeMediaItem, tmdbImage } from '@/lib/tmdb';
import { searchAnime } from '@/lib/jikan';
import { MediaItem, AnimeItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import styles from './SearchBar.module.css';

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
    genre_ids: anime.genres.map((g) => g.mal_id),
    media_type: 'anime',
    popularity: anime.popularity || 0,
  };
}

interface SearchBarProps {
  onClose?: () => void;
}

export default function SearchBar({ onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'movie' | 'tv' | 'anime'>('all');
  const [liveResults, setLiveResults] = useState<MediaItem[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { isDark } = useTheme();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchLiveResults = useCallback(async (q: string, cat: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setLiveResults([]);
      setShowDropdown(false);
      return;
    }

    setLiveLoading(true);
    try {
      const promises: Promise<MediaItem[]>[] = [];

      if (cat === 'all') {
        promises.push(
          searchMulti(q).then((res) =>
            res.results
              .filter((r) => (r as unknown as Record<string, string>).media_type !== 'person')
              .slice(0, 6)
              .map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>))
          )
        );
      } else if (cat === 'movie') {
        promises.push(
          searchMovies(q).then((res) =>
            res.results.slice(0, 6).map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'))
          )
        );
      } else if (cat === 'tv') {
        promises.push(
          searchTV(q).then((res) =>
            res.results.slice(0, 6).map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv'))
          )
        );
      }

      if (cat === 'all' || cat === 'anime') {
        promises.push(
          searchAnime(q)
            .then((res) => res.data.slice(0, 4).map(animeToMediaItem))
            .catch(() => [])
        );
      }

      const arrays = await Promise.all(promises);
      const combined = arrays.flat().slice(0, 8);
      setLiveResults(combined);
      setShowDropdown(combined.length > 0);
    } catch {
      setLiveResults([]);
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.trim().length < 2) {
      setLiveResults([]);
      setShowDropdown(false);
      return;
    }
    setLiveLoading(true);
    debounceRef.current = setTimeout(() => {
      fetchLiveResults(value, category);
    }, 400);
  };

  const handleCategoryChange = (cat: typeof category) => {
    setCategory(cat);
    if (query.trim().length >= 2) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      fetchLiveResults(query, cat);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setShowDropdown(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${category}`);
    onClose?.();
  };

  const handleResultClick = () => {
    setShowDropdown(false);
    onClose?.();
  };

  const getHref = (item: MediaItem) => {
    if (item.media_type === 'anime') return `/anime/${item.id}`;
    if (item.media_type === 'tv') return `/tv/${item.id}`;
    return `/movies/${item.id}`;
  };

  const typeIcon = (type: string) => {
    if (type === 'movie') return <HiFilm size={12} />;
    if (type === 'tv') return <HiTv size={12} />;
    return <HiSparkles size={12} />;
  };

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <form onSubmit={handleSubmit} className={`${styles.searchBar} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.inputGroup}>
          <HiMagnifyingGlass size={20} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => liveResults.length > 0 && setShowDropdown(true)}
            placeholder="Search movies, TV shows, anime..."
            className={styles.input}
          />
          {liveLoading && <span className={styles.spinner} />}
          {query && !liveLoading && (
            <button type="button" onClick={() => { setQuery(''); setLiveResults([]); setShowDropdown(false); }} className={styles.clearBtn}>
              <HiXMark size={18} />
            </button>
          )}
        </div>
        <div className={styles.filters}>
          {(['all', 'movie', 'tv', 'anime'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              className={`${styles.filterBtn} ${category === cat ? styles.activeFilter : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat === 'all' ? 'All' : cat === 'movie' ? 'Movies' : cat === 'tv' ? 'TV' : 'Anime'}
            </button>
          ))}
        </div>
      </form>

      {/* Live Results Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            className={`${styles.dropdown} ${isDark ? styles.dropdownDark : styles.dropdownLight}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {liveResults.map((item) => (
              <Link
                key={`${item.media_type}-${item.id}`}
                href={getHref(item)}
                className={styles.dropdownItem}
                onClick={handleResultClick}
              >
                <div className={styles.dropdownPoster}>
                  {item.poster_path ? (
                    <Image
                      src={tmdbImage(item.poster_path, 'w92')}
                      alt={item.title}
                      width={40}
                      height={60}
                      style={{ objectFit: 'cover', borderRadius: 6 }}
                    />
                  ) : (
                    <div className={styles.dropdownNoPoster}><HiFilm size={20} /></div>
                  )}
                </div>
                <div className={styles.dropdownInfo}>
                  <span className={styles.dropdownTitle}>{item.title}</span>
                  <div className={styles.dropdownMeta}>
                    <span className={styles.dropdownType}>
                      {typeIcon(item.media_type)}
                      {item.media_type === 'movie' ? 'Movie' : item.media_type === 'tv' ? 'TV' : 'Anime'}
                    </span>
                    {item.release_date && (
                      <span>{new Date(item.release_date).getFullYear()}</span>
                    )}
                    {item.vote_average > 0 && (
                      <span><HiStar size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {item.vote_average.toFixed(1)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
            <Link
              href={`/search?q=${encodeURIComponent(query.trim())}&type=${category}`}
              className={styles.dropdownViewAll}
              onClick={handleResultClick}
            >
              View all results for &ldquo;{query}&rdquo;
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
