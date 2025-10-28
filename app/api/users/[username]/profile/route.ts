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


    if (!username || username === 'undefined') {
      console.error('[Profile API] Invalid username:', username);
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Parse pagination parameters for posts
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50
    const offset = parseInt(searchParams.get('offset') || '0');

    // Initialize Supabase client with service role for data access
    const supabase = getSupabaseServiceRole();

    // Fetch user data with timeout

    const userQuery = supabase
      .from('users')
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        agent_id
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


    // Get user's Solana address
    const { data: userAgent } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', user.agent_id)
      .single();

    const solana_address = userAgent?.solana_address || null;

    // Fetch all data in parallel for better performance
    const [
      { count: totalPosts, error: postsCountError },
      { data: agentData, error: agentError },
      { data: lockedStakeData, error: lockedStakeError },
      { data: recentPosts, error: postsError }
    ] = await Promise.all([
      // Count total posts created by this user
      supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),

      // Get total stake from agents table (custodian balance)
      supabase
        .from('agents')
        .select('total_stake')
        .eq('id', user.agent_id)
        .single(),

      // Get total locked stake from user_pool_balances (sum of all belief locks)
      supabase
        .from('user_pool_balances')
        .select('belief_lock')
        .eq('user_id', user.id)
        .gt('token_balance', 0), // Only active positions

      // Fetch recent posts with pagination - USING NEW SCHEMA
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
          cover_image_url,
          article_title,
          total_volume_usdc,
          pool_deployments!left(
            pool_address,
            s_long_supply,
            s_short_supply,
            vault_balance,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            cached_price_long,
            cached_price_short,
            prices_last_updated_at,
            f,
            beta_num,
            beta_den
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)
    ]);

    if (postsCountError) {
      console.error('Posts count error:', postsCountError);
    }

    if (agentError) {
      console.error('Agent fetch error:', agentError);
    }

    if (lockedStakeError) {
      console.error('Locked stake fetch error:', lockedStakeError);
    }

    if (postsError) {
      console.error('Posts fetch error:', postsError);
    }

    // Debug logging

    // Round to nearest integer before converting (database might have decimal values)
    const totalStakeInt = agentData?.total_stake ? Math.round(Number(agentData?.total_stake)) : 0;

    const convertedStake = totalStakeInt > 0 ? microToUsdc(asMicroUsdc(totalStakeInt)) : 0;

    // Calculate total locked stake (sum of all belief locks for active positions)
    console.log('[Profile API] Locked stake data:', {
      username,
      userId: user.id,
      rowCount: lockedStakeData?.length || 0,
      rows: lockedStakeData?.map(r => ({
        belief_lock: r.belief_lock,
        belief_lock_type: typeof r.belief_lock,
        belief_lock_raw: r.belief_lock
      })),
      error: lockedStakeError?.message
    });

    const totalLockedInt = (lockedStakeData || []).reduce((sum, row) => {
      const lock = row.belief_lock ? Math.round(Number(row.belief_lock)) : 0;
      console.log('[Profile API] Processing lock:', { belief_lock: row.belief_lock, lock, sum });
      return sum + lock;
    }, 0);

    const convertedLocked = totalLockedInt > 0 ? microToUsdc(asMicroUsdc(totalLockedInt)) : 0;

    console.log('[Profile API] Locked stake calculation:', {
      totalLockedInt,
      convertedLocked,
      formula: `${totalLockedInt} micro-USDC / 1,000,000 = ${convertedLocked} USDC`
    });

    const stats = {
      // total_stake is stored in micro-USDC in the database, always convert
      total_stake: convertedStake,
      total_locked: convertedLocked,
      total_posts: totalPosts || 0,
    };

    // Transform posts to match new Post type schema
    const recent_posts = (recentPosts || []).map((post: {
      id: string;
      total_volume_usdc?: number;
      pool_deployments?: Array<{
        sqrt_price_long_x96?: string;
        sqrt_price_short_x96?: string;
        cached_price_long?: number;
        cached_price_short?: number;
        prices_last_updated_at?: string;
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

      // Use cached prices if fresh (less than 60 seconds old)
      const CACHE_MAX_AGE_MS = 60 * 1000;
      const now = new Date();
      const pricesUpdatedAt = pool?.prices_last_updated_at
        ? new Date(pool.prices_last_updated_at)
        : null;

      const isCacheFresh = pricesUpdatedAt &&
        (now.getTime() - pricesUpdatedAt.getTime()) < CACHE_MAX_AGE_MS &&
        pool?.cached_price_long !== null &&
        pool?.cached_price_short !== null;

      // Use cached prices if available and fresh, otherwise calculate from sqrt prices
      let priceLong = null;
      let priceShort = null;

      if (isCacheFresh) {
        priceLong = Number(pool.cached_price_long);
        priceShort = Number(pool.cached_price_short);
      } else {
        // Fall back to calculating from sqrt prices
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
      }

      return {
        id: post.id,
        post_type: post.post_type || 'text',
        content_text: post.content_text,
        caption: post.caption,
        media_urls: post.media_urls,
        cover_image_url: post.cover_image_url,
        article_title: post.article_title,
        timestamp: post.created_at,
        created_at: post.created_at,
        author: {
          id: user.id,
          username: user.username,
          display_name: user.display_name,
          avatar_url: user.avatar_url || null,
        },
        belief: null,
        poolAddress: pool?.pool_address || null,
        poolSupplyLong: pool?.s_long_supply !== undefined && pool?.s_long_supply !== null ? Number(pool.s_long_supply) / USDC_PRECISION : null,
        poolSupplyShort: pool?.s_short_supply !== undefined && pool?.s_short_supply !== null ? Number(pool.s_short_supply) / USDC_PRECISION : null,
        poolPriceLong: priceLong,
        poolPriceShort: priceShort,
        poolSqrtPriceLongX96: pool?.sqrt_price_long_x96 !== undefined && pool?.sqrt_price_long_x96 !== null ? pool.sqrt_price_long_x96 : null,
        poolSqrtPriceShortX96: pool?.sqrt_price_short_x96 !== undefined && pool?.sqrt_price_short_x96 !== null ? pool.sqrt_price_short_x96 : null,
        poolVaultBalance: pool?.vault_balance !== undefined && pool?.vault_balance !== null ? Number(pool.vault_balance) / USDC_PRECISION : null,
        poolF: pool?.f || null,
        poolBetaNum: pool?.beta_num || null,
        poolBetaDen: pool?.beta_den || null,
        totalVolumeUsdc: post.total_volume_usdc ? Number(post.total_volume_usdc) : undefined,
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
      pagination: {
        total: totalPosts || 0,
        limit,
        offset,
        hasMore: (recentPosts?.length || 0) === limit
      }
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
