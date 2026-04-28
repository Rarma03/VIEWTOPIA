'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { HiMapPin, HiCalendarDays, HiClock, HiUserGroup, HiPaperAirplane, HiTrash, HiArrowLeft, HiFilm, HiArrowTopRightOnSquare } from 'react-icons/hi2';
import { getWatchParty, joinWatchParty, leaveWatchParty, deleteWatchParty, getProfilesByIds, PublicProfile } from '@/lib/store';
import { sendChatMessage, fetchChatMessages, isChatLive } from '@/lib/chat';
import { tmdbImage } from '@/lib/tmdb';
import { WatchParty, WatchPartyMessage } from '@/types';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import styles from './partyDetail.module.css';

const CHAT_CHANNEL = 'viewtopia_party_chat';
const POLL_INTERVAL = isChatLive ? 15000 : 3000; // 15s for Supabase, 3s for local

export default function WatchPartyDetailPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const CURRENT_USER = user?.id || '';
  const params = useParams();
  const router = useRouter();
  const partyId = params.id as string;
  const [party, setParty] = useState<WatchParty | null>(null);
  const [chatMessages, setChatMessages] = useState<WatchPartyMessage[]>([]);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, PublicProfile>>({});
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshParty = useCallback(async () => {
    const p = await getWatchParty(partyId);
    setParty(p);
    if (p) {
      const ids = Array.from(new Set([p.creator_id, ...p.members]));
      const profiles = await getProfilesByIds(ids);
      setMemberProfiles(profiles);
    }
  }, [partyId]);

  const refreshMessages = useCallback(async () => {
    const msgs = await fetchChatMessages(partyId);
    setChatMessages(msgs);
    const senderIds = Array.from(new Set(msgs.map((m) => m.user_id)));
    if (senderIds.length > 0) {
      const profiles = await getProfilesByIds(senderIds);
      setMemberProfiles((prev) => ({ ...prev, ...profiles }));
    }
  }, [partyId]);

  useEffect(() => { void refreshParty(); void refreshMessages(); }, [refreshParty, refreshMessages]);

  // Live sync: BroadcastChannel + storage event + polling
  useEffect(() => {
    // 1. BroadcastChannel for instant same-browser sync
    try {
      const channel = new BroadcastChannel(CHAT_CHANNEL);
      channel.onmessage = (e) => {
        if (e.data?.partyId === partyId) {
          refreshMessages();
        }
      };
      channelRef.current = channel;
    } catch {
      // Not supported — rely on storage + polling
    }

    // 2. Storage event — fires when another tab writes to localStorage (local mode)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'viewtopia_watch_parties') {
        refreshParty();
        refreshMessages();
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Polling — 15s for Supabase (cross-device), 3s for local (same browser)
    pollRef.current = setInterval(() => {
      refreshMessages();
    }, POLL_INTERVAL);

    return () => {
      channelRef.current?.close();
      window.removeEventListener('storage', handleStorage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [partyId, refreshParty, refreshMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  if (!party) {
    return (
      <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
        <div className={styles.container}>
          <div className={styles.notFound}>
            <p>Party not found or has expired.</p>
            <button className={styles.backBtn} onClick={() => router.push('/watch-parties')}>
              <HiArrowLeft /> Back to Parties
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isMember = party.members.includes(CURRENT_USER);
  const isCreator = party.creator_id === CURRENT_USER;

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    if (!isMember) { toast.error('Join the party to send messages'); return; }
    setSending(true);
    const senderName = user?.display_name || user?.username || 'Anonymous';
    await sendChatMessage(party.id, CURRENT_USER, message.trim(), senderName);
    setMessage('');
    await refreshMessages();
    setSending(false);
    // Broadcast to other same-browser tabs
    try {
      channelRef.current?.postMessage({ partyId: party.id, type: 'message' });
    } catch { /* ignore */ }
  };

  const handleJoin = async () => {
    const ok = await joinWatchParty(party.id, CURRENT_USER);
    if (ok) { toast.success('Joined!'); void refreshParty(); }
    else toast.error('Party is full');
  };

  const handleLeave = async () => {
    await leaveWatchParty(party.id, CURRENT_USER);
    toast.success('Left the party');
    if (isCreator) router.push('/watch-parties');
    else void refreshParty();
  };

  const handleDelete = async () => {
    await deleteWatchParty(party.id);
    toast.success('Party deleted');
    router.push('/watch-parties');
  };

  const getUserName = (userId: string) => {
    if (userId === CURRENT_USER && user) return user.display_name || user.username || 'You';
    const p = memberProfiles[userId];
    return p?.display_name || p?.username || 'User';
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const daysUntil = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today!';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <button className={styles.backBtn} onClick={() => router.push('/watch-parties')}>
          <HiArrowLeft /> All Parties
        </button>

        {/* Party Info */}
        <motion.div className={styles.infoCard} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className={styles.infoLeft}>
            {party.poster_path ? (
              <Image
                src={tmdbImage(party.poster_path, 'w185')}
                alt={party.movie_title}
                width={120}
                height={180}
                className={styles.poster}
              />
            ) : (
              <div className={styles.noPoster}><HiFilm size={40} /></div>
            )}
          </div>
          <div className={styles.infoRight}>
            <h1 className={styles.movieTitle}>{party.movie_title}</h1>
            <div className={styles.countdown}>{daysUntil(party.date)}</div>
            <div className={styles.details}>
              <span><HiMapPin /> {party.city}</span>
              {party.theater && (
                <a
                  href={getMapsUrl(party.theater)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.mapLink}
                >
                  <HiArrowTopRightOnSquare size={14} /> Open in Google Maps
                </a>
              )}
              <span><HiCalendarDays /> {formatDate(party.date)}</span>
              {party.time && <span><HiClock /> {party.time}</span>}
              <span><HiUserGroup /> {party.members.length}/{party.max_members} members</span>
            </div>

            {/* Members */}
            <div className={styles.memberList}>
              {party.members.map((uid) => (
                <span key={uid} className={`${styles.member} ${uid === party.creator_id ? styles.creator : ''}`}>
                  {getUserName(uid)} {uid === party.creator_id ? '(host)' : ''}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              {!isMember && (
                <button className={styles.joinBtn} onClick={handleJoin} disabled={party.members.length >= party.max_members}>
                  {party.members.length >= party.max_members ? 'Full' : 'Join Party'}
                </button>
              )}
              {isMember && !isCreator && (
                <button className={styles.leaveBtn} onClick={handleLeave}>Leave Party</button>
              )}
              {isCreator && (
                <button className={styles.deleteBtn} onClick={handleDelete}><HiTrash /> Delete Party</button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Messages */}
        <motion.div className={styles.chatSection} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className={styles.chatHeader}>
            <h2 className={styles.chatTitle}>Party Chat</h2>
            <span className={styles.liveIndicator}>
              <span className={styles.liveDot} />
              {isChatLive ? 'Live' : 'Local'}
            </span>
          </div>
          <p className={styles.chatNote}>
            {isChatLive
              ? 'Messages sync live across all devices — anyone in the party can see them!'
              : 'Demo mode — messages sync across browser tabs. Deploy with Supabase for cross-device chat.'}
          </p>

          <div className={styles.messages}>
            {chatMessages.length === 0 ? (
              <div className={styles.noMessages}>
                {isMember ? 'No messages yet. Say hi!' : 'Join the party to chat'}
              </div>
            ) : (
              chatMessages.map((msg) => {
                const isOwn = msg.user_id === CURRENT_USER;
                return (
                  <div key={msg.id} className={`${styles.msg} ${isOwn ? styles.msgOwn : ''}`}>
                    <div className={styles.msgHeader}>
                      <span className={styles.msgAuthor}>{getUserName(msg.user_id)}</span>
                      <span className={styles.msgTime}>{formatTime(msg.created_at)}</span>
                    </div>
                    <p className={styles.msgText}>{msg.text}</p>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {isMember && (
            <div className={styles.inputRow}>
              <input
                className={styles.chatInput}
                placeholder="Type a message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                maxLength={500}
                disabled={sending}
              />
              <button className={styles.sendBtn} onClick={handleSend} disabled={!message.trim() || sending}>
                <HiPaperAirplane />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
