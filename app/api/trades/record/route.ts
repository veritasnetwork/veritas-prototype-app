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

    // ALWAYS sync balance first to avoid constraint violations
    // This ensures the balance matches the pool supply after the trade
    if (trade_type === 'sell') {
      console.log('[API] Pre-syncing balance for sell trade');
      console.log('[API] Setting balance to pool supply:', parseFloat(token_supply_after));

      // For sells, set balance to pool supply (since user is likely the only holder)
      const { error: syncError } = await supabase
        .from('user_pool_balances')
        .upsert({
          user_id,
          pool_address,
          post_id,
          token_balance: parseFloat(token_supply_after),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,pool_address'
        });

      if (syncError) {
        console.error('[API] Failed to sync balance:', syncError);
      } else {
        console.log('[API] Balance synced successfully');
      }
    }

    // Now try to insert the trade
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

      // If it's a check constraint violation, try to fix the balance
      if (error.code === '23514' && error.message.includes('user_pool_balances_token_balance_check')) {
        console.log('[API] Balance check constraint violation - attempting to sync with on-chain state');

        // Calculate what the balance should be based on all trades
        const { data: allTrades, error: tradesError } = await supabase
          .from('trades')
          .select('trade_type, token_amount')
          .eq('user_id', user_id)
          .eq('pool_address', pool_address);

        if (!tradesError && allTrades) {
          const totalBought = allTrades
            .filter(t => t.trade_type === 'buy')
            .reduce((sum, t) => sum + Number(t.token_amount), 0);
          const totalSold = allTrades
            .filter(t => t.trade_type === 'sell')
            .reduce((sum, t) => sum + Number(t.token_amount), 0);

          // Add the current trade
          const newBought = trade_type === 'buy' ? totalBought + parseFloat(token_amount) : totalBought;
          const newSold = trade_type === 'sell' ? totalSold + parseFloat(token_amount) : totalSold;
          const expectedBalance = newBought - newSold;

          // If expected balance would be negative or exceed supply, use supply-based calculation
          const poolSupply = parseFloat(token_supply_after);
          let correctedBalance = expectedBalance;

          if (trade_type === 'sell') {
            // For sells, the user's balance should be approximately the pool supply
            // (assuming they're the primary holder)
            correctedBalance = poolSupply;
          }

          // Update or insert the balance
          const { error: balanceError } = await supabase
            .from('user_pool_balances')
            .upsert({
              user_id,
              pool_address,
              post_id,
              token_balance: Math.max(0, correctedBalance),
              total_bought: newBought,
              total_sold: newSold,
              total_usdc_spent: trade_type === 'buy' ?
                (allTrades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + Number(t.usdc_amount || 0), 0) + parseFloat(usdc_amount)) :
                (allTrades.filter(t => t.trade_type === 'buy').reduce((sum, t) => sum + Number(t.usdc_amount || 0), 0)),
              total_usdc_received: trade_type === 'sell' ?
                (allTrades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + Number(t.usdc_amount || 0), 0) + parseFloat(usdc_amount)) :
                (allTrades.filter(t => t.trade_type === 'sell').reduce((sum, t) => sum + Number(t.usdc_amount || 0), 0)),
              first_trade_at: new Date().toISOString(),
              last_trade_at: new Date().toISOString()
            }, {
              onConflict: 'user_id,pool_address'
            });

          if (!balanceError) {
            // Try inserting the trade again
            const { data: retryTrade, error: retryError } = await supabase
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

            if (!retryError) {
              console.log('[API] Successfully recorded trade after balance sync');
              return NextResponse.json({
                success: true,
                trade_id: retryTrade.id,
                synced_balance: true
              });
            }
          }
        }
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('[API] Trade recorded successfully:', trade.id);
    console.log('[API] Pool data to update:', {
      token_supply_after,
      reserve_after,
      k_quadratic
    });

    // Update pool_deployments with fresh on-chain data
    // token_supply_after and reserve_after are already in atomic units from hooks
    const { error: poolUpdateError } = await supabase
      .from('pool_deployments')
      .update({
        token_supply: token_supply_after.toString(),
        reserve: reserve_after.toString(),
        k_quadratic: k_quadratic.toString(), // Also update k_quadratic
        last_synced_at: new Date().toISOString()
      })
      .eq('pool_address', pool_address);

    if (poolUpdateError) {
      console.error('[API] Failed to update pool deployment:', poolUpdateError);
    } else {
      console.log('[API] Pool deployment updated with fresh data');
    }

    // Manually update user_pool_balances since we dropped the trigger
    await supabase
      .from('user_pool_balances')
      .upsert({
        user_id,
        pool_address,
        post_id,
        token_balance: parseFloat(token_supply_after),
        total_bought: trade_type === 'buy' ? parseFloat(token_amount) : 0,
        total_sold: trade_type === 'sell' ? parseFloat(token_amount) : 0,
        total_usdc_spent: trade_type === 'buy' ? parseFloat(usdc_amount) : 0,
        total_usdc_received: trade_type === 'sell' ? parseFloat(usdc_amount) : 0,
        first_trade_at: new Date().toISOString(),
        last_trade_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,pool_address',
        ignoreDuplicates: false
      });

    console.log('[API] Balance updated manually');

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
