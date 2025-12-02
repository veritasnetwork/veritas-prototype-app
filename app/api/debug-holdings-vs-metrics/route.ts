/**
 * Debug endpoint to compare holdings API data vs pool metrics data
 * GET /api/debug-holdings-vs-metrics?username=<username>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { sqrtPriceX96ToPrice } from '@/lib/solana/sqrt-price-helpers';

export async function GET(request: NextRequest) {
  try {
    const username = request.nextUrl.searchParams.get('username');

    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }

    const supabase = getSupabaseServiceRole();

    // Get user ID
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's holdings (balances)
    const { data: balances, error: balancesError } = await supabase
      .from('user_pool_balances')
      .select('*')
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (balancesError) {
      return NextResponse.json({ error: 'Failed to fetch balances', details: balancesError }, { status: 500 });
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json({ message: 'No holdings found', balances: [] });
    }

    // Get unique post IDs
    const postIds = [...new Set(balances.map(b => b.post_id).filter(Boolean))];

    // Fetch posts with pool data - EXACT same query as /api/posts/[id]
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`
        *,
        total_volume_usdc,
        user:users!posts_user_id_fkey (
          id,
          username,
          display_name,
          avatar_url
        ),
        pool_deployments (
          pool_address,
          s_long_supply,
          s_short_supply,
          sqrt_price_long_x96,
          sqrt_price_short_x96,
          r_long,
          r_short
        )
      `)
      .in('id', postIds);

    if (postsError) {
      return NextResponse.json({ error: 'Failed to fetch posts', details: postsError }, { status: 500 });
    }

    // Fetch volume data per token side
    const { data: volumeData } = await supabase
      .from('trades')
      .select('post_id, side, usdc_amount')
      .in('post_id', postIds);

    // Aggregate volume by post + side
    const volumeMap = new Map<string, number>();
    (volumeData || []).forEach(trade => {
      const key = `${trade.post_id}-${trade.side}`;
      const current = volumeMap.get(key) || 0;
      volumeMap.set(key, current + (Number(trade.usdc_amount) / 1_000_000));
    });

    // Process each holding and compare with what pool metrics would show
    const comparisons = balances.map(balance => {
      const post = posts?.find(p => p.id === balance.post_id);
      if (!post) return null;

      const poolData = post.pool_deployments?.[0];

      // Calculate prices
      let priceLong = 0;
      let priceShort = 0;

      if (poolData?.sqrt_price_long_x96) {
        try {
          priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
        } catch (e) {
          console.error('Error calculating price_long:', e);
        }
      }

      if (poolData?.sqrt_price_short_x96) {
        try {
          priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
        } catch (e) {
          console.error('Error calculating price_short:', e);
        }
      }

      // Get volume for this token side
      const volumeKey = `${balance.post_id}-${balance.token_type}`;
      const tokenVolume = volumeMap.get(volumeKey) || 0;

      // Calculate relevance from reserves (what PoolMetricsCard does)
      const reserveLongUSDC = Number(poolData?.r_long || 0);
      const reserveShortUSDC = Number(poolData?.r_short || 0);
      const totalReserve = reserveLongUSDC + reserveShortUSDC;
      const relevanceFromReserves = totalReserve > 0 ? (reserveLongUSDC / totalReserve) * 100 : 50;

      // Calculate relevance from prices (what HoldingCard was doing BEFORE fix)
      const totalPrice = priceLong + priceShort;
      const relevanceFromPrices = totalPrice > 0 ? (priceLong / totalPrice) * 100 : 50;

      return {
        post_id: post.id,
        post_content: post.content_text?.substring(0, 50) || post.caption?.substring(0, 50) || 'No content',
        token_type: balance.token_type,
        token_balance: balance.token_balance,

        // Raw pool data
        raw_pool_data: {
          pool_address: poolData?.pool_address,
          sqrt_price_long_x96: poolData?.sqrt_price_long_x96,
          sqrt_price_short_x96: poolData?.sqrt_price_short_x96,
          r_long: poolData?.r_long,
          r_short: poolData?.r_short,
          s_long_supply: poolData?.s_long_supply,
          s_short_supply: poolData?.s_short_supply,
        },

        // Calculated values
        calculated_prices: {
          price_long: priceLong,
          price_short: priceShort,
        },

        // Volume data
        volume_data: {
          post_total_volume_usdc: post.total_volume_usdc,
          token_side_volume: tokenVolume,
          volume_map_key: volumeKey,
          all_trades_for_post: (volumeData || []).filter(t => t.post_id === balance.post_id).map(t => ({
            side: t.side,
            usdc_amount: Number(t.usdc_amount) / 1_000_000
          }))
        },

        // Relevance calculations
        relevance_calculations: {
          from_reserves_CORRECT: relevanceFromReserves,
          from_prices_WRONG: relevanceFromPrices,
          reserve_long: reserveLongUSDC,
          reserve_short: reserveShortUSDC,
          total_reserve: totalReserve,
        },

        // What holdings API returns
        holdings_api_returns: {
          token_volume_usdc: tokenVolume,
          pool: {
            price_long: priceLong,
            price_short: priceShort,
            r_long: reserveLongUSDC,
            r_short: reserveShortUSDC,
          }
        }
      };
    }).filter(Boolean);

    return NextResponse.json({
      username,
      user_id: user.id,
      total_holdings: balances.length,
      unique_posts: postIds.length,
      comparisons,
      volume_map_all_keys: Array.from(volumeMap.entries()).map(([key, value]) => ({ key, value })),
    });

  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json(
      { error: 'Internal error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
