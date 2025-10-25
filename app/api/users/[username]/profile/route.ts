/**
 * Profile API Route
 * GET /api/users/[username]/profile
 * Fetches user profile data including stats and recent posts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { sqrtPriceX96ToPrice, USDC_PRECISION } from '@/lib/solana/sqrt-price-helpers';
import { microToUsdc, asMicroUsdc } from '@/lib/units';

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
    const supabase = getSupabaseServiceRole();

    // Fetch user data with timeout
    console.log('[Profile API] Querying database for username:', username);

    const userQuery = supabase
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
      .maybeSingle(); // Use maybeSingle() instead of single() to avoid hanging

    const { data: user, error: userError } = await userQuery;

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
    const solana_address = (user.agents as { solana_address?: string })?.solana_address || null;

    // Fetch all data in parallel for better performance
    const [
      { count: totalPosts, error: postsCountError },
      { data: agentData, error: agentError },
      { data: recentPosts, error: postsError }
    ] = await Promise.all([
      // Count total posts created by this user
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Get total stake from agents table
      supabase
        .from('agents')
        .select('total_stake')
        .eq('id', user.agent_id)
        .single(),

      // Fetch recent posts (limit to 10 most recent) - USING NEW SCHEMA
      // NOTE: We don't fetch content_json here to improve performance - it's large and not needed for list view
      supabase
        .from('posts')
        .select(`
          id,
          post_type,
          content_text,
          caption,
          media_urls,
          created_at,
          pool_deployments!left(
            pool_address,
            s_long_supply,
            s_short_supply,
            vault_balance,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            f,
            beta_num,
            beta_den
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    if (postsCountError) {
      console.error('Posts count error:', postsCountError);
    }

    if (agentError) {
      console.error('Agent fetch error:', agentError);
    }

    if (postsError) {
      console.error('Posts fetch error:', postsError);
    }

    const stats = {
      total_stake: agentData?.total_stake ? microToUsdc(asMicroUsdc(Number(agentData.total_stake))) : 0,
      total_posts: totalPosts || 0,
    };

    // Transform posts to match new Post type schema
    const recent_posts = (recentPosts || []).map((post: {
      id: string;
      pool_deployments?: Array<{
        sqrt_price_long_x96?: string;
        sqrt_price_short_x96?: string;
        s_long_supply?: number;
        s_short_supply?: number;
        vault_balance?: number;
        pool_address?: string;
        long_mint_address?: string;
        short_mint_address?: string;
      }>;
      [key: string]: unknown;
    }) => {
      const pool = post.pool_deployments?.[0];

      // Calculate prices from sqrt prices
      let priceLong = null;
      let priceShort = null;
      if (pool?.sqrt_price_long_x96) {
        try {
          priceLong = sqrtPriceX96ToPrice(pool.sqrt_price_long_x96);
        } catch (e) {
          console.warn('Failed to calculate priceLong:', e);
        }
      }
      if (pool?.sqrt_price_short_x96) {
        try {
          priceShort = sqrtPriceX96ToPrice(pool.sqrt_price_short_x96);
        } catch (e) {
          console.warn('Failed to calculate priceShort:', e);
        }
      }

      return {
        id: post.id,
        post_type: post.post_type || 'text',
        content_text: post.content_text,
        caption: post.caption,
        media_urls: post.media_urls,
        timestamp: post.created_at,
        author: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url || null,
        },
        belief: null, // TODO: Implement belief aggregation from belief_submissions
        poolAddress: pool?.pool_address || null,
        poolSupplyLong: pool?.s_long_supply ? Number(pool.s_long_supply) / USDC_PRECISION : null,
        poolSupplyShort: pool?.s_short_supply ? Number(pool.s_short_supply) / USDC_PRECISION : null,
        poolPriceLong: priceLong,
        poolPriceShort: priceShort,
        poolSqrtPriceLongX96: pool?.sqrt_price_long_x96 || null,
        poolSqrtPriceShortX96: pool?.sqrt_price_short_x96 || null,
        poolVaultBalance: pool?.vault_balance ? Number(pool.vault_balance) / USDC_PRECISION : null,
        poolF: pool?.f || null,
        poolBetaNum: pool?.beta_num || null,
        poolBetaDen: pool?.beta_den || null,
        // Default values for required fields
        relevanceScore: 0,
        signals: { truth: 0, novelty: 0, importance: 0, virality: 0 },
        discussionCount: 0,
      };
    });

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

    return NextResponse.json(profileData, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=30',
      }
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
