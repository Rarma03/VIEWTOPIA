'use client';

import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  HiRectangleStack, HiArrowLeft, HiPlus, HiTrash, HiShare,
  HiMagnifyingGlass, HiXMark, HiPencilSquare, HiCheck, HiSparkles,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import {
  getCollections, createCollection, updateCollection, deleteCollection,
  addToCollection, removeFromCollection, isPremiumUser,
} from '@/lib/store';
import { searchMulti, tmdbImage } from '@/lib/tmdb';
import { encodeCollection, getShareUrl } from '@/lib/share';
import type { Collection, MediaItem, MediaType } from '@/types';
import Loader from '@/components/common/Loader';
import ShowMoreButton from '@/components/common/ShowMoreButton';
import { useShowMore } from '@/lib/useShowMore';
import styles from './collections.module.css';

interface SearchHit {
  media_id: number;
  media_type: MediaType;
  title: string;
  poster_path: string | null;
}

export default function CollectionsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const [premium, setPremium] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [editingMeta, setEditingMeta] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Premium check
  useEffect(() => {
    if (!user) { setPremium(false); return; }
    let cancelled = false;
    void isPremiumUser(user.id).then((v) => { if (!cancelled) setPremium(v); });
    return () => { cancelled = true; };
  }, [user]);

  // Load collections
  const reloadCollections = async () => {
    if (!user) { setCollections([]); setLoading(false); return; }
    setLoading(true);
    const list = await getCollections(user.id);
    setCollections(list);
    setLoading(false);
    if (!activeId && list.length > 0) setActiveId(list[0].id);
  };

  useEffect(() => {
    if (premium) void reloadCollections();
    else if (premium === false) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium, user?.id]);

  const active = useMemo(
    () => collections.find((c) => c.id === activeId) || null,
    [collections, activeId],
  );

  const activeItems = active?.items ?? [];
  const { visible: visibleItems, shown: shownItems, total: totalItems, hasMore: hasMoreItems, showMore: showMoreItems } = useShowMore(activeItems, 24);

  // Search (debounced)
  useEffect(() => {
    if (!searchQ.trim() || !active) { setSearchResults([]); return; }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchMulti(searchQ.trim());
        if (cancelled) return;
        const hits: SearchHit[] = (res.results || [])
          .filter((r: MediaItem) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 10)
          .map((r: MediaItem) => ({
            media_id: r.id,
            media_type: r.media_type as MediaType,
            title: r.title || (r as unknown as { name?: string }).name || 'Untitled',
            poster_path: r.poster_path,
          }));
        setSearchResults(hits);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [searchQ, active]);

  // Handlers
  const handleCreate = async () => {
    if (!user) return;
    const name = window.prompt('Name your collection', 'New Collection');
    if (!name) return;
    const created = await createCollection({ user_id: user.id, name });
    if (!created) { toast.error('Could not create collection'); return; }
    toast.success('Collection created');
    setCollections((prev) => [created, ...prev]);
    setActiveId(created.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this collection? This cannot be undone.')) return;
    const ok = await deleteCollection(id);
    if (!ok) { toast.error('Delete failed'); return; }
    toast.success('Deleted');
    setCollections((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const startEditMeta = () => {
    if (!active) return;
    setDraftName(active.name);
    setDraftDesc(active.description || '');
    setEditingMeta(true);
  };

  const saveMeta = async () => {
    if (!active) return;
    const ok = await updateCollection(active.id, { name: draftName, description: draftDesc || null });
    if (!ok) { toast.error('Save failed'); return; }
    setCollections((prev) => prev.map((c) =>
      c.id === active.id ? { ...c, name: draftName || 'Untitled', description: draftDesc || null } : c,
    ));
    setEditingMeta(false);
    toast.success('Saved');
  };

  const handleAdd = async (hit: SearchHit) => {
    if (!active) return;
    if (active.items.some((i) => i.media_id === hit.media_id && i.media_type === hit.media_type)) {
      toast('Already in this collection');
      return;
    }
    const ok = await addToCollection(active.id, hit);
    if (!ok) { toast.error('Could not add'); return; }
    setCollections((prev) => prev.map((c) =>
      c.id === active.id
        ? { ...c, items: [...c.items, { ...hit, added_at: new Date().toISOString() }] }
        : c,
    ));
    toast.success(`Added ${hit.title}`);
  };

  const handleRemove = async (mediaId: number, mediaType: MediaType) => {
    if (!active) return;
    const ok = await removeFromCollection(active.id, mediaId, mediaType);
    if (!ok) { toast.error('Could not remove'); return; }
    setCollections((prev) => prev.map((c) =>
      c.id === active.id
        ? { ...c, items: c.items.filter((i) => !(i.media_id === mediaId && i.media_type === mediaType)) }
        : c,
    ));
  };

  const handleShare = async (collection: Collection) => {
    const encoded = encodeCollection(user?.display_name || 'A user', collection);
    const url = getShareUrl(encoded);
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied!');
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  // ─── Render ───
  if (!user) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <h1 className={styles.title}>Collections</h1>
          <p className={styles.subtitle}>Please log in to create collections.</p>
          <Link href="/login" className={styles.createBtn} style={{ marginTop: 16 }}>Log in</Link>
        </div>
      </div>
    );
  }

  if (premium === null || loading) {
    return <Loader />;
  }

  if (!premium) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container} style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <HiSparkles size={64} style={{ opacity: 0.7, marginBottom: '1rem', color: '#f5c518' }} />
            <h1 className={styles.title}>Collections are a premium feature</h1>
            <p className={styles.subtitle} style={{ maxWidth: 540, margin: '0.75rem auto 2rem' }}>
              Curate themed lists of movies and shows, then share them with anyone via a link.
              Upgrade to premium to start building.
            </p>
            <Link href="/premium" className={styles.createBtn} style={{ display: 'inline-flex' }}>
              <HiSparkles size={16} /> Upgrade to Premium
            </Link>
            <div style={{ marginTop: 24 }}>
              <Link href="/" style={{ opacity: 0.7, fontSize: '0.9rem' }}>
                <HiArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Back home
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <HiRectangleStack size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
              My Collections
            </h1>
            <p className={styles.subtitle}>Curate and share themed lists.</p>
          </div>
        </div>

        <div className={styles.topBar}>
          <button className={styles.createBtn} onClick={handleCreate}>
            <HiPlus size={16} /> New Collection
          </button>
        </div>

        <div className={styles.layout}>
          {/* Sidebar */}
          <aside className={styles.sidebar}>
            {collections.length === 0 ? (
              <p className={styles.emptyList}>No collections yet. Create one to get started.</p>
            ) : (
              collections.map((c) => (
                <div
                  key={c.id}
                  className={`${styles.colCard} ${c.id === activeId ? styles.colCardActive : ''}`}
                  onClick={() => { setActiveId(c.id); setEditingMeta(false); }}
                >
                  <div className={styles.colInfo}>
                    <div className={styles.colName}>{c.name}</div>
                    <div className={styles.colCount}>{c.items.length} item{c.items.length === 1 ? '' : 's'}</div>
                  </div>
                  <div className={styles.colActions}>
                    <button
                      className={styles.iconBtn}
                      onClick={(e) => { e.stopPropagation(); void handleShare(c); }}
                      title="Share"
                      aria-label="Share collection"
                    >
                      <HiShare size={15} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={(e) => { e.stopPropagation(); void handleDelete(c.id); }}
                      title="Delete"
                      aria-label="Delete collection"
                    >
                      <HiTrash size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </aside>

          {/* Main */}
          <main className={styles.main}>
            {!active ? (
              <div className={styles.emptyMain}>
                <HiRectangleStack size={48} style={{ opacity: 0.4, marginBottom: 12 }} />
                <p>Select a collection or create a new one.</p>
              </div>
            ) : (
              <div className={styles.detail}>
                <div className={styles.detailHeader}>
                  {editingMeta ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <input
                        className={styles.searchInput}
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        placeholder="Name"
                        maxLength={100}
                      />
                      <input
                        className={styles.searchInput}
                        value={draftDesc}
                        onChange={(e) => setDraftDesc(e.target.value)}
                        placeholder="Description (optional)"
                        maxLength={500}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.createBtn} onClick={() => void saveMeta()}>
                          <HiCheck size={14} /> Save
                        </button>
                        <button className={styles.iconBtn} onClick={() => setEditingMeta(false)}>
                          <HiXMark size={14} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <h2 className={styles.detailTitle}>{active.name}</h2>
                        {active.description && <p className={styles.detailDesc}>{active.description}</p>}
                        <p className={styles.detailCount}>{active.items.length} item{active.items.length === 1 ? '' : 's'}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className={styles.iconBtn} onClick={startEditMeta} title="Edit details">
                          <HiPencilSquare size={15} />
                        </button>
                        <button className={styles.shareBtn} onClick={() => void handleShare(active)}>
                          <HiShare size={15} /> Share
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Search + add */}
                <div className={styles.searchSection}>
                  <div className={styles.searchBar}>
                    <HiMagnifyingGlass size={16} />
                    <input
                      className={styles.searchInput}
                      placeholder="Search movies and shows to add…"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                    />
                    {searchQ && (
                      <button className={styles.clearBtn} onClick={() => setSearchQ('')} aria-label="Clear">
                        <HiXMark size={14} />
                      </button>
                    )}
                  </div>
                  {searching && <p className={styles.detailCount} style={{ marginTop: 8 }}>Searching…</p>}
                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map((hit) => {
                        const already = active.items.some((i) =>
                          i.media_id === hit.media_id && i.media_type === hit.media_type);
                        return (
                          <div key={`${hit.media_type}-${hit.media_id}`} className={styles.searchItem}>
                            {hit.poster_path ? (
                              <Image
                                src={tmdbImage(hit.poster_path, 'w92')}
                                alt={hit.title}
                                width={36}
                                height={54}
                                className={styles.searchPoster}
                              />
                            ) : (
                              <div className={styles.searchNoPoster}>{hit.title.charAt(0)}</div>
                            )}
                            <div className={styles.searchInfo}>
                              <div className={styles.searchName}>{hit.title}</div>
                              <div className={styles.searchMeta}>{hit.media_type.toUpperCase()}</div>
                            </div>
                            <button
                              className={`${styles.addBtn} ${already ? styles.addBtnDisabled : ''}`}
                              onClick={() => void handleAdd(hit)}
                              disabled={already}
                            >
                              {already ? <HiCheck size={14} /> : <HiPlus size={14} />}
                              {already ? 'Added' : 'Add'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Items */}
                {active.items.length === 0 ? (
                  <div className={styles.emptyDetail}>
                    <p>No items yet — search above to add some.</p>
                  </div>
                ) : (
                  <>
                  <div className={styles.itemGrid}>
                    {visibleItems.map((item) => {
                      const href = item.media_type === 'anime'
                        ? `/anime/${item.media_id}`
                        : item.media_type === 'tv'
                          ? `/tv/${item.media_id}`
                          : `/movies/${item.media_id}`;
                      return (
                        <div key={`${item.media_type}-${item.media_id}`} className={styles.itemCard}>
                          <Link href={href}>
                            {item.poster_path ? (
                              <Image
                                src={tmdbImage(item.poster_path, 'w342')}
                                alt={item.title}
                                width={150}
                                height={225}
                                className={styles.itemPoster}
                              />
                            ) : (
                              <div className={styles.itemNoPoster}>{item.title.charAt(0)}</div>
                            )}
                          </Link>
                          <div className={styles.itemInfo}>
                            <Link href={href} className={styles.itemTitle}>{item.title}</Link>
                            <span className={styles.itemType}>{item.media_type.toUpperCase()}</span>
                          </div>
                          <button
                            className={styles.removeBtn}
                            onClick={() => void handleRemove(item.media_id, item.media_type)}
                            aria-label="Remove"
                          >
                            <HiTrash size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {hasMoreItems && (
                    <ShowMoreButton shown={shownItems} total={totalItems} step={24} onClick={showMoreItems} />
                  )}
                  </>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
