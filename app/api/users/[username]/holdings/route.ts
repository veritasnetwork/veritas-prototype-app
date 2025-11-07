/**
 * Simplified Holdings API Route
 * GET /api/users/[username]/holdings
 *
 * Uses the same methodology as pool metrics:
 * - Fetch posts with pool_deployments joined
 * - Calculate prices using sqrtPriceX96ToPrice
 * - Filter for user's positions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { sqrtPriceX96ToPrice } from '@/lib/solana/sqrt-price-helpers';

export async function GET(
  request: NextRequest,
  context: { params: { username: string } } | { params: Promise<{ username: string }> }
) {
  try {
    const params = 'then' in context.params ? await context.params : context.params;
    const { username } = params;

    if (!username || username === 'undefined') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
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
      return NextResponse.json(
        { error: 'Failed to fetch holdings', details: balancesError.message },
        { status: 500 }
      );
    }

    if (!balances || balances.length === 0) {
      return NextResponse.json({
        holdings: [],
        pagination: { total: 0, limit: 10, offset: 0, hasMore: false }
      });
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
      console.error('[Holdings API] Error fetching posts:', postsError);
      return NextResponse.json(
        { error: 'Failed to fetch post data', details: postsError.message },
        { status: 500 }
      );
    }

    // Create post lookup map
    const postsMap = new Map(posts?.map(p => [p.id, p]) || []);

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

    // Transform holdings
    const holdings = balances.map(balance => {
      const post = postsMap.get(balance.post_id);
      if (!post) {
        return null; // Skip if post not found
      }

      const poolData = post.pool_deployments?.[0];
      const userData = Array.isArray(post.user) ? post.user[0] : post.user;

      // Calculate prices - EXACT same method as /api/posts/[id]
      let priceLong = 0;
      let priceShort = 0;

      if (poolData?.sqrt_price_long_x96) {
        try {
          priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
        } catch (e) {
          console.error('[Holdings API] Error calculating price_long:', e);
        }
      }

      if (poolData?.sqrt_price_short_x96) {
        try {
          priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
        } catch (e) {
          console.error('[Holdings API] Error calculating price_short:', e);
        }
      }

      const currentPrice = balance.token_type === 'LONG' ? priceLong : priceShort;
      const currentValue = balance.token_balance * currentPrice;

      // Get volume for this token side
      const volumeKey = `${balance.post_id}-${balance.token_type}`;
      const tokenVolume = volumeMap.get(volumeKey) || 0;

      return {
        token_type: balance.token_type,
        post: {
          id: post.id,
          post_type: post.post_type || 'text',
          content_text: post.content_text,
          caption: post.caption,
          media_urls: post.media_urls,
          cover_image_url: post.cover_image_url,
          article_title: post.article_title,
          created_at: post.created_at,
          token_volume_usdc: tokenVolume,
          author: {
            username: userData?.username || 'Unknown',
            display_name: userData?.display_name,
            avatar_url: userData?.avatar_url
          }
        },
        pool: poolData ? {
          pool_address: poolData.pool_address,
          supply_long: Number(poolData.s_long_supply || 0) / 1_000_000,
          supply_short: Number(poolData.s_short_supply || 0) / 1_000_000,
          price_long: priceLong,
          price_short: priceShort,
          r_long: Number(poolData.r_long || 0),
          r_short: Number(poolData.r_short || 0)
        } : null,
        holdings: {
          token_balance: balance.token_balance,
          current_value_usdc: currentValue,
          total_usdc_spent: Number(balance.total_usdc_spent || 0) / 1_000_000,
          total_usdc_received: Number(balance.total_usdc_received || 0) / 1_000_000,
          belief_lock: Number(balance.belief_lock || 0) / 1_000_000,
          current_price: currentPrice,
          entry_price: 0
        }
      };
    }).filter(Boolean); // Remove nulls

    // Sort by value
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
    console.error('[Holdings API] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}