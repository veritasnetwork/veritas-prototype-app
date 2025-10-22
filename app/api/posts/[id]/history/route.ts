import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch belief history (absolute BD relevance scores)
    const { data: beliefHistory, error: beliefError } = await supabase
      .from('belief_relevance_history')
      .select('epoch, aggregate, certainty, disagreement_entropy, recorded_at')
      .eq('post_id', params.id)
      .order('epoch', { ascending: true });

    if (beliefError) {
      console.error('Error fetching belief history:', beliefError);
    }

    // Fetch price history from trades (ICBS: track LONG and SHORT prices separately)
    const { data: priceHistory, error: priceError } = await supabase
      .from('trades')
      .select('side, sqrt_price_long_x96, sqrt_price_short_x96, price_long, price_short, s_long_after, s_short_after, recorded_at, trade_type, tx_signature')
      .eq('post_id', params.id)
      .order('recorded_at', { ascending: true });

    if (priceError) {
      console.error('Error fetching price history:', priceError);
    }

    // Transform trades into price snapshots (one entry per trade showing both LONG and SHORT prices)
    const transformedPriceHistory = (priceHistory || []).map((trade: any) => ({
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

    // Fetch trade history for this post
    const { data: tradeHistory, error: tradeError } = await supabase
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
      .eq('post_id', params.id)
      .order('recorded_at', { ascending: true });

    if (tradeError) {
      console.error('Error fetching trade history:', tradeError);
    }

    return NextResponse.json({
      belief_history: beliefHistory || [],
      price_history: transformedPriceHistory || [],
      trade_history: tradeHistory || []
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
