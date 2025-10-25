/**
 * User Holdings API Route
 * GET /api/users/[username]/holdings
 * Returns token holdings for a user with post and pool data
 *
 * ICBS Version - Fetches prices from on-chain pool data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { fetchPoolData } from '@/lib/solana/fetch-pool-data';

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

    // Fetch user's holdings with post and pool data
    // NOTE: We don't fetch content_json to improve performance - it's not needed for holdings list
    const { data: positions, error: holdingsError } = await supabase
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
        posts:post_id (
          id,
          post_type,
          content_text,
          caption,
          media_urls,
          cover_image_url,
          article_title,
          user_id,
          created_at,
          users:user_id (
            username,
            display_name,
            avatar_url
          )
        ),
        pool_deployments:pool_address (
          pool_address
        )
      `)
      .eq('user_id', user.id)
      .gt('token_balance', 0);

    if (holdingsError) {
      console.error('Holdings fetch error:', holdingsError);
      return NextResponse.json(
        { error: 'Failed to fetch holdings' },
        { status: 500 }
      );
    }

    // Aggregate by pool (LONG + SHORT)
    interface HoldingEntry {
      pool_address: string;
      post_id: string;
      posts: unknown;
      pool_deployments: unknown;
      long_balance: number;
      short_balance: number;
      long_lock: number;
      short_lock: number;
      long_spent: number;
      short_spent: number;
      long_received: number;
      short_received: number;
      total_lock_usdc: number;
      last_trade_at: string;
    }

    const holdingsMap = new Map<string, HoldingEntry>();
    for (const pos of positions || []) {
      if (!holdingsMap.has(pos.pool_address)) {
        holdingsMap.set(pos.pool_address, {
          pool_address: pos.pool_address,
          post_id: pos.post_id,
          posts: pos.posts,
          pool_deployments: pos.pool_deployments,
          long_balance: 0,
          short_balance: 0,
          long_lock: 0,
          short_lock: 0,
          long_spent: 0,
          short_spent: 0,
          long_received: 0,
          short_received: 0,
          total_lock_usdc: 0,
          last_trade_at: pos.last_trade_at,
        });
      }

      const entry = holdingsMap.get(pos.pool_address);
      if (pos.token_type === 'LONG') {
        entry.long_balance = pos.token_balance;
        entry.long_lock = pos.belief_lock / 1_000_000;
        entry.long_spent = pos.total_usdc_spent / 1_000_000;
        entry.long_received = pos.total_usdc_received / 1_000_000;
      } else {
        entry.short_balance = pos.token_balance;
        entry.short_lock = pos.belief_lock / 1_000_000;
        entry.short_spent = pos.total_usdc_spent / 1_000_000;
        entry.short_received = pos.total_usdc_received / 1_000_000;
      }
      entry.total_lock_usdc = entry.long_lock + entry.short_lock;
      if (new Date(pos.last_trade_at) > new Date(entry.last_trade_at)) {
        entry.last_trade_at = pos.last_trade_at;
      }
    }

    const holdings = Array.from(holdingsMap.values());

    // Transform and calculate current values - fetch pool data from chain
    const transformedHoldings = await Promise.all(
      holdings.map(async (holding: HoldingEntry) => {
        const post = holding.posts;
        const poolAddress = holding.pool_deployments?.pool_address;

        // Fetch current pool data from chain
        let poolData = null;
        let currentPrice = 0;
        let currentValueUsdc = 0;

        if (poolAddress) {
          try {
            const rpcEndpoint = process.env.SOLANA_RPC_ENDPOINT || 'http://localhost:8899';
            poolData = await fetchPoolData(poolAddress, rpcEndpoint);
            if (poolData) {
              // Use average of long/short prices for holdings display
              currentPrice = (poolData.priceLong + poolData.priceShort) / 2;
              currentValueUsdc = holding.long_balance * poolData.priceLong + holding.short_balance * poolData.priceShort;
            }
          } catch (error) {
            console.warn(`Failed to fetch pool data for ${poolAddress}:`, error);
          }
        }

        return {
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
            author: {
              username: post?.users?.username || 'Unknown',
              display_name: post?.users?.display_name || post?.users?.username || 'Unknown',
              avatar_url: post?.users?.avatar_url || null,
            },
          },
          pool: {
            pool_address: poolAddress,
            price_long: poolData?.priceLong || 0,
            price_short: poolData?.priceShort || 0,
            current_price: currentPrice,
            supply_long: poolData?.supplyLong || 0, // Supply in display units
            supply_short: poolData?.supplyShort || 0,
            total_supply: poolData?.totalSupply || 0,
            vault_balance: poolData?.vaultBalance || 0,
            // ICBS parameters for trade simulation
            f: poolData?.f || 1,
            beta_num: poolData?.betaNum || 1,
            beta_den: poolData?.betaDen || 2,
          },
          balance: {
            long_balance: holding.long_balance,
            short_balance: holding.short_balance,
            total_lock_usdc: holding.total_lock_usdc,
            total_usdc_spent: holding.long_spent + holding.short_spent,
            total_usdc_received: holding.long_received + holding.short_received,
            current_value_usdc: currentValueUsdc,
            price_long: poolData?.priceLong || 0,
            price_short: poolData?.priceShort || 0,
          },
        };
      })
    );

    // Sort by current value (highest first)
    transformedHoldings.sort((a, b) =>
      b.balance.current_value_usdc - a.balance.current_value_usdc
    );

    return NextResponse.json({
      holdings: transformedHoldings,
    });

  } catch (error) {
    console.error('Holdings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
