'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { HiUserGroup, HiCheck, HiXMark } from 'react-icons/hi2';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getFriendRequests,
  getProfilesByIds,
  acceptFriendRequest,
  rejectFriendRequest,
  type PublicProfile,
} from '@/lib/store';
import { FriendRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import styles from './FriendRequestsBell.module.css';

/**
 * Navbar bell that shows pending incoming friend requests with quick
 * accept / reject actions. Polls every 60s.
 */
export default function FriendRequestsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!user) { setRequests([]); setProfiles({}); return; }
    const reqs = await getFriendRequests(user.id);
    setRequests(reqs);
    if (reqs.length) {
      const pmap = await getProfilesByIds(reqs.map((r) => r.from_user_id));
      setProfiles(pmap);
    } else {
      setProfiles({});
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    if (!user) return;
    const t = setInterval(() => { void refresh(); }, 60_000);
    return () => clearInterval(t);
  }, [user, refresh]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user) return null;

  const handleAccept = async (id: string) => {
    setBusy(id);
    const ok = await acceptFriendRequest(id);
    if (ok) { toast.success('Friend added'); setRequests((r) => r.filter((x) => x.id !== id)); }
    else toast.error('Could not accept');
    setBusy(null);
  };

  const handleReject = async (id: string) => {
    setBusy(id);
    const ok = await rejectFriendRequest(id);
    if (ok) { setRequests((r) => r.filter((x) => x.id !== id)); }
    else toast.error('Could not reject');
    setBusy(null);
  };

  const count = requests.length;

  // Auto-hide entirely when there are no pending requests — the bell
  // re-appears the next time the 60s poll picks one up.
  if (count === 0) return null;

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={() => setOpen((p) => !p)}
        aria-label={`Friend requests${count > 0 ? ` (${count} pending)` : ''}`}
      >
        <HiUserGroup size={20} />
        {count > 0 && <span className={styles.badge}>{count > 9 ? '9+' : count}</span>}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.dropdownHeader}>
              <span>Friend Requests</span>
              {count > 0 && <span className={styles.headerCount}>{count}</span>}
            </div>
            <div className={styles.dropdownDivider} />
            {requests.length === 0 ? (
              <div className={styles.empty}>No pending requests</div>
            ) : (
              <ul className={styles.list}>
                {requests.map((req) => {
                  const profile = profiles[req.from_user_id];
                  const name = profile?.display_name || profile?.username || 'User';
                  const initial = name.charAt(0).toUpperCase();
                  const href = profile?.username
                    ? `/u/${profile.username}`
                    : `/profile/${req.from_user_id}`;
                  const isBusy = busy === req.id;
                  return (
                    <li key={req.id} className={styles.row}>
                      <Link
                        href={href}
                        className={styles.rowLink}
                        onClick={() => setOpen(false)}
                      >
                        <div className={styles.avatar}>{initial}</div>
                        <div className={styles.nameBlock}>
                          <span className={styles.name}>{name}</span>
                          {profile?.username && (
                            <span className={styles.username}>@{profile.username}</span>
                          )}
                        </div>
                      </Link>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.acceptBtn}`}
                          disabled={isBusy}
                          onClick={() => void handleAccept(req.id)}
                          aria-label="Accept"
                        >
                          <HiCheck size={14} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.rejectBtn}`}
                          disabled={isBusy}
                          onClick={() => void handleReject(req.id)}
                          aria-label="Reject"
                        >
                          <HiXMark size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className={styles.dropdownDivider} />
            <Link
              href="/global?tab=users"
              className={styles.viewAll}
              onClick={() => setOpen(false)}
            >
              Browse users
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
