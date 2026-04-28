import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
      throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return _supabase;
}

/** Safe check for whether Supabase is configured */
export const isSupabaseConfigured =
  !!supabaseUrl && supabaseUrl.startsWith('http') && !!supabaseAnonKey;

// Keep backward compat – lazy proxy
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return Reflect.get(getSupabase(), prop);
  },
});
