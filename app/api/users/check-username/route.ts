import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/users/check-username
 * Check if a username is available
 *
 * Optimized for speed:
 * - Minimal query (only checks existence, doesn't fetch data)
 * - Short cache duration to reduce database load
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Validate username format (client-side validation, fast fail)
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { available: false, error: 'Username must be 3-20 characters' },
        { status: 200 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { available: false, error: 'Username can only contain letters, numbers, and underscores' },
        { status: 200 }
      );
    }

    const supabase = getSupabaseServiceRole();
    const lowerUsername = username.toLowerCase();

    // Optimized query: use count instead of select to check existence
    // This is faster because it doesn't need to fetch actual row data
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('username', lowerUsername)
      .limit(1);

    if (error) {
      console.error('[check-username] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to check username availability' },
        { status: 500 }
      );
    }

    const available = count === 0;

    // Add cache headers (10 second cache for available usernames, no cache for taken ones)
    const headers = new Headers();
    if (available) {
      headers.set('Cache-Control', 'private, max-age=10');
    } else {
      headers.set('Cache-Control', 'private, no-cache');
    }

    return NextResponse.json(
      {
        available,
        username: lowerUsername,
      },
      { headers }
    );
  } catch (error) {
    console.error('[check-username] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
