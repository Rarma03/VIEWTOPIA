'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { HiTrophy, HiArrowLeft } from 'react-icons/hi2';
import { useTheme } from '@/context/ThemeContext';
import styles from './badges.module.css';

export default function BadgesPage() {
  const { isDark } = useTheme();
  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <div className={styles.container}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', padding: '4rem 1rem' }}
        >
          <HiTrophy size={64} style={{ opacity: 0.5, marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>Badges are coming back</h1>
          <p style={{ opacity: 0.7, marginBottom: '2rem', maxWidth: 480, margin: '0 auto 2rem' }}>
            We&apos;re rebuilding badge tracking on top of your cloud-synced watch history.
            Keep watching &mdash; your progress will be preserved.
          </p>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '999px', background: '#e50914', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>
            <HiArrowLeft size={16} /> Back home
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
