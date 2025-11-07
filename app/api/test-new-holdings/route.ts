import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { sqrtPriceX96ToPrice } from '@/lib/solana/sqrt-price-helpers';

export async function GET() {
  const supabase = getSupabaseServiceRole();

  // Get joshvc
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', 'joshvc')
    .single();

  if (!user) {
    return NextResponse.json({ error: 'User not found' });
  }

  // Get balances
  const { data: balances } = await supabase
    .from('user_pool_balances')
    .select('*')
    .eq('user_id', user.id)
    .gt('token_balance', 0)
    .limit(2); // Just test with 2

  if (!balances || balances.length === 0) {
    return NextResponse.json({ error: 'No balances' });
  }

  const postIds = [...new Set(balances.map(b => b.post_id))];

  // NEW APPROACH: Fetch posts with pool_deployments joined
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(`
      id,
      pool_deployments (
        pool_address,
        sqrt_price_long_x96,
        sqrt_price_short_x96,
        r_long,
        r_short
      )
    `)
    .in('id', postIds);

  if (postsError) {
    return NextResponse.json({
      error: 'Posts query failed',
      details: postsError.message,
      postIds
    });
  }

  // Calculate prices
  const result = (posts || []).map(post => {
    const poolData = post.pool_deployments?.[0];

    let priceLong = 0;
    let priceShort = 0;

    if (poolData?.sqrt_price_long_x96) {
      try {
        priceLong = sqrtPriceX96ToPrice(poolData.sqrt_price_long_x96);
      } catch (e) {}
    }

    if (poolData?.sqrt_price_short_x96) {
      try {
        priceShort = sqrtPriceX96ToPrice(poolData.sqrt_price_short_x96);
      } catch (e) {}
    }

    return {
      post_id: post.id,
      pool_address: poolData?.pool_address,
      has_pool_data: !!poolData,
      prices: {
        long: priceLong,
        short: priceShort
      },
      reserves: {
        r_long: poolData?.r_long,
        r_short: poolData?.r_short
      }
    };
  });

  return NextResponse.json({
    success: true,
    balances_count: balances.length,
    posts_fetched: posts?.length || 0,
    results: result
  });
}