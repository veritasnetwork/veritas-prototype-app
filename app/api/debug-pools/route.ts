import { NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';

export async function GET() {
  const supabase = getSupabaseServiceRole();

  // Get the pools that joshvc has holdings in
  const poolAddresses = [
    '3XPm13mYXQtceBiVv7afTz9LscEypRSp5QMXjyV166sE',
    '45NMjDDnfNpK1Mi69js234xk6CrfJEZccpBjtFxB89Fe',
    'FoT59wEDsz4Froyi2DYj1ijCkjoLd3fHL8X67ZK3i1XA'
  ];

  // Query pool deployments
  const { data: pools, error: poolsError } = await supabase
    .from('pool_deployments')
    .select(`
      pool_address,
      cached_price_long,
      cached_price_short,
      s_long_supply,
      s_short_supply,
      prices_last_updated_at,
      r_long,
      r_short,
      sqrt_price_long_x96,
      sqrt_price_short_x96
    `)
    .in('pool_address', poolAddresses);

  if (poolsError) {
    return NextResponse.json({ error: poolsError.message }, { status: 500 });
  }

  // Also fetch implied_relevance_history for these pools
  const { data: relevance } = await supabase
    .from('implied_relevance_history')
    .select('pool_address, implied_relevance, recorded_at')
    .in('pool_address', poolAddresses)
    .order('recorded_at', { ascending: false });

  return NextResponse.json({
    pools: pools?.map(p => ({
      ...p,
      cached_price_long: p.cached_price_long ? Number(p.cached_price_long) : null,
      cached_price_short: p.cached_price_short ? Number(p.cached_price_short) : null,
      r_long: p.r_long ? Number(p.r_long) : null,
      r_short: p.r_short ? Number(p.r_short) : null,
    })),
    relevance: relevance || [],
    debug: {
      poolCount: pools?.length || 0,
      hasNullPrices: pools?.some(p => !p.cached_price_long || !p.cached_price_short),
      hasPrices: pools?.some(p => p.cached_price_long && p.cached_price_short),
    }
  });
}