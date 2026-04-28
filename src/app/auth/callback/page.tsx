'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

/**
 * OAuth landing page.
 *
 * The Supabase client is configured with `detectSessionInUrl: true`, so it
 * automatically exchanges the `?code=` in this URL for a session and emits a
 * `SIGNED_IN` event. AuthContext listens for that event and updates `user`.
 *
 * All this page has to do is wait for AuthContext to finish loading, then
 * route to onboarding (new user) or home (returning user).
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, needsOnboarding } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?error=no_session');
      return;
    }
    router.replace(needsOnboarding ? '/onboarding' : '/');
  }, [isLoading, isAuthenticated, needsOnboarding, router]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ opacity: 0.7 }}>Signing you in…</p>
    </div>
  );
}
