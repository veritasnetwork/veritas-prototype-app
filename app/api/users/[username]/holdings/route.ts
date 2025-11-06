/**
 * Simplified Holdings API Route
 * GET /api/users/[username]/holdings
 * Returns token holdings for a user with post and pool data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: { username: string } } | { params: Promise<{ username: string }> }
) {
  try {
    // Handle both sync and async params
    const params = context.params;
    const username = 'then' in params ? (await params).username : params.username;

    if (!username || username === 'undefined') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Get user ID from username
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

    // Get user's holdings
    const { data: balances, error: balancesError } = await supabase
      .from('user_pool_balances')
      .select(`
        token_type,
        token_balance,
        pool_address,
        post_id,
        belief_lock,
        total_usdc_spent,
        total_usdc_received,
        last_trade_at
      `)
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (balancesError) {
      return NextResponse.json(
        { error: 'Failed to fetch holdings', details: balancesError.message },
        { status: 500 }
      );
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json({
        holdings: [],
        pagination: {
          total: 0,
          limit: 10,
          offset: 0,
          hasMore: false
        }
      });
    }

    // Get posts for these holdings
    const postIds = [...new Set(balances.map(b => b.post_id).filter(Boolean))];
    const { data: posts } = postIds.length > 0
      ? await supabase
          .from('posts')
          .select(`
            id,
            post_type,
            content_text,
            caption,
            media_urls,
            cover_image_url,
            article_title,
            created_at,
            users (
              username,
              display_name,
              avatar_url
            )
          `)
          .in('id', postIds)
      : { data: [] };

    // Get pool deployments for these holdings
    const poolAddresses = [...new Set(balances.map(b => b.pool_address).filter(Boolean))];
    const { data: pools } = poolAddresses.length > 0
      ? await supabase
          .from('pool_deployments')
          .select(`
            pool_address,
            cached_price_long,
            cached_price_short,
            s_long_supply,
            s_short_supply,
            sqrt_price_long_x96,
            sqrt_price_short_x96,
            r_long,
            r_short,
            implied_relevance
          `)
          .in('pool_address', poolAddresses)
      : { data: [] };

    // Map posts and pools for quick lookup
    const postsMap = new Map((posts || []).map(p => [p.id, p]));
    const poolsMap = new Map((pools || []).map(p => [p.pool_address, p]));

    // Helper function to calculate price from sqrt_price_x96
    const calculatePriceFromSqrt = (sqrtPriceX96String: string | null): number => {
      if (!sqrtPriceX96String) return 0;

      try {
        // Convert string to BigInt
        const sqrtPriceX96 = BigInt(sqrtPriceX96String);

        // Q96 = 2^96
        const Q96 = BigInt(2) ** BigInt(96);

        // price = (sqrtPrice / Q96)^2
        // To avoid precision loss, we do: price = (sqrtPrice^2) / (Q96^2)
        const priceQ192 = sqrtPriceX96 * sqrtPriceX96;
        const Q192 = Q96 * Q96;

        // Convert to number with 6 decimal places precision
        const price = Number(priceQ192 * BigInt(1000000) / Q192) / 1000000;

        return price;
      } catch (e) {
        console.error('Error calculating price from sqrt:', e);
        return 0;
      }
    };

    // Transform holdings with related data
    const holdings = balances.map(balance => {
      const post = postsMap.get(balance.post_id);
      const pool = poolsMap.get(balance.pool_address);

      // Calculate prices from sqrt values if cached prices are null
      let priceLong = 0;
      let priceShort = 0;

      if (pool) {
        // Use cached prices if available, otherwise calculate from sqrt
        priceLong = pool.cached_price_long
          ? Number(pool.cached_price_long)
          : calculatePriceFromSqrt(pool.sqrt_price_long_x96);

        priceShort = pool.cached_price_short
          ? Number(pool.cached_price_short)
          : calculatePriceFromSqrt(pool.sqrt_price_short_x96);
      }

      const currentPrice = balance.token_type === 'LONG' ? priceLong : priceShort;
      const currentValue = balance.token_balance * currentPrice;

      return {
        token_type: balance.token_type,
        post: post ? {
          id: post.id,
          post_type: post.post_type || 'text',
          content_text: post.content_text,
          caption: post.caption,
          media_urls: post.media_urls,
          cover_image_url: post.cover_image_url,
          article_title: post.article_title,
          created_at: post.created_at,
          author: {
            username: post.users?.username || 'Unknown',
            display_name: post.users?.display_name,
            avatar_url: post.users?.avatar_url
          }
        } : null,
        pool: pool ? {
          pool_address: pool.pool_address,
          supply_long: Number(pool.s_long_supply || 0) / 1_000_000,
          supply_short: Number(pool.s_short_supply || 0) / 1_000_000,
          price_long: priceLong,
          price_short: priceShort
        } : null,
        holdings: {
          token_balance: balance.token_balance,
          current_value_usdc: currentValue,
          total_usdc_spent: Number(balance.total_usdc_spent || 0) / 1_000_000,
          total_usdc_received: Number(balance.total_usdc_received || 0) / 1_000_000,
          belief_lock: Number(balance.belief_lock || 0) / 1_000_000,
          current_price: currentPrice,
          entry_price: 0 // Simplified - not calculating this for now
        }
      };
    });

    // Sort by current value
    holdings.sort((a, b) => b.holdings.current_value_usdc - a.holdings.current_value_usdc);

    return NextResponse.json({
      holdings,
      pagination: {
        total: holdings.length,
        limit: holdings.length,
        offset: 0,
        hasMore: false
      }
    });

  } catch (error) {
    console.error('[Holdings API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}