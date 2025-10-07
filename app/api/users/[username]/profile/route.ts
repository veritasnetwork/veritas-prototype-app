/**
 * Profile API Route
 * GET /api/users/[username]/profile
 * Fetches user profile data including stats and recent posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    console.log('[Profile API] Fetching profile for username:', username);

    if (!username || username === 'undefined') {
      console.error('[Profile API] Invalid username:', username);
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role for data access
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user data
    console.log('[Profile API] Querying database for username:', username);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        agent_id,
        agents!inner(solana_address)
      `)
      .eq('username', username)
      .single();

    if (userError || !user) {
      console.error('[Profile API] User fetch error:', {
        username,
        error: userError,
        message: userError?.message,
        code: userError?.code,
      });
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[Profile API] User found:', user.id, user.username);

    // Extract solana_address from nested agents relation
    const solana_address = (user.agents as any)?.solana_address || null;

    // Fetch user stats
    // Count total posts created by this user
    const { count: totalPosts, error: postsCountError } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);

    if (postsCountError) {
      console.error('Posts count error:', postsCountError);
    }

    // Get total stake from agents table
    const { data: agentData, error: agentError } = await supabase
      .from('agents')
      .select('total_stake')
      .eq('id', user.agent_id)
      .single();

    if (agentError) {
      console.error('Agent fetch error:', agentError);
    }

    const stats = {
      total_stake: agentData?.total_stake || 0,
      total_posts: totalPosts || 0,
    };

    // Fetch recent posts (limit to 10 most recent)
    const { data: recentPosts, error: postsError } = await supabase
      .from('posts')
      .select(`
        id,
        headline,
        content,
        created_at,
        author_id,
        pool_address,
        pool_token_supply,
        pool_reserve_balance,
        pool_k_quadratic,
        users(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (postsError) {
      console.error('Posts fetch error:', postsError);
    }

    // Transform posts to match Post type
    const recent_posts = (recentPosts || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      content: post.content,
      timestamp: post.created_at,
      author: {
        id: post.users?.id || user.id,
        name: post.users?.display_name || post.users?.username || 'Unknown',
        username: post.users?.username || '',
        avatar: post.users?.avatar_url || null,
      },
      poolAddress: post.pool_address,
      poolTokenSupply: post.pool_token_supply,
      poolReserveBalance: post.pool_reserve_balance,
      poolKQuadratic: post.pool_k_quadratic,
    }));

    // Construct profile response
    const profileData = {
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        solana_address,
      },
      stats,
      recent_posts,
    };

    return NextResponse.json(profileData);
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
