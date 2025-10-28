/**
 * Server-side Supabase client singleton
 *
 * IMPORTANT: This module implements a singleton pattern to prevent
 * connection pool exhaustion. Each API route should use getSupabaseServiceRole()
 * instead of creating new clients.
 *
 * DO NOT use this in client-side code - use src/lib/supabase.ts instead.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton instance (module-level cache)
let serviceRoleClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Get singleton Supabase client with SERVICE ROLE key
 *
 * Use for:
 * - Admin operations
 * - Bypassing RLS
 * - System operations
 *
 * @returns Supabase client with service role key
 */
export function getSupabaseServiceRole(): SupabaseClient {
  if (!serviceRoleClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
      );
    }


    serviceRoleClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-source': 'server-singleton',
        },
      },
    });
  }

  return serviceRoleClient;
}

/**
 * Get singleton Supabase client with ANON key
 *
 * Use for:
 * - Public data access
 * - RLS-protected queries
 * - Read operations
 *
 * @returns Supabase client with anon key
 */
export function getSupabaseAnon(): SupabaseClient {
  if (!anonClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required'
      );
    }


    anonClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-source': 'server-singleton',
        },
      },
    });
  }

  return anonClient;
}

export function resetSingletons() {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('[Supabase] resetSingletons() called outside of test environment');
  }
  serviceRoleClient = null;
  anonClient = null;
}
