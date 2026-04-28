'use client';

import styles from './ShowMoreButton.module.css';

interface ShowMoreButtonProps {
  shown: number;
  total: number;
  onClick: () => void;
  step?: number;
  label?: string;
}

/**
 * Compact "Show more" pill with a count summary, used to paginate any
 * client-side list. Pair with the `useShowMore` hook.
 */
export default function ShowMoreButton({
  shown,
  total,
  onClick,
  step,
  label = 'Show more',
}: ShowMoreButtonProps) {
  const remaining = Math.max(total - shown, 0);
  if (remaining === 0) return null;
  const next = Math.min(step ?? remaining, remaining);
  return (
    <div className={styles.row}>
      <span className={styles.meta}>
        Showing {shown} of {total}
      </span>
      <button type="button" className={styles.btn} onClick={onClick}>
        {label} ({next > 0 ? `+${next}` : remaining})
      </button>
    </div>
  );
}
