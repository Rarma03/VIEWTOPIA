'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FcGoogle } from 'react-icons/fc';
import { HiFilm } from 'react-icons/hi2';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import styles from './login.module.css';

const ERROR_MESSAGES: Record<string, string> = {
  no_session: 'Sign-in did not complete. Please try again.',
  callback_failed: 'We could not finish signing you in. Please try again.',
  supabase_not_configured: 'Authentication is not configured on this server.',
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { loginWithGoogle, error, isAuthenticated, isLoading } = useAuth();
  const { isDark } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();

  // If the user is already signed in, send them home (or to onboarding).
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) router.replace('/');
  }, [isAuthenticated, isLoading, router]);

  const errorParam = searchParams.get('error');
  const displayError = error || (errorParam ? ERROR_MESSAGES[errorParam] ?? errorParam : null);

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : styles.light}`}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.header}>
          <HiFilm size={32} className={styles.logo} />
          <h1 className={styles.title}>Welcome to TrackFlix</h1>
          <p className={styles.subtitle}>Track movies, TV & anime with your friends</p>
        </div>

        <button className={styles.googleBtn} onClick={loginWithGoogle}>
          <FcGoogle size={20} />
          <span>Continue with Google</span>
        </button>

        {displayError && <p className={styles.error}>{displayError}</p>}

        <p className={styles.subtitle} style={{ marginTop: 24, fontSize: 12, opacity: 0.7 }}>
          Sign in to rate, build watchlists, and join Watch Parties.
        </p>
      </motion.div>
    </div>
  );
}
