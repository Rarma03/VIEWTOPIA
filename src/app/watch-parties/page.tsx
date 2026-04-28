'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { HiPlus, HiMapPin, HiCalendarDays, HiClock, HiUserGroup, HiMagnifyingGlass, HiXMark, HiFilm, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import { getWatchParties, createWatchParty, joinWatchParty, leaveWatchParty, getUserParties, getProfilesByIds, PublicProfile } from '@/lib/store';
import { searchMovies, tmdbImage } from '@/lib/tmdb';
import { LocationAutocomplete } from '@/components/common/LocationAutocomplete';
import { WatchParty, MediaItem } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import Loader from '@/components/common/Loader';
import toast from 'react-hot-toast';
import styles from './watchParties.module.css';

export default function WatchPartiesPage() {
  return (
    <Suspense fallback={<Loader />}>
      <WatchPartiesContent />
    </Suspense>
  );
}

function WatchPartiesContent() {
  const { isDark } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const CURRENT_USER = user?.id || '';
  const router = useRouter();
  const searchParams = useSearchParams();
  const [parties, setParties] = useState<WatchParty[]>([]);
  const [myParties, setMyParties] = useState<WatchParty[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, PublicProfile>>({});
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [cityFilter, setCityFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [movieQuery, setMovieQuery] = useState('');
  const [movieResults, setMovieResults] = useState<MediaItem[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<{ id: number; title: string; poster_path: string | null } | null>(null);
  const [city, setCity] = useState('');
  const [theater, setTheater] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);
  const [searching, setSearching] = useState(false);

  // Auto-apply user's city as default filter
  useEffect(() => {
    if (user?.city) {
      setCityFilter(user.city);
      setCity(user.city);
    }
  }, [user?.city]);

  const refresh = useCallback(async () => {
    const [browse, mine] = await Promise.all([
      getWatchParties({ city: cityFilter || undefined }),
      CURRENT_USER ? getUserParties(CURRENT_USER) : Promise.resolve([] as WatchParty[]),
    ]);
    setParties(browse);
    setMyParties(mine);
    const memberIds = new Set<string>();
    for (const p of [...browse, ...mine]) {
      memberIds.add(p.creator_id);
      for (const m of p.members) memberIds.add(m);
    }
    if (memberIds.size > 0) {
      const profiles = await getProfilesByIds(Array.from(memberIds));
      setMemberProfiles(profiles);
    }
  }, [cityFilter, CURRENT_USER]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Auto-open create modal if coming from movie detail with query params
  useEffect(() => {
    const movieId = searchParams.get('movie');
    const title = searchParams.get('title');
    if (movieId && title) {
      const poster = searchParams.get('poster') || null;
      setSelectedMovie({ id: Number(movieId), title, poster_path: poster || null });
      setShowCreate(true);
    }
  }, [searchParams]);

  // Debounced auto-search for movies
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (selectedMovie) return;
    const query = movieQuery.trim();
    if (!query || query.length < 2) {
      setMovieResults([]);
      return;
    }

    setSearching(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchMovies(query);
        setMovieResults(res.results.slice(0, 6));
      } catch {
        toast.error('Search failed');
      }
      setSearching(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [movieQuery, selectedMovie]);

  const handleCreate = async () => {
    if (!isAuthenticated) {
      toast.error('Please log in to create a party');
      router.push('/login');
      return;
    }
    if (!selectedMovie) { toast.error('Select a movie first'); return; }
    if (!city.trim()) { toast.error('Enter a city'); return; }
    if (!date) { toast.error('Pick a date'); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (date < today) { toast.error('Date must be in the future'); return; }

    const created = await createWatchParty({
      movie_id: selectedMovie.id,
      movie_title: selectedMovie.title,
      poster_path: selectedMovie.poster_path,
      creator_id: CURRENT_USER,
      city: city.trim(),
      theater: theater.trim() || undefined,
      date,
      time: time || undefined,
      max_members: maxMembers,
    });

    if (!created) { toast.error('Could not create party. Please try again.'); return; }
    toast.success('Watch Party created!');
    setShowCreate(false);
    resetForm();
    void refresh();
  };

  const resetForm = () => {
    setMovieQuery('');
    setMovieResults([]);
    setSelectedMovie(null);
    setCity('');
    setTheater('');
    setDate('');
    setTime('');
    setMaxMembers(10);
  };

  const handleJoin = async (partyId: string) => {
    if (!isAuthenticated) {
      toast.error('Please log in to join a party');
      router.push('/login');
      return;
    }
    const ok = await joinWatchParty(partyId, CURRENT_USER);
    if (ok) {
      toast.success('Joined the party!');
      void refresh();
    } else {
      toast.error('Party is full');
    }
  };

  const handleLeave = async (partyId: string) => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    await leaveWatchParty(partyId, CURRENT_USER);
    toast.success('Left the party');
    void refresh();
  };

  const getUserName = (userId: string) => {
    if (userId === CURRENT_USER && user) return user.display_name || user.username || 'You';
    const p = memberProfiles[userId];
    return p?.display_name || p?.username || 'User';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  const getMapsUrl = (location: string) => {
    try {
      const url = new URL(location);
      const safeHosts = ['google.com', 'google.co', 'goo.gl', 'maps.app.goo.gl', 'maps.google.com'];
      if ((url.protocol === 'https:' || url.protocol === 'http:') &&
          safeHosts.some((h) => url.hostname === h || url.hostname.endsWith('.' + h))) {
        return location;
      }
    } catch { /* not a URL — fall through to maps search */ }
    return `https://www.google.com/maps/search/${encodeURIComponent(location)}`;
  };

  const displayParties = tab === 'mine' ? myParties : parties;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        {/* Header */}
        <motion.div className={styles.header} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className={styles.title}>
            <HiUserGroup /> Watch Parties
          </h1>
          <p className={styles.subtitle}>Find people to watch movies with in your city</p>
        </motion.div>

        {/* Tabs + Actions */}
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button className={`${styles.tab} ${tab === 'browse' ? styles.activeTab : ''}`} onClick={() => setTab('browse')}>
              Browse All
            </button>
            <button className={`${styles.tab} ${tab === 'mine' ? styles.activeTab : ''}`} onClick={() => setTab('mine')}>
              My Parties {myParties.length > 0 && <span className={styles.badge}>{myParties.length}</span>}
            </button>
          </div>

          <div className={styles.actions}>
            {tab === 'browse' && (
              <div className={styles.citySearch}>
                <HiMapPin />
                <LocationAutocomplete
                  value={cityFilter}
                  onChange={setCityFilter}
                  placeholder="Filter by city..."
                />
              </div>
            )}
            <button className={styles.createBtn} onClick={() => {
              if (!isAuthenticated) { router.push('/login'); return; }
              setShowCreate(true);
            }}>
              <HiPlus /> Create Party
            </button>
          </div>
        </div>

        {/* Party List */}
        <div className={styles.grid}>
          <AnimatePresence mode="popLayout">
            {displayParties.length === 0 ? (
              <motion.div className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <HiFilm size={48} />
                <p>{tab === 'mine' ? 'You haven\'t joined any parties yet' : 'No watch parties found. Be the first to create one!'}</p>
              </motion.div>
            ) : (
              displayParties.map((party) => {
                const isMember = party.members.includes(CURRENT_USER);
                const isCreator = party.creator_id === CURRENT_USER;
                const isFull = party.members.length >= party.max_members;

                return (
                  <motion.div
                    key={party.id}
                    className={styles.card}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    layout
                  >
                    <div className={styles.cardPoster}>
                      {party.poster_path ? (
                        <Image
                          src={tmdbImage(party.poster_path, 'w185')}
                          alt={party.movie_title}
                          width={100}
                          height={150}
                          className={styles.posterImg}
                        />
                      ) : (
                        <div className={styles.noPoster}><HiFilm size={32} /></div>
                      )}
                    </div>

                    <div className={styles.cardBody}>
                      <h3 className={styles.cardTitle}>{party.movie_title}</h3>
                      <div className={styles.cardMeta}>
                        <span className={styles.metaItem}>
                          <HiMapPin /> {party.city}
                          {party.theater && (
                            <a
                              href={getMapsUrl(party.theater)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.mapLink}
                              onClick={(e) => e.stopPropagation()}
                              title="Open in Google Maps"
                            >
                              <HiArrowTopRightOnSquare size={12} /> View on Maps
                            </a>
                          )}
                        </span>
                        <span className={styles.metaItem}><HiCalendarDays /> {formatDate(party.date)} <span className={styles.countdown}>({daysUntil(party.date)})</span></span>
                        {party.time && <span className={styles.metaItem}><HiClock /> {party.time}</span>}
                        <span className={styles.metaItem}>
                          <HiUserGroup /> {party.members.length}/{party.max_members} going
                        </span>
                      </div>

                      <div className={styles.cardMembers}>
                        {party.members.slice(0, 5).map((uid) => (
                          <span key={uid} className={styles.memberChip}>{getUserName(uid)}</span>
                        ))}
                        {party.members.length > 5 && <span className={styles.memberChip}>+{party.members.length - 5}</span>}
                      </div>

                      <div className={styles.cardFooter}>
                        <span className={styles.createdBy}>by {getUserName(party.creator_id)}</span>
                        <div className={styles.cardActions}>
                          {isMember ? (
                            <>
                              <Link href={`/watch-parties/${party.id}`} className={styles.viewBtn}>View Party</Link>
                              {!isCreator && (
                                <button className={styles.leaveBtn} onClick={() => handleLeave(party.id)}>Leave</button>
                              )}
                            </>
                          ) : (
                            <button
                              className={styles.joinBtn}
                              onClick={() => handleJoin(party.id)}
                              disabled={isFull}
                            >
                              {isFull ? 'Full' : 'Join'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className={styles.overlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowCreate(false); resetForm(); }}
          >
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Create Watch Party</h2>
                <button className={styles.closeBtn} onClick={() => { setShowCreate(false); resetForm(); }}>
                  <HiXMark size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Movie Search */}
                <label className={styles.label}>Movie</label>
                {selectedMovie ? (
                  <div className={styles.selectedMovie}>
                    {selectedMovie.poster_path && (
                      <Image src={tmdbImage(selectedMovie.poster_path, 'w92')} alt="" width={40} height={60} className={styles.miniPoster} />
                    )}
                    <span>{selectedMovie.title}</span>
                    <button className={styles.clearMovie} onClick={() => setSelectedMovie(null)}><HiXMark /></button>
                  </div>
                ) : (
                  <>
                    <div className={styles.searchRow}>
                      <input
                        placeholder="Search for a movie..."
                        value={movieQuery}
                        onChange={(e) => setMovieQuery(e.target.value)}
                        className={styles.input}
                        autoComplete="off"
                      />
                      <span className={styles.searchIcon}>
                        {searching ? <span className={styles.spinner} /> : <HiMagnifyingGlass />}
                      </span>
                    </div>
                    {movieResults.length > 0 && (
                      <div className={styles.movieResults}>
                        {movieResults.map((m) => (
                          <button
                            key={m.id}
                            className={styles.movieOption}
                            onClick={() => {
                              setSelectedMovie({ id: m.id, title: m.title, poster_path: m.poster_path });
                              setMovieResults([]);
                              setMovieQuery('');
                            }}
                          >
                            {m.poster_path && (
                              <Image src={tmdbImage(m.poster_path, 'w92')} alt="" width={30} height={45} className={styles.miniPoster} />
                            )}
                            <span>{m.title} {m.release_date ? `(${m.release_date.slice(0, 4)})` : ''}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* City */}
                <label className={styles.label}>City</label>
                <LocationAutocomplete
                  value={city}
                  onChange={setCity}
                  placeholder="e.g. Mumbai, New York..."
                />

                {/* Theater (optional) */}
                <label className={styles.label}>Location <span className={styles.optional}>(optional)</span></label>
                <input
                  placeholder="Paste Google Maps link or theater name..."
                  value={theater}
                  onChange={(e) => setTheater(e.target.value)}
                  className={styles.input}
                  maxLength={200}
                />
                <span className={styles.inputHint}>Paste a Google Maps link for exact location, or type a place name</span>

                {/* Date & Time */}
                <div className={styles.dateRow}>
                  <div className={styles.field}>
                    <label className={styles.label}>Date</label>
                    <input
                      type="date"
                      value={date}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Time <span className={styles.optional}>(optional)</span></label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* Max Members */}
                <label className={styles.label}>Max Members</label>
                <select
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(parseInt(e.target.value))}
                  className={styles.input}
                >
                  {Array.from({ length: 19 }, (_, i) => i + 2).map((n) => (
                    <option key={n} value={n}>{n} people</option>
                  ))}
                </select>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.cancelBtn} onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</button>
                <button className={styles.submitBtn} onClick={handleCreate}>Create Party</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
