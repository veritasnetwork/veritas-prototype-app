import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAnon } from '@/lib/supabase-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const supabase = getSupabaseAnon();

    // Parse query params to optimize data fetching
    const { searchParams } = new URL(req.url);
    const include = searchParams.get('include'); // 'relevance', 'price', 'all'
    const includeRelevance = !include || include === 'relevance' || include === 'all';
    const includePrice = include === 'price' || include === 'all';

    // Build parallel queries based on what's requested
    const queries = [];

    if (includeRelevance) {
      // Fetch belief history (absolute BD relevance scores)
      queries.push(
        supabase
          .from('belief_relevance_history')
          .select('epoch, aggregate, certainty, disagreement_entropy, recorded_at')
          .eq('post_id', postId)
          .order('epoch', { ascending: true })
      );

      // Fetch implied relevance history (market-predicted relevance from reserves)
      queries.push(
        supabase
          .from('implied_relevance_history')
          .select('implied_relevance, reserve_long, reserve_short, event_type, recorded_at')
          .eq('post_id', postId)
          .order('recorded_at', { ascending: true })
      );
    } else {
      // Push null placeholders to maintain array indices
      queries.push(Promise.resolve({ data: [], error: null }));
      queries.push(Promise.resolve({ data: [], error: null }));
    }

    if (includePrice) {
      // Fetch price history from trades (ICBS: track LONG and SHORT prices separately)
      queries.push(
        supabase
          .from('trades')
          .select('side, sqrt_price_long_x96, sqrt_price_short_x96, price_long, price_short, s_long_after, s_short_after, recorded_at, trade_type, tx_signature')
          .eq('post_id', postId)
          .order('recorded_at', { ascending: true })
      );

      // Fetch trade history for this post
      queries.push(
        supabase
          .from('trades')
          .select(`
            id,
            trade_type,
            token_amount,
            usdc_amount,
            recorded_at,
            tx_signature,
            users:user_id (
              username,
              display_name
            )
          `)
          .eq('post_id', postId)
          .order('recorded_at', { ascending: true })
      );
    } else {
      queries.push(Promise.resolve({ data: [], error: null }));
      queries.push(Promise.resolve({ data: [], error: null }));
    }

    // Execute all queries in parallel
    const [
      { data: beliefHistory, error: beliefError },
      { data: impliedHistory, error: impliedError },
      { data: priceHistory, error: priceError },
      { data: tradeHistory, error: tradeError }
    ] = await Promise.all(queries);

    if (beliefError) {
      console.error('Error fetching belief history:', beliefError);
    }
    if (impliedError) {
      console.error('Error fetching implied relevance history:', impliedError);
    }
    if (priceError) {
      console.error('Error fetching price history:', priceError);
    }
    if (tradeError) {
      console.error('Error fetching trade history:', tradeError);
    }

    // Transform trades into price snapshots (one entry per trade showing both LONG and SHORT prices)
    const transformedPriceHistory = (priceHistory || []).map((trade: {
      side: string;
      sqrt_price_long_x96: string;
      sqrt_price_short_x96: string;
      price_long: number;
      price_short: number;
      s_long_after: number;
      s_short_after: number;
      recorded_at: string;
    }) => ({
      side: trade.side,
      sqrt_price_long_x96: trade.sqrt_price_long_x96,
      sqrt_price_short_x96: trade.sqrt_price_short_x96,
      price_long: trade.price_long,
      price_short: trade.price_short,
      supply_long: trade.s_long_after,
      supply_short: trade.s_short_after,
      recorded_at: trade.recorded_at,
      triggered_by: trade.trade_type,
      tx_signature: trade.tx_signature
    }));

    return NextResponse.json(
      {
        belief_history: beliefHistory || [],
        implied_relevance_history: impliedHistory || [],
        price_history: transformedPriceHistory || [],
        trade_history: tradeHistory || []
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=5, stale-while-revalidate=10',
        }
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
