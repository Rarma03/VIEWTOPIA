'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { User } from '@/types';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

interface DbProfile {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  is_premium: boolean | null;
  onboarded: boolean | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Local cache (so the UI hydrates instantly on reload)
// ---------------------------------------------------------------------------

const PROFILE_CACHE_KEY = 'trackflix_user';

function readCachedUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // storage unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function profileToUser(p: DbProfile, session: Session): User {
  return {
    id: p.id,
    email: p.email ?? session.user.email ?? '',
    username: p.username ?? '',
    display_name:
      p.display_name ??
      (session.user.email?.split('@')[0] ?? ''),
    avatar_url: p.avatar_url,
    city: p.city,
    is_premium: !!p.is_premium,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

/** Pull the profile row for the signed-in user. Returns null if no row exists. */
async function fetchProfile(session: Session): Promise<User | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, email, username, display_name, avatar_url, city, is_premium, onboarded, created_at, updated_at')
    .eq('id', session.user.id)
    .maybeSingle<DbProfile>();

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[auth] failed to load profile:', error.message);
    return null;
  }
  if (!data) return null;
  return profileToUser(data, session);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Mirror user state into local cache for instant hydration on reload.
  useEffect(() => { writeCachedUser(user); }, [user]);

  // ---- Sync function used by both the initial load and auth-state events ----
  const syncFromSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setUser(null);
      return;
    }
    const profile = await fetchProfile(session);
    if (profile) {
      setUser(profile);
    } else {
      // Profile row hasn't been inserted yet (trigger missed). Use a minimal
      // shell so the UI knows we're authenticated; onboarding will fill it in.
      setUser({
        id: session.user.id,
        email: session.user.email ?? '',
        username: '',
        display_name:
          (session.user.user_metadata?.full_name as string | undefined) ??
          session.user.email?.split('@')[0] ??
          '',
        avatar_url:
          (session.user.user_metadata?.avatar_url as string | undefined) ?? null,
        city: null,
        is_premium: false,
        created_at: session.user.created_at,
        updated_at: session.user.updated_at ?? session.user.created_at,
      });
    }
  }, []);

  // ---- Initial session check + subscription ---------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = getSupabase();

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        await syncFromSession(data.session);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Fires for SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, etc. Always re-sync.
      syncFromSession(session);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [syncFromSession]);

  // ---- Public API -----------------------------------------------------------
  const refreshProfile = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await getSupabase().auth.getSession();
    await syncFromSession(data.session);
  }, [syncFromSession]);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured.');
      return;
    }
    const { error: signInError } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${globalThis.location.origin}/auth/callback` },
    });
    if (signInError) setError(signInError.message);
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured) {
      try { await getSupabase().auth.signOut(); } catch { /* already signed out */ }
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    needsOnboarding: !!user && !user.username,
    error,
    loginWithGoogle,
    logout,
    refreshProfile,
  }), [user, isLoading, error, loginWithGoogle, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
