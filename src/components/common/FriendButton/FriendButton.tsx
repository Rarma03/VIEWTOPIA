'use client';

import { useEffect, useState } from 'react';
import { HiUserPlus, HiCheck, HiXMark, HiClock, HiUserMinus } from 'react-icons/hi2';
import toast from 'react-hot-toast';
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from '@/lib/store';
import { useAuth } from '@/context/AuthContext';
import styles from './FriendButton.module.css';

interface FriendButtonProps {
  /** The user the button targets (NOT the current user). */
  targetUserId: string;
  /** Optional: render compact (icon-only) variant for dense lists. */
  compact?: boolean;
  /** Optional: notify parent on state change so it can refresh counters. */
  onChange?: () => void;
}

type State =
  | { kind: 'self' }
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'outgoing'; requestId: string }
  | { kind: 'incoming'; requestId: string }
  | { kind: 'friends' };

/**
 * Self-contained Add Friend / Pending / Accept / Friends pill button.
 * Handles all state transitions with optimistic UI + Supabase calls.
 */
export default function FriendButton({ targetUserId, compact, onChange }: FriendButtonProps) {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user || !targetUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'none' });
      return;
    }
    if (user.id === targetUserId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ kind: 'self' });
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: 'loading' });
    void getFriendshipStatus(user.id, targetUserId).then((res) => {
      if (cancelled) return;
      if (res.status === 'accepted') setState({ kind: 'friends' });
      else if (res.status === 'pending' && res.direction === 'outgoing' && res.requestId) {
        setState({ kind: 'outgoing', requestId: res.requestId });
      } else if (res.status === 'pending' && res.direction === 'incoming' && res.requestId) {
        setState({ kind: 'incoming', requestId: res.requestId });
      } else {
        setState({ kind: 'none' });
      }
    });
    return () => { cancelled = true; };
  }, [user, targetUserId]);

  const guard = (fn: () => Promise<void>) => async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (busy) return;
    setBusy(true);
    try { await fn(); onChange?.(); } finally { setBusy(false); }
  };

  if (state.kind === 'self' || state.kind === 'loading') return null;
  if (!user) return null;

  if (state.kind === 'none') {
    return (
      <button
        type="button"
        className={`${styles.btn} ${styles.add} ${compact ? styles.compact : ''}`}
        disabled={busy}
        onClick={guard(async () => {
          const res = await sendFriendRequest(user.id, targetUserId);
          if (res) {
            setState({ kind: 'outgoing', requestId: res.id });
            toast.success('Friend request sent');
          } else {
            toast.error('Could not send request');
          }
        })}
      >
        <HiUserPlus size={14} />
        {!compact && <span>Add Friend</span>}
      </button>
    );
  }

  if (state.kind === 'outgoing') {
    return (
      <button
        type="button"
        className={`${styles.btn} ${styles.pending} ${compact ? styles.compact : ''}`}
        disabled={busy}
        title="Cancel request"
        onClick={guard(async () => {
          const ok = await removeFriend(user.id, targetUserId);
          if (ok) { setState({ kind: 'none' }); toast.success('Request canceled'); }
          else toast.error('Could not cancel');
        })}
      >
        <HiClock size={14} />
        {!compact && <span>Pending</span>}
      </button>
    );
  }

  if (state.kind === 'incoming') {
    return (
      <span className={styles.actionGroup}>
        <button
          type="button"
          className={`${styles.btn} ${styles.accept} ${compact ? styles.compact : ''}`}
          disabled={busy}
          title="Accept request"
          onClick={guard(async () => {
            const ok = await acceptFriendRequest(state.requestId);
            if (ok) { setState({ kind: 'friends' }); toast.success('You are now friends'); }
            else toast.error('Could not accept');
          })}
        >
          <HiCheck size={14} />
          {!compact && <span>Accept</span>}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.reject} ${compact ? styles.compact : ''}`}
          disabled={busy}
          title="Reject request"
          onClick={guard(async () => {
            const ok = await rejectFriendRequest(state.requestId);
            if (ok) { setState({ kind: 'none' }); toast.success('Request rejected'); }
            else toast.error('Could not reject');
          })}
        >
          <HiXMark size={14} />
        </button>
      </span>
    );
  }

  // friends
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.friends} ${compact ? styles.compact : ''}`}
      disabled={busy}
      title="Remove friend"
      onClick={guard(async () => {
        if (!window.confirm('Remove this friend?')) return;
        const ok = await removeFriend(user.id, targetUserId);
        if (ok) { setState({ kind: 'none' }); toast.success('Friend removed'); }
        else toast.error('Could not remove');
      })}
      onMouseEnter={(e) => { e.currentTarget.dataset.hover = '1'; }}
      onMouseLeave={(e) => { delete e.currentTarget.dataset.hover; }}
    >
      <HiUserMinus size={14} className={styles.hoverIcon} />
      <HiCheck size={14} className={styles.idleIcon} />
      {!compact && <span>Friends</span>}
    </button>
  );
}
