'use client';

import Link from 'next/link';
import { HiHeart } from 'react-icons/hi2';
import { useTheme } from '@/context/ThemeContext';
import styles from './Footer.module.css';

export default function Footer() {
  const { isDark } = useTheme();

  return (
    <footer className={`${styles.footer} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.brand}>
            <span className={styles.logo}><HiHeart className={styles.logoHeart} /> Viewtopia</span>
            <p className={styles.tagline}>Track movies, TV series & anime with friends.</p>
          </div>
          <div className={styles.links}>
            <div className={styles.linkGroup}>
              <h4>Browse</h4>
              <Link href="/movies">Movies</Link>
              <Link href="/tv">TV Series</Link>
              <Link href="/anime">Anime</Link>
            </div>
            <div className={styles.linkGroup}>
              <h4>Features</h4>
              <Link href="/mood">Mood &amp; Random</Link>
              <Link href="/activity">Activity Feed</Link>
              <Link href="/recommendations">Recommendations</Link>
            </div>
            <div className={styles.linkGroup}>
              <h4>About</h4>
              <Link href="/help">Help &amp; Guide</Link>
              <Link href="/premium">Premium</Link>
            </div>
          </div>
        </div>
        <div className={styles.bottom}>
          <p>
            Made with <HiHeart className={styles.heart} /> by the Viewtopia crew
          </p>
          <div className={styles.credits}>
            <span>Powered by TMDB & Jikan</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
