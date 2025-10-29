import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { TradeHistoryResponseSchema } from '@/types/api';
import { microToUsdc, asMicroUsdc } from '@/lib/units'; // Only used for usdc_amount

interface Trade {
  recorded_at: string;
  price_long: number | null;
  price_short: number | null;
  usdc_amount: string;
  token_amount: string;
  trade_type: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = getSupabaseServiceRole();
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
    let tradesQuery = supabase
      .from('trades')
      .select('recorded_at, price_long, price_short, usdc_amount, token_amount, trade_type, side')
      .eq('pool_address', poolData.pool_address)
      .order('recorded_at', { ascending: true });

    if (timeFilter) {
      tradesQuery = tradesQuery.gte('recorded_at', timeFilter);
    }

    // Fetch settlement prices for the same time range
    let settlementsQuery = supabase
      .from('settlements')
      .select('timestamp, price_long_after, price_short_after, epoch')
      .eq('pool_address', poolData.pool_address)
      .eq('confirmed', true)
      .order('timestamp', { ascending: true });

    if (timeFilter) {
      settlementsQuery = settlementsQuery.gte('timestamp', timeFilter);
    }

    const [
      { data: tradesData, error: tradesError },
      { data: settlementsData, error: settlementsError }
    ] = await Promise.all([tradesQuery, settlementsQuery]);

    if (tradesError) {
      console.error('Error fetching trades:', tradesError);
      return NextResponse.json(
        { error: 'Failed to fetch trades' },
        { status: 500 }
      );
    }

    if (settlementsError) {
      console.error('Error fetching settlements:', settlementsError);
      // Non-fatal - continue with just trades
    }

    const trades = tradesData as Trade[] | null;
    const settlements = settlementsData as Array<{
      timestamp: string;
      price_long_after: number | null;
      price_short_after: number | null;
      epoch: number;
    }> | null;

    if (!trades || trades.length === 0) {
      return NextResponse.json({
        priceLongData: [],
        priceShortData: [],
        volumeData: [],
        stats: {
          totalVolume: 0,
          totalTrades: 0,
          highestPrice: 0,
          lowestPrice: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0,
          highestPriceLong: 0,
          lowestPriceLong: 0,
          priceChangeLong24h: 0,
          priceChangePercentLong24h: 0,
          highestPriceShort: 0,
          lowestPriceShort: 0,
          priceChangeShort24h: 0,
          priceChangePercentShort24h: 0
        }
      });
    }

    // Transform trades to chart format using stored sqrt prices
    // Split LONG and SHORT prices into separate series for ICBS two-sided markets
    const validTrades = trades.filter((trade) => {
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
    });

    // Combine trades and settlements for price history
    // Settlements represent price changes due to rebases
    const validSettlements = (settlements || []).filter((s) =>
      s.price_long_after !== null && s.price_short_after !== null &&
      s.price_long_after > 0 && s.price_short_after > 0
    );

    // Separate price series for LONG and SHORT tokens
    // Prices are stored in USDC (display units) as per spec
    const tradePriceLongData = validTrades.map((trade, index) => {
      const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001; // Add small offset for duplicates
      return {
        time: uniqueTime,
        value: trade.price_long!,
      };
    });

    const settlementPriceLongData = validSettlements.map((settlement, index) => {
      const baseTime = Math.floor(new Date(settlement.timestamp).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001;
      return {
        time: uniqueTime,
        value: settlement.price_long_after!,
      };
    });

    const tradePriceShortData = validTrades.map((trade, index) => {
      const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001;
      return {
        time: uniqueTime,
        value: trade.price_short!,
      };
    });

    const settlementPriceShortData = validSettlements.map((settlement, index) => {
      const baseTime = Math.floor(new Date(settlement.timestamp).getTime() / 1000);
      const uniqueTime = baseTime + index * 0.001;
      return {
        time: uniqueTime,
        value: settlement.price_short_after!,
      };
    });

    // Merge and sort by time
    const priceLongData = [...tradePriceLongData, ...settlementPriceLongData]
      .sort((a, b) => a.time - b.time);

    const priceShortData = [...tradePriceShortData, ...settlementPriceShortData]
      .sort((a, b) => a.time - b.time);

    // Volume data split by side (LONG vs SHORT)
    const volumeData = trades
      .filter((trade) => trade.price_long !== null && trade.price_short !== null && trade.side)
      .map((trade, index) => {
        // Handle duplicate timestamps
        const baseTime = Math.floor(new Date(trade.recorded_at).getTime() / 1000);
        const uniqueTime = baseTime + index * 0.001;

        // usdc_amount is stored in micro-USDC (atomic units), convert to USDC (display units)
        const usdcAmount = microToUsdc(asMicroUsdc(Math.round(parseFloat(trade.usdc_amount))));

        return {
          time: uniqueTime,
          value: usdcAmount,
          // Light blue for LONG, Orange for SHORT
          color: trade.side === 'LONG' ? 'rgba(185, 217, 235, 0.8)' : 'rgba(249, 115, 22, 0.8)'
        };
      });

    // Calculate stats for LONG and SHORT separately
    const priceLongValues = priceLongData.map((d: { value: number }) => d.value);
    const priceShortValues = priceShortData.map((d: { value: number }) => d.value);

    // Calculate volumes by side
    // usdc_amount is already stored in micro-USDC in the database, so just convert to display units
    const totalVolume = trades.reduce((sum: number, trade: Trade) => {
      const microAmount = parseFloat(trade.usdc_amount);
      // Filter out clearly bad data (amounts less than 1 micro-USDC are likely errors)
      if (microAmount < 1) return sum;
      return sum + (microAmount / 1_000_000);
    }, 0);

    const volumeLong = trades
      .filter((t: Trade) => t.side === 'LONG')
      .reduce((sum: number, trade: Trade) => {
        const microAmount = parseFloat(trade.usdc_amount);
        if (microAmount < 1) return sum;
        return sum + (microAmount / 1_000_000);
      }, 0);

    const volumeShort = trades
      .filter((t: Trade) => t.side === 'SHORT')
      .reduce((sum: number, trade: Trade) => {
        const microAmount = parseFloat(trade.usdc_amount);
        if (microAmount < 1) return sum;
        return sum + (microAmount / 1_000_000);
      }, 0);

    // LONG stats
    const highestPriceLong = priceLongValues.length > 0 ? Math.max(...priceLongValues) : 0;
    const lowestPriceLong = priceLongValues.length > 0 ? Math.min(...priceLongValues) : 0;
    const currentPriceLong = priceLongValues.length > 0 ? priceLongValues[priceLongValues.length - 1] : 0;

    // SHORT stats
    const highestPriceShort = priceShortValues.length > 0 ? Math.max(...priceShortValues) : 0;
    const lowestPriceShort = priceShortValues.length > 0 ? Math.min(...priceShortValues) : 0;
    const currentPriceShort = priceShortValues.length > 0 ? priceShortValues[priceShortValues.length - 1] : 0;

    // Calculate 24h price change for LONG
    const now24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const trades24h = validTrades.filter((t: Trade) => new Date(t.recorded_at) >= now24hAgo);
    const priceChangeLong24h = trades24h.length > 0 && priceLongValues.length > 0
      ? priceLongValues[priceLongValues.length - 1] - priceLongValues[Math.max(0, priceLongValues.length - trades24h.length)]
      : 0;
    const priceChangePercentLong24h = trades24h.length > 0 && priceLongValues.length > 1 && priceLongValues[Math.max(0, priceLongValues.length - trades24h.length)] > 0
      ? (priceChangeLong24h / priceLongValues[Math.max(0, priceLongValues.length - trades24h.length)]) * 100
      : 0;

    // Calculate 24h price change for SHORT
    const priceChangeShort24h = trades24h.length > 0 && priceShortValues.length > 0
      ? priceShortValues[priceShortValues.length - 1] - priceShortValues[Math.max(0, priceShortValues.length - trades24h.length)]
      : 0;
    const priceChangePercentShort24h = trades24h.length > 0 && priceShortValues.length > 1 && priceShortValues[Math.max(0, priceShortValues.length - trades24h.length)] > 0
      ? (priceChangeShort24h / priceShortValues[Math.max(0, priceShortValues.length - trades24h.length)]) * 100
      : 0;

    const response = {
      priceLongData,
      priceShortData,
      volumeData,
      stats: {
        totalVolume,
        totalTrades: trades.length,
        volumeLong,
        volumeShort,
        // LONG stats
        currentPriceLong,
        highestPriceLong,
        lowestPriceLong,
        priceChangeLong24h,
        priceChangePercentLong24h,
        // SHORT stats
        currentPriceShort,
        highestPriceShort,
        lowestPriceShort,
        priceChangeShort24h,
        priceChangePercentShort24h,
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
