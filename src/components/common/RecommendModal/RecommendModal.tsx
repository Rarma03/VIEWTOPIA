'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HiHeart, HiXMark, HiUserGroup, HiGlobeAlt } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { addRecommendation } from '@/lib/store';
import { RecommendationVisibility, RecommendableMediaType } from '@/types';
import toast from 'react-hot-toast';
import styles from './RecommendModal.module.css';

interface RecommendModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaTitle: string;
  mediaId: number;
  /** Movie / TV / anime use TMDB poster paths; manga uses a full Jikan URL. */
  mediaType: RecommendableMediaType;
  posterPath: string | null;
}

export default function RecommendModal({ isOpen, onClose, mediaTitle, mediaId, mediaType, posterPath }: RecommendModalProps) {
  const { user, isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const [message, setMessage] = useState('');
  const [visibility, setVisibility] = useState<RecommendationVisibility>('everyone');

  const handleSubmit = async () => {
    if (!isAuthenticated || !user) {
      toast.error('Login to recommend!');
      return;
    }
    const result = await addRecommendation({
      user_id: user.id,
      media_id: mediaId,
      media_type: mediaType,
      title: mediaTitle,
      poster_path: posterPath,
      message: message || null,
      visibility,
    });
    if (!result) {
      toast.error('Could not save recommendation. Please try again.');
      return;
    }
    toast.success(
      visibility === 'everyone'
        ? `Recommended "${mediaTitle}" to everyone!`
        : `Recommended "${mediaTitle}" to friends only!`
    );
    setMessage('');
    setVisibility('everyone');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`${styles.modal} ${isDark ? styles.dark : styles.light}`}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className={styles.closeBtn} onClick={onClose}>
              <HiXMark size={20} />
            </button>
            <div className={styles.header}>
              <HiHeart size={24} className={styles.heartIcon} />
              <h3>Recommend to Friends</h3>
            </div>
            <p className={styles.mediaName}>{mediaTitle}</p>
            <div className={styles.userInfo}>
              <div className={styles.avatar}>
                {user?.display_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span>{user?.display_name || 'You'}</span>
            </div>
            <textarea
              className={styles.messageInput}
              placeholder="Why should your friends watch this? (optional)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={280}
            />
            <div className={styles.charCount}>{message.length}/280</div>
            <div className={styles.visibilitySection}>
              <span className={styles.visibilityLabel}>Who can see this?</span>
              <div className={styles.visibilityToggle}>
                <button
                  className={`${styles.visibilityBtn} ${visibility === 'everyone' ? styles.visibilityActive : ''}`}
                  onClick={() => setVisibility('everyone')}
                  type="button"
                >
                  <HiGlobeAlt size={15} /> Everyone
                </button>
                <button
                  className={`${styles.visibilityBtn} ${visibility === 'friends' ? styles.visibilityActive : ''}`}
                  onClick={() => setVisibility('friends')}
                  type="button"
                >
                  <HiUserGroup size={15} /> Friends Only
                </button>
              </div>
            </div>
            <button className={styles.submitBtn} onClick={handleSubmit}>
              <HiHeart size={16} />
              Recommend
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
