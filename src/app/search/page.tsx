'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import MediaCard from '@/components/common/MediaCard';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import { searchMovies, searchTV, searchMulti, normalizeMediaItem, searchPerson, discoverByPerson, tmdbImage, PersonResult } from '@/lib/tmdb';
import { searchAnime } from '@/lib/jikan';
import { MediaItem, AnimeItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { HiMagnifyingGlass, HiXMark, HiUser } from 'react-icons/hi2';
import { Suspense } from 'react';
import styles from './search.module.css';

type Category = 'all' | 'movie' | 'tv' | 'anime';

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

function fetchResults(query: string, type: string): Promise<MediaItem[]> {
  const promises: Promise<MediaItem[]>[] = [];

  if (type === 'all') {
    promises.push(
      searchMulti(query).then((res) =>
        res.results
          .filter((r) => (r as unknown as Record<string, string>).media_type !== 'person')
          .map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>))
      )
    );
  } else if (type === 'movie') {
    promises.push(
      searchMovies(query).then((res) =>
        res.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'movie'))
      )
    );
  } else if (type === 'tv') {
    promises.push(
      searchTV(query).then((res) =>
        res.results.map((r) => normalizeMediaItem(r as unknown as Record<string, unknown>, 'tv'))
      )
    );
  }

  if (type === 'all' || type === 'anime') {
    promises.push(
      searchAnime(query)
        .then((res) => res.data.map(animeToMediaItem))
        .catch(() => [])
    );
  }

  return Promise.all(promises).then((arrays) => arrays.flat());
}

function SearchContent() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();

  // Search state
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Person filter state
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [personLoading, setPersonLoading] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [personMedia, setPersonMedia] = useState<MediaItem[]>([]);
  const [personMediaLoading, setPersonMediaLoading] = useState(false);
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const personDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const personWrapperRef = useRef<HTMLDivElement>(null);
  const initializedFromUrl = useRef(false);

  // Auto-focus search input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Read personId/personName from URL and auto-select
  useEffect(() => {
    if (initializedFromUrl.current) return;
    const personId = searchParams.get('personId');
    const personName = searchParams.get('personName');
    if (personId && personName) {
      initializedFromUrl.current = true;
      const person: PersonResult = {
        id: Number(personId),
        name: personName,
        profile_path: null,
        known_for_department: 'Acting',
      };
      setSelectedPerson(person);
      setPersonMediaLoading(true);
      discoverByPerson(person.id)
        .then((media) => setPersonMedia(media))
        .catch(() => setPersonMedia([]))
        .finally(() => setPersonMediaLoading(false));
    }
  }, [searchParams]);

  // Debounced title search
  const triggerSearch = useCallback((q: string, cat: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await fetchResults(q, cat);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    triggerSearch(value, category);
  };

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    if (query.trim().length >= 2) {
      triggerSearch(query, cat);
    }
  };

  const clearQuery = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  // Close person dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (personWrapperRef.current && !personWrapperRef.current.contains(e.target as Node)) {
        setShowPersonDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Person search debounce
  const handlePersonSearch = useCallback((value: string) => {
    setPersonQuery(value);
    if (personDebounce.current) clearTimeout(personDebounce.current);
    if (!value.trim() || value.trim().length < 2) {
      setPersonResults([]);
      setShowPersonDropdown(false);
      return;
    }
    personDebounce.current = setTimeout(async () => {
      setPersonLoading(true);
      try {
        const res = await searchPerson(value);
        setPersonResults(res.results.slice(0, 8));
        setShowPersonDropdown(true);
      } catch {
        setPersonResults([]);
      } finally {
        setPersonLoading(false);
      }
    }, 400);
  }, []);

  const handleSelectPerson = useCallback(async (person: PersonResult) => {
    setSelectedPerson(person);
    setShowPersonDropdown(false);
    setPersonQuery('');
    setPersonMediaLoading(true);
    try {
      const media = await discoverByPerson(person.id);
      setPersonMedia(media);
    } catch {
      setPersonMedia([]);
    } finally {
      setPersonMediaLoading(false);
    }
  }, []);

  const clearPersonFilter = useCallback(() => {
    setSelectedPerson(null);
    setPersonMedia([]);
    setPersonQuery('');
  }, []);

  // Determine which results to display
  const displayResults = selectedPerson ? personMedia : results;
  const { visible: visibleResults, shown: shownResults, total: totalResults, hasMore: hasMoreResults, showMore: showMoreResults } = useShowMore(displayResults, 24);
  const isLoading = selectedPerson ? personMediaLoading : loading;
  const hasQuery = query.trim().length >= 2;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        {/* Inline Search Input */}
        <div className={styles.searchSection}>
          <div className={styles.searchInputWrapper}>
            <HiMagnifyingGlass size={20} className={styles.searchIcon} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search movies, TV shows, anime..."
              className={styles.searchInput}
            />
            {loading && <span className={styles.searchSpinner} />}
            {query && !loading && (
              <button type="button" onClick={clearQuery} className={styles.searchClearBtn}>
                <HiXMark size={18} />
              </button>
            )}
          </div>
          <div className={styles.categoryFilters}>
            {(['all', 'movie', 'tv', 'anime'] as const).map((cat) => (
              <button
                key={cat}
                className={`${styles.categoryBtn} ${category === cat ? styles.categoryActive : ''}`}
                onClick={() => handleCategoryChange(cat)}
              >
                {cat === 'all' ? 'All' : cat === 'movie' ? 'Movies' : cat === 'tv' ? 'TV' : 'Anime'}
              </button>
            ))}
          </div>
        </div>

        {/* Person (Director/Actor) Filter */}
        <div className={styles.personFilter} ref={personWrapperRef}>
          <div className={styles.personInputWrapper}>
            <HiUser size={16} className={styles.personIcon} />
            <input
              type="text"
              placeholder="Filter by director or actor..."
              value={personQuery}
              onChange={(e) => handlePersonSearch(e.target.value)}
              className={styles.personInput}
            />
            {personLoading && <span className={styles.personSpinner}>⏳</span>}
          </div>

          {selectedPerson && (
            <div className={styles.selectedPerson}>
              {selectedPerson.profile_path && (
                <Image
                  src={tmdbImage(selectedPerson.profile_path, 'w45')}
                  alt={selectedPerson.name}
                  width={28}
                  height={28}
                  className={styles.selectedPersonImg}
                />
              )}
              <span>{selectedPerson.name}</span>
              <span className={styles.personDept}>{selectedPerson.known_for_department}</span>
              <button onClick={clearPersonFilter} className={styles.personClearBtn}>
                <HiXMark size={14} />
              </button>
            </div>
          )}

          {showPersonDropdown && personResults.length > 0 && (
            <div className={styles.personDropdown}>
              {personResults.map((p) => (
                <button
                  key={p.id}
                  className={styles.personOption}
                  onClick={() => handleSelectPerson(p)}
                >
                  {p.profile_path ? (
                    <Image
                      src={tmdbImage(p.profile_path, 'w45')}
                      alt={p.name}
                      width={36}
                      height={36}
                      className={styles.personOptionImg}
                    />
                  ) : (
                    <div className={styles.personOptionPlaceholder}><HiUser size={16} /></div>
                  )}
                  <div className={styles.personOptionInfo}>
                    <span className={styles.personOptionName}>{p.name}</span>
                    <span className={styles.personOptionDept}>{p.known_for_department}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {(hasQuery || selectedPerson) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h2 className={styles.resultTitle}>
              {isLoading ? 'Searching...' : selectedPerson
                ? `${displayResults.length} title${displayResults.length !== 1 ? 's' : ''} with ${selectedPerson.name}`
                : `${displayResults.length} result${displayResults.length !== 1 ? 's' : ''} for "${query}"`
              }
            </h2>

            {displayResults.length > 0 ? (
              <div className={styles.grid}>
                {visibleResults.map((item, i) => (
                  <motion.div
                    key={`${item.media_type}-${item.id}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <MediaCard item={item} />
                  </motion.div>
                ))}
              </div>
            ) : !isLoading ? (
              <div className={styles.noResults}>
                <span className={styles.noResultsIcon}></span>
                <p>No results found. Try a different search term.</p>
              </div>
            ) : null}
            {hasMoreResults && (
              <ShowMoreButton shown={shownResults} total={totalResults} step={24} onClick={showMoreResults} />
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
