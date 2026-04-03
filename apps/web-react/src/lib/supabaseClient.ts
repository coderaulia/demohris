import { createClient, type Session } from '@supabase/supabase-js';

import { env } from './env';

const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

export const supabase = isConfigured
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
          auth: {
              persistSession: true,
              autoRefreshToken: true,
          },
      })
    : null;

export async function getSupabaseSession(): Promise<Session | null> {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session || null;
}
