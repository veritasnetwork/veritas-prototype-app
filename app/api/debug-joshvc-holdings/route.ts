import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET() {
  const supabase = getSupabaseServiceRole();

  // Get joshvc's user ID
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
    .gt('token_balance', 0);

  // Get one pool's data to debug
  const testPoolAddress = '3XPm13mYXQtceBiVv7afTz9LscEypRSp5QMXjyV166sE';

  const { data: pool } = await supabase
    .from('pool_deployments')
    .select('*')
    .eq('pool_address', testPoolAddress)
    .single();

  // Test price calculation
  const calculatePriceFromSqrt = (sqrtPriceX96String: string | null): number => {
    if (!sqrtPriceX96String) return 0;

    try {
      const sqrtPrice = BigInt(sqrtPriceX96String);
      const Q96 = BigInt(2) ** BigInt(96);

      // Square the sqrt price to get price * 2^192
      const priceX192 = sqrtPrice * sqrtPrice;

      // Divide by 2^192 to get price in lamports
      const priceX96 = priceX192 / Q96;
      const priceLamports = priceX96 / Q96;

      // Convert from lamports to USDC
      const price = Number(priceLamports) / 1000000;

      return price;
    } catch (e) {
      return -1; // Return -1 to indicate error
    }
  };

  let priceLong = 0;
  let priceShort = 0;

  if (pool) {
    priceLong = pool.cached_price_long
      ? Number(pool.cached_price_long)
      : calculatePriceFromSqrt(pool.sqrt_price_long_x96);

    priceShort = pool.cached_price_short
      ? Number(pool.cached_price_short)
      : calculatePriceFromSqrt(pool.sqrt_price_short_x96);
  }

  // Now test the actual API endpoint
  const apiResponse = await fetch('https://app.veritas.computer/api/users/joshvc/holdings');
  const apiData = await apiResponse.json();

  return NextResponse.json({
    user_id: user.id,
    balances_count: balances?.length || 0,
    balances: balances?.map(b => ({
      pool: b.pool_address?.slice(0, 8) + '...',
      type: b.token_type,
      balance: b.token_balance
    })),
    test_pool: {
      address: testPoolAddress.slice(0, 8) + '...',
      sqrt_price_long_x96: pool?.sqrt_price_long_x96,
      sqrt_price_short_x96: pool?.sqrt_price_short_x96,
      calculated_price_long: priceLong,
      calculated_price_short: priceShort,
      cached_price_long: pool?.cached_price_long,
      cached_price_short: pool?.cached_price_short,
      r_long: pool?.r_long,
      r_short: pool?.r_short
    },
    api_response: {
      holdings_count: apiData.holdings?.length || 0,
      first_holding: apiData.holdings?.[0] ? {
        token_type: apiData.holdings[0].token_type,
        pool_prices: apiData.holdings[0].pool,
        holdings_data: apiData.holdings[0].holdings
      } : null,
      error: apiData.error
    }
  });
}