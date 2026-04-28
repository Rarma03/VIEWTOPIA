'use client';

/**
 * Floating circular shortcut to the History (`/activity`) page.
 *
 * Sits anchored to the right edge of the viewport, vertically between
 * the middle and the bottom. The "ribbon" is a half-pill: the right side
 * is a flat slab that hugs the edge, and the left side is a circle that
 * extends outward holding the clock icon. Hovering reveals a small label.
 *
 * Hidden when the user is signed out (no history to view) and on the
 * `/activity` page itself.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HiClock } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import styles from './HistoryRibbon.module.css';

export default function HistoryRibbon() {
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  // Avoid SSR/CSR mismatch: auth state is only known on the client. Render
  // nothing during SSR + first commit, then reveal after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) return null;
  if (!isAuthenticated) return null;
  if (pathname?.startsWith('/activity')) return null;

  return (
    <Link
      href="/activity"
      className={styles.ribbon}
      aria-label="Open History"
      title="History"
    >
      <span className={styles.label}>History</span>
      <span className={styles.circle}>
        <HiClock size={22} />
      </span>
    </Link>
  );
}
