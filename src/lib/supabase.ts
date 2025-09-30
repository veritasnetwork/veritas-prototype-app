import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Public client for unauthenticated operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Authenticated client factory - injects Privy JWT into headers
export const createAuthenticatedClient = (jwt: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`
      }
    }
  });
};

// Re-export database types for convenience
export type { DbPost as Post } from '@/types/database.types';