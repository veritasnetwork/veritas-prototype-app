/**
 * User Holdings API Route
 * GET /api/users/[username]/holdings
 * Returns token holdings for a user with post and pool data
 *
 * ICBS Version - Fetches prices from on-chain pool data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { batchFetchPoolsData } from '@/lib/solana/fetch-pool-data';
import { estimateUsdcOut, TokenSide } from '@/lib/solana/icbs-pricing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const { username } = await params;

    if (!username || username === 'undefined') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // Max 50
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseServiceRole();

    // First, get the user ID from username
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Try to fetch holdings using RPC function first, with fallback to direct query
    console.log('[Holdings API] Fetching holdings for user:', { username, userId: user.id });

    let allPositions: any[] = [];
    let holdingsError: any = null;

    // Try RPC function first
    const rpcResult = await supabase
      .rpc('get_user_holdings_with_entry_price', { p_user_id: user.id });

    if (rpcResult.error) {
      console.error('[Holdings API] RPC function failed, trying direct query:', {
        error: rpcResult.error.message,
        hint: rpcResult.error.hint,
        code: rpcResult.error.code
      });

      // Fallback to direct query if RPC fails
      const { data: directPositions, error: directError } = await supabase
        .from('user_pool_balances')
        .select(`
          token_balance,
          total_usdc_spent,
          total_bought,
          total_sold,
          total_usdc_received,
          pool_address,
          post_id,
          token_type,
          belief_lock,
          last_trade_at,
          posts!inner (
            id,
            post_type,
            content_text,
            caption,
            media_urls,
            cover_image_url,
            article_title,
            created_at,
            user_id,
            users!inner (
              username,
              display_name,
              avatar_url
            )
          ),
          pool_deployments!inner (
            pool_address,
            cached_price_long,
            cached_price_short,
            s_long_supply,
            s_short_supply,
            prices_last_updated_at
          )
        `)
        .eq('user_id', user.id)
        .gt('token_balance', 0);

      if (directError) {
        holdingsError = directError;
        console.error('[Holdings API] Direct query also failed:', directError);
      } else {
        // Transform direct query results to match expected format
        allPositions = (directPositions || []).map((pos: any) => ({
          ...pos,
          posts: pos.posts ? {
            id: pos.posts.id,
            post_type: pos.posts.post_type,
            content_text: pos.posts.content_text,
            caption: pos.posts.caption,
            media_urls: pos.posts.media_urls,
            cover_image_url: pos.posts.cover_image_url,
            article_title: pos.posts.article_title,
            created_at: pos.posts.created_at,
            user_id: pos.posts.user_id,
            users: pos.posts.users
          } : null,
          pool_deployments: pos.pool_deployments ? {
            pool_address: pos.pool_deployments.pool_address,
            cached_price_long: pos.pool_deployments.cached_price_long,
            cached_price_short: pos.pool_deployments.cached_price_short,
            s_long_supply: pos.pool_deployments.s_long_supply,
            s_short_supply: pos.pool_deployments.s_short_supply,
            prices_last_updated_at: pos.pool_deployments.prices_last_updated_at
          } : null,
          entry_price: 0 // Will calculate manually if needed
        }));
        console.log('[Holdings API] Direct query succeeded, found positions:', allPositions.length);
      }
    } else {
      allPositions = rpcResult.data || [];
      console.log('[Holdings API] RPC function succeeded, found positions:', allPositions.length);
    }

    if (holdingsError) {
      console.error('[Holdings API] Final error:', {
        error: holdingsError,
        message: holdingsError.message,
        userId: user.id,
        username
      });
      return NextResponse.json(
        {
          error: 'Failed to fetch holdings',
          details: holdingsError.message
        },
        { status: 500 }
      );
    }

    console.log('[Holdings API] Fetched positions count:', allPositions?.length || 0);

    // Apply pagination in-memory (since RPC doesn't support .range())
    // Sort by value first (would need pool data for perfect sort, so we'll do basic sort)
    const sortedPositions = (allPositions || []).sort((a: any, b: any) => {
      // Sort by token_balance * rough price estimate
      const aValue = a.token_balance * (a.entry_price || 0);
      const bValue = b.token_balance * (b.entry_price || 0);
      return bValue - aValue;
    });

    const totalCount = sortedPositions.length;
    const positions = sortedPositions.slice(offset, offset + limit);

    // Keep positions separate - don't aggregate LONG and SHORT together
    // Each position (LONG or SHORT) will be its own holding entry
    interface PositionEntry {
      pool_address: string;
      post_id: string;
      posts: { id?: string; post_type?: string; content_text?: string; caption?: string; media_urls?: string[]; cover_image_url?: string; article_title?: string; user_id?: string; created_at?: string; total_volume_usdc?: number; users?: { username?: string; display_name?: string; avatar_url?: string } };
      pool_deployments: { pool_address?: string; prices_last_updated_at?: string; cached_price_long?: number; cached_price_short?: number; s_long_supply?: number; s_short_supply?: number };
      token_type: 'LONG' | 'SHORT';
      token_balance: number;
      belief_lock: number;
      total_usdc_spent: number;
      total_usdc_received: number;
      last_trade_at: string;
      entry_price: number;
    }

    const holdings: PositionEntry[] = (positions || []).map((pos: any) => ({
      pool_address: pos.pool_address,
      post_id: pos.post_id,
      posts: pos.posts,
      pool_deployments: pos.pool_deployments,
      token_type: pos.token_type as 'LONG' | 'SHORT',
      token_balance: pos.token_balance,
      belief_lock: pos.belief_lock / 1_000_000,
      total_usdc_spent: pos.total_usdc_spent / 1_000_000,
      total_usdc_received: pos.total_usdc_received / 1_000_000,
      last_trade_at: pos.last_trade_at,
      entry_price: Number(pos.entry_price) || 0,
    }));

    // Fetch per-token-type volume for all positions in a single query
    const volumeByPostAndType = new Map<string, number>();

    if (holdings.length > 0) {
      const postIds = [...new Set(holdings.map(h => h.post_id))];


      const { data: volumeData } = await supabase
        .from('trades')
        .select('post_id, side, usdc_amount')
        .in('post_id', postIds);


      // Aggregate volumes by post_id and side
      (volumeData || []).forEach(trade => {
        const key = `${trade.post_id}-${trade.side}`;
        const currentVolume = volumeByPostAndType.get(key) || 0;
        const newVolume = currentVolume + (Number(trade.usdc_amount) / 1_000_000);
        volumeByPostAndType.set(key, newVolume);
      });

    }

    // Separate pools into cached (fresh) and stale (need fetching)
    const CACHE_MAX_AGE_MS = 60 * 1000; // 60 seconds
    const now = new Date();
    const poolsNeedingFetch: string[] = [];
    const cachedPoolData = new Map<string, { priceLong: number; priceShort: number; supplyLong: number; supplyShort: number }>();

    for (const holding of holdings) {
      const poolDeployment = holding.pool_deployments;
      if (!poolDeployment?.pool_address) continue;

      const poolAddress = poolDeployment.pool_address;
      const pricesUpdatedAt = poolDeployment.prices_last_updated_at
        ? new Date(poolDeployment.prices_last_updated_at)
        : null;

      // Check if cached prices are fresh (less than 60 seconds old)
      const isCacheFresh = pricesUpdatedAt &&
        (now.getTime() - pricesUpdatedAt.getTime()) < CACHE_MAX_AGE_MS &&
        poolDeployment.cached_price_long !== null &&
        poolDeployment.cached_price_short !== null;

      if (isCacheFresh) {
        // Use cached prices
        cachedPoolData.set(poolAddress, {
          priceLong: Number(poolDeployment.cached_price_long),
          priceShort: Number(poolDeployment.cached_price_short),
          supplyLong: Number(poolDeployment.s_long_supply || 0) / 1_000_000, // Convert to display units
          supplyShort: Number(poolDeployment.s_short_supply || 0) / 1_000_000,
        });
      } else {
        // Mark for on-chain fetch
        if (!poolsNeedingFetch.includes(poolAddress)) {
          poolsNeedingFetch.push(poolAddress);
        }
      }
    }

    // Batch fetch stale pool data from chain
    const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || 'http://localhost:8899';
    const fetchedPoolDataMap = poolsNeedingFetch.length > 0
      ? await batchFetchPoolsData(poolsNeedingFetch, rpcEndpoint)
      : new Map();

    // Combine cached and fetched data
    const poolDataMap = new Map<string, { priceLong: number; priceShort: number; supplyLong: number; supplyShort: number }>();

    // Add cached data
    for (const [address, data] of cachedPoolData.entries()) {
      poolDataMap.set(address, data);
    }

    // Add fetched data (may override cached if pool was in both sets)
    for (const [address, data] of fetchedPoolDataMap.entries()) {
      if (data) {
        poolDataMap.set(address, data);
      }
    }

    // Transform holdings with fetched pool data
    const transformedHoldings = holdings.map((holding: PositionEntry) => {
      const post = holding.posts;
      const poolAddress = holding.pool_deployments?.pool_address;
      const poolData = poolAddress ? poolDataMap.get(poolAddress) : null;

      // Calculate current price and value (with slippage)
      let currentPrice = 0;
      let currentValueUsdc = 0;

      if (poolData) {
        currentPrice = holding.token_type === 'LONG' ? poolData.priceLong : poolData.priceShort;

        // Calculate actual USDC out if user sold all tokens (accounts for slippage)
        const side = holding.token_type === 'LONG' ? TokenSide.Long : TokenSide.Short;
        const currentSupply = holding.token_type === 'LONG' ? poolData.supplyLong : poolData.supplyShort;
        const otherSupply = holding.token_type === 'LONG' ? poolData.supplyShort : poolData.supplyLong;

        currentValueUsdc = estimateUsdcOut(
          currentSupply,
          otherSupply,
          holding.token_balance,
          side,
          1.0 // lambda scale
        );
      }

      // Get volume for this specific token type
      const volumeKey = `${holding.post_id}-${holding.token_type}`;
      const tokenVolume = volumeByPostAndType.get(volumeKey) || 0;


      return {
        token_type: holding.token_type,
        post: {
          id: post?.id,
          post_type: post?.post_type || 'text',
          content_text: post?.content_text,
          caption: post?.caption,
          media_urls: post?.media_urls,
          cover_image_url: post?.cover_image_url,
          article_title: post?.article_title,
          user_id: post?.user_id,
          created_at: post?.created_at,
          total_volume_usdc: post?.total_volume_usdc || 0,
          token_volume_usdc: tokenVolume,
          author: {
            username: post?.users?.username || 'Unknown',
            display_name: post?.users?.display_name || post?.users?.username || 'Unknown',
            avatar_url: post?.users?.avatar_url || null,
          },
        },
        pool: {
          pool_address: poolAddress,
          supply_long: poolData?.supplyLong || 0,
          supply_short: poolData?.supplyShort || 0,
          price_long: poolData?.priceLong || 0,
          price_short: poolData?.priceShort || 0,
        },
        holdings: {
          token_balance: holding.token_balance,
          current_value_usdc: currentValueUsdc,
          total_usdc_spent: holding.total_usdc_spent,
          total_usdc_received: holding.total_usdc_received,
          belief_lock: holding.belief_lock,
          current_price: currentPrice,
          entry_price: holding.entry_price,
        },
      };
    });

    // Sort by current value (highest first)
    transformedHoldings.sort((a, b) =>
      b.holdings.current_value_usdc - a.holdings.current_value_usdc
    );

    return NextResponse.json(
      {
        holdings: transformedHoldings,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount
        }
      },
      {
        headers: {
          // Cache for 10 seconds, allow stale content for up to 30 seconds while revalidating
          'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30',
        },
      }
    );

  } catch (error) {
    console.error('Holdings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
