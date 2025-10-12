import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface Trade {
  recorded_at: string;
  reserve_after: number;
  token_supply_after: number;
  k_quadratic: number;
  usdc_amount: string;
  token_amount: string;
  trade_type: 'buy' | 'sell';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { id: postId } = await params;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('range') || 'ALL';

    // Get pool address for this post
    const { data: poolData, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('post_id', postId)
      .single();

    if (poolError || !poolData) {
      return NextResponse.json(
        { error: 'Pool not found for this post' },
        { status: 404 }
      );
    }

    // Calculate time filter based on range
    let timeFilter: string | null = null;
    const now = new Date();

    switch (timeRange) {
      case '1H':
        timeFilter = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        break;
      case '24H':
        timeFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        break;
      case '7D':
        timeFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'ALL':
      default:
        timeFilter = null;
    }

    // Fetch trades and calculate prices
    let query = supabase
      .from('trades')
      .select('recorded_at, reserve_after, token_supply_after, k_quadratic, usdc_amount, token_amount, trade_type')
      .eq('pool_address', poolData.pool_address)
      .order('recorded_at', { ascending: true });

    if (timeFilter) {
      query = query.gte('recorded_at', timeFilter);
    }

    const { data: tradesData, error: tradesError } = await query;

    if (tradesError) {
      console.error('Error fetching trades:', tradesError);
      return NextResponse.json(
        { error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }

    const trades = tradesData as Trade[] | null;

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        priceData: [],
        volumeData: [],
        stats: {
          totalVolume: 0,
          totalTrades: 0,
          highestPrice: 0,
          lowestPrice: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0
        }
      });
    }

    // Import the correct calculation function
    const { calculateTokenPrice } = await import('@/lib/solana/bonding-curve');

    // Transform trades to chart format
    // IMPORTANT: The trades table has incorrect historical data from a bug in the
    // account deserialization (wrong byte offsets). We need to validate the data.
    const RATIO_PRECISION = 1_000_000;
    const MAX_REASONABLE_TOKEN_SUPPLY = 1_000_000_000; // 1 billion tokens max
    const MAX_REASONABLE_K = 1_000_000_000; // k should be small

    const priceData = trades.map((trade, index) => {
      const tokenSupply = Number(trade.token_supply_after);
      const kQuadratic = Number(trade.k_quadratic);

      // Validate data - if values are unreasonably large, it's bad data from the bug
      const isValidData = tokenSupply < MAX_REASONABLE_TOKEN_SUPPLY &&
                          kQuadratic < MAX_REASONABLE_K &&
                          tokenSupply > 0;

      let price: number;
      if (isValidData) {
        // Use the same calculation as the Pool Metrics card
        price = calculateTokenPrice(tokenSupply, kQuadratic);
      } else {
        // Bad data - use a placeholder or skip (log only in development)
        if (process.env.NODE_ENV === 'development') {
          console.warn('[TRADES API] Skipping invalid trade data:', {
            token_supply: tokenSupply,
            k_quadratic: kQuadratic,
            recorded_at: trade.recorded_at
          });
        }
        price = 0; // Will filter out later
      }

      // Handle duplicate timestamps by adding milliseconds
      const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001; // Add small offset for duplicates

      return {
        time: uniqueTime,
        value: price,
        isValid: isValidData
      };
    }).filter(d => d.isValid && d.value > 0) // Filter out invalid data
    .map(({ time, value }) => ({ time, value })); // Remove isValid field

    const volumeData = trades.filter((trade) => {
      // Check if this trade has valid data
      const tokenSupply = Number(trade.token_supply_after);
      const kQuadratic = Number(trade.k_quadratic);
      return tokenSupply < MAX_REASONABLE_TOKEN_SUPPLY &&
             kQuadratic < MAX_REASONABLE_K &&
             tokenSupply > 0;
    }).map((trade, index) => {
      // Handle duplicate timestamps
      const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001;

      return {
        time: uniqueTime,
        value: parseFloat(trade.usdc_amount) / 1e6, // Convert micro-USDC to USDC
        color: trade.trade_type === 'buy' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)' // green for buy, red for sell
      };
    });

    // Calculate stats
    const prices = priceData.map((d: { value: number }) => d.value);
    const totalVolume = trades.reduce((sum: number, trade: Trade) => sum + parseFloat(trade.usdc_amount) / 1e6, 0);
    const highestPrice = Math.max(...prices);
    const lowestPrice = Math.min(...prices);

    // Calculate 24h price change
    const now24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const trades24h = trades.filter((t: Trade) => new Date(t.recorded_at) >= now24hAgo);
    const priceChange24h = trades24h.length > 0
      ? prices[prices.length - 1] - prices[Math.max(0, prices.length - trades24h.length)]
      : 0;
    const priceChangePercent24h = trades24h.length > 0 && prices[Math.max(0, prices.length - trades24h.length)] > 0
      ? (priceChange24h / prices[Math.max(0, prices.length - trades24h.length)]) * 100
      : 0;

    return NextResponse.json({
      priceData,
      volumeData,
      stats: {
        totalVolume,
        totalTrades: trades.length,
        highestPrice,
        lowestPrice,
        currentPrice: prices[prices.length - 1] || 0,
        priceChange24h,
        priceChangePercent24h
      }
    });

  } catch (error) {
    console.error('Trade history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
