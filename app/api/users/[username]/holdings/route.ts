/**
 * User Holdings API Route
 * GET /api/users/[username]/holdings
 * Returns token holdings for a user with post and pool data
 *
 * ICBS Version - Fetches prices from on-chain pool data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchPoolData } from '@/lib/solana/fetch-pool-data';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const { data: holdings, error: holdingsError } = await supabase
      .from('user_pool_balances')
      .select(`
        token_balance,
        total_usdc_spent,
        total_bought,
        total_sold,
        total_usdc_received,
        pool_address,
        post_id,
        posts:post_id (
          id,
          post_type,
          content_text,
          caption,
          media_urls,
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

    // Transform and calculate current values - fetch pool data from chain
    const transformedHoldings = await Promise.all(
      (holdings || []).map(async (holding: any) => {
        const post = holding.posts;
        const poolAddress = holding.pool_deployments?.pool_address;

        // Fetch current pool data from chain
        let poolData = null;
        let currentPrice = 0;
        let currentValueUsdc = 0;

        if (poolAddress) {
          try {
            poolData = await fetchPoolData(poolAddress);
            if (poolData) {
              // Use average of long/short prices for holdings display
              currentPrice = (poolData.priceLong + poolData.priceShort) / 2;
              currentValueUsdc = holding.token_balance * currentPrice;
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
            total_supply: poolData?.totalSupply || 0, // Already in display units from fetchPoolData
            vault_balance: poolData?.vaultBalance || 0,
          },
          balance: {
            token_balance: holding.token_balance,
            current_value_usdc: currentValueUsdc,
            total_usdc_spent: holding.total_usdc_spent,
            total_bought: holding.total_bought,
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
