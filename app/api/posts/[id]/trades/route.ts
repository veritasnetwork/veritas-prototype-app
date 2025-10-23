import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TradeHistoryResponseSchema } from '@/types/api';

interface Trade {
  recorded_at: string;
  price_long: number | null;
  price_short: number | null;
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

    // Fetch trades with sqrt prices from database
    let query = supabase
      .from('trades')
      .select('recorded_at, price_long, price_short, usdc_amount, token_amount, trade_type')
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

    // Transform trades to chart format using stored sqrt prices
    // Use average of long/short prices for the chart
    const priceData = trades
      .filter((trade) => {
        // Only include trades that have valid price data
        const hasValidPrice = trade.price_long !== null && trade.price_short !== null &&
                             trade.price_long > 0 && trade.price_short > 0;
        if (!hasValidPrice && process.env.NODE_ENV === 'development') {
          console.warn('[TRADES API] Skipping trade without sqrt prices:', {
            recorded_at: trade.recorded_at,
            price_long: trade.price_long,
            price_short: trade.price_short
          });
        }
        return hasValidPrice;
      })
      .map((trade, index) => {
        // Average of long and short prices for display
        const avgPrice = ((trade.price_long! + trade.price_short!) / 2);

        // Handle duplicate timestamps by adding milliseconds
        const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
        const uniqueTime = baseTime + index * 0.001; // Add small offset for duplicates

        return {
          time: uniqueTime,
          value: avgPrice,
        };
      });

    const volumeData = trades
      .filter((trade) => trade.price_long !== null && trade.price_short !== null)
      .map((trade, index) => {
        // Handle duplicate timestamps
        const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
        const uniqueTime = baseTime + index * 0.001;

        return {
          time: uniqueTime,
          value: parseFloat(trade.usdc_amount),
          color: trade.trade_type === 'buy' ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)' // green for buy, red for sell
        };
      });

    // Calculate stats
    const prices = priceData.map((d: { value: number }) => d.value);
    const totalVolume = trades.reduce((sum: number, trade: Trade) => sum + parseFloat(trade.usdc_amount), 0);
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

    const response = {
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
    };

    // Validate response with Zod schema
    try {
      const validated = TradeHistoryResponseSchema.parse(response);
      return NextResponse.json(validated);
    } catch (validationError) {
      console.error('[Trades API] Schema validation failed:', validationError);
      // In development, return unvalidated data with warning
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Trades API] Returning unvalidated data in development mode');
        return NextResponse.json(response);
      }
      // In production, fail
      return NextResponse.json(
        { error: 'Data validation failed' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Trade history API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
