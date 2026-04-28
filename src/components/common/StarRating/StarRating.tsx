'use client';

import { useState, useRef } from 'react';
import { HiStar } from 'react-icons/hi2';
import { motion } from 'framer-motion';
import styles from './StarRating.module.css';

interface StarRatingProps {
  maxRating?: number;
  rating: number;
  onRate?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showValue?: boolean;
}

/**
 * Half-star rating via click cycling:
 *   - Click 1: full star (e.g. 8)
 *   - Click 2: half star (e.g. 8.5)
 *   - Click 3: removes that star back to previous
 * Hover always shows full-star preview.
 */
export default function StarRating({
  maxRating = 10,
  rating,
  onRate,
  size = 20,
  readonly = false,
  showValue = true,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const lastClickedStar = useRef<number | null>(null);
  const clickPhase = useRef(0); // 0=none, 1=full, 2=half

  const displayRating = hoverRating || rating;

  const handleClick = (star: number) => {
    if (readonly || !onRate) return;

    if (lastClickedStar.current === star) {
      clickPhase.current = (clickPhase.current + 1) % 3;
    } else {
      lastClickedStar.current = star;
      clickPhase.current = 1;
    }

    if (clickPhase.current === 0) {
      // third click — remove (set to star - 1, or 0)
      onRate(star - 1);
    } else if (clickPhase.current === 1) {
      // first click — full star
      onRate(star);
    } else {
      // second click — half star
      onRate(star - 0.5);
    }
  };

  // Determine star fill state
  const getStarState = (star: number): 'full' | 'half' | 'empty' => {
    const val = displayRating;
    if (star <= Math.floor(val)) return 'full';
    if (star === Math.ceil(val) && val % 1 !== 0) return 'half';
    return 'empty';
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.stars}>
        {Array.from({ length: maxRating }, (_, i) => i + 1).map((star) => {
          const state = getStarState(star);
          return (
            <motion.button
              key={star}
              type="button"
              className={`${styles.star} ${state === 'empty' ? styles.empty : ''} ${readonly ? styles.readonly : ''}`}
              onClick={() => handleClick(star)}
              onMouseEnter={() => !readonly && setHoverRating(star)}
              onMouseLeave={() => !readonly && setHoverRating(0)}
              whileHover={readonly ? {} : { scale: 1.2 }}
              whileTap={readonly ? {} : { scale: 0.9 }}
              disabled={readonly}
              aria-label={`Rate ${star} out of ${maxRating}`}
            >
              <div className={styles.starIcon} style={{ width: size, height: size }}>
                {/* Empty background star */}
                <span className={styles.starEmpty}>
                  <HiStar size={size} />
                </span>
                {/* Filled overlay — full or half */}
                {state !== 'empty' && (
                  <span
                    className={styles.starFill}
                    style={{ clipPath: state === 'half' ? 'inset(0 50% 0 0)' : 'none' }}
                  >
                    <HiStar size={size} />
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
      {showValue && (
        <span className={styles.value}>
          {displayRating > 0 ? `${displayRating}/${maxRating}` : 'Not rated'}
        </span>
      )}
    </div>
  );
}
