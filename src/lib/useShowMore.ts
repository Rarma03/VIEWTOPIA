import { useEffect, useState } from 'react';

/**
 * Generic "show more" pagination hook for client-side lists.
 *
 * - Caps the rendered slice to `initial` items.
 * - `showMore` reveals the next `step` (defaults to `initial`).
 * - When the source array length, `initial`, or `step` changes, the visible
 *   window resets to `initial` so filter changes don't leave a stale window.
 *
 * Pass the raw array as `items`; render `visible` instead of `items` directly.
 */
export function useShowMore<T>(items: readonly T[], initial: number, step?: number) {
  const inc = step ?? initial;
  const [count, setCount] = useState(initial);

  // Reset when the underlying list or paging settings change.
  useEffect(() => { setCount(initial); }, [items, initial, inc]);

  const total = items.length;
  const cappedCount = Math.min(count, total);
  const visible = items.slice(0, cappedCount);
  const hasMore = cappedCount < total;
  const remaining = Math.max(total - cappedCount, 0);

  return {
    visible,
    hasMore,
    total,
    shown: cappedCount,
    remaining,
    showMore: () => setCount((c) => Math.min(c + inc, total)),
    reset: () => setCount(initial),
  };
}
