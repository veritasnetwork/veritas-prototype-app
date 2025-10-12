/**
 * Record Trade API Route
 * POST /api/trades/record
 * Records buy/sell trades and updates user_pool_balances via trigger
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      pool_address,
      post_id,
      wallet_address,
      trade_type,
      token_amount,
      usdc_amount,
      token_supply_after,
      reserve_after,
      k_quadratic,
      tx_signature
    } = body;

    // Validate required fields
    if (!user_id || !pool_address || !post_id || !wallet_address || !trade_type ||
        !token_amount || !usdc_amount || token_supply_after === undefined ||
        reserve_after === undefined || k_quadratic === undefined || !tx_signature) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate trade_type
    if (trade_type !== 'buy' && trade_type !== 'sell') {
      return NextResponse.json(
        { error: 'trade_type must be "buy" or "sell"' },
        { status: 400 }
      );
    }

    console.log(`[API] Recording ${trade_type} trade:`, {
      user_id,
      pool_address,
      token_amount,
      usdc_amount,
      tx_signature
    });

    // Insert trade (trigger will update user_pool_balances automatically)
    const { data: trade, error } = await supabase
      .from('trades')
      .insert({
        user_id,
        pool_address,
        post_id,
        wallet_address,
        trade_type,
        token_amount: parseFloat(token_amount),
        usdc_amount: parseFloat(usdc_amount),
        token_supply_after: parseFloat(token_supply_after),
        reserve_after: parseFloat(reserve_after),
        k_quadratic: parseFloat(k_quadratic),
        tx_signature,
        recorded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('[API] Failed to insert trade:', error);

      // Check for duplicate tx_signature
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Trade already recorded (duplicate tx_signature)' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('[API] Trade recorded successfully:', trade.id);

    return NextResponse.json({
      success: true,
      trade_id: trade.id
    });

  } catch (error) {
    console.error('[API] Trade recording error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
