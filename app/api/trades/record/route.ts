/**
 * Trade Recording API (Optimistic Updates)
 *
 * Records trades optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { PoolSyncService } from '@/services/pool-sync.service';

interface RecordTradeRequest {
  user_id: string;
  pool_address: string;
  post_id: string;
  wallet_address: string;
  trade_type: 'buy' | 'sell';
  side: 'LONG' | 'SHORT';
  token_amount: string;
  usdc_amount: string;
  tx_signature: string;

  // ICBS State Snapshots (BEFORE trade)
  s_long_before?: number;
  s_short_before?: number;

  // ICBS State Snapshots (AFTER trade)
  s_long_after?: number;
  s_short_after?: number;

  // Sqrt prices (AFTER trade)
  sqrt_price_long_x96?: string;
  sqrt_price_short_x96?: string;

  // Human-readable prices (AFTER trade)
  price_long?: number;
  price_short?: number;

  // Virtual reserves (AFTER trade)
  r_long_after?: number;
  r_short_after?: number;

  // Belief submission (optional)
  initial_belief?: number;
  meta_belief?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: RecordTradeRequest = await req.json();

    // Validate required fields
    if (!body.tx_signature || !body.wallet_address || !body.trade_type || !body.usdc_amount || !body.side) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Get agent_id and belief_id first (needed for RPC call)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('agent_id')
      .eq('id', body.user_id)
      .single();

    if (userError || !user?.agent_id) {
      console.error('[AGENT LOOKUP] Could not find agent for user:', body.user_id);
      return NextResponse.json(
        { error: 'User agent not found' },
        { status: 400 }
      );
    }

    const agentId = user.agent_id;

    // Get belief_id from pool_deployments
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('belief_id')
      .eq('post_id', body.post_id)
      .single();

    if (poolError || !poolDeployment?.belief_id) {
      console.error('[BELIEF LOOKUP] Could not find pool deployment for post:', body.post_id);
      return NextResponse.json(
        { error: 'Pool deployment not found' },
        { status: 400 }
      );
    }

    const beliefId = poolDeployment.belief_id;

    // Calculate new token balance based on trade type
    const tokenAmount = parseFloat(body.token_amount);
    const usdcAmount = parseFloat(body.usdc_amount);

    // Get current balance
    const { data: existingBalance } = await supabase
      .from('user_pool_balances')
      .select('token_balance, belief_lock')
      .eq('user_id', body.user_id)
      .eq('pool_address', body.pool_address)
      .eq('token_type', body.side)
      .single();

    let newTokenBalance: number;
    let newBeliefLock: number;

    if (body.trade_type === 'buy') {
      newTokenBalance = (existingBalance?.token_balance || 0) + tokenAmount;
      newBeliefLock = Math.floor(usdcAmount * 0.02); // 2% lock on new purchase
    } else {
      // Sell
      newTokenBalance = (existingBalance?.token_balance || 0) - tokenAmount;
      if (newTokenBalance < 0) {
        return NextResponse.json(
          { error: 'Insufficient token balance for sell' },
          { status: 400 }
        );
      }
      newBeliefLock = existingBalance?.belief_lock || 0; // Keep existing lock on sell
    }

    // Use default belief values if not provided
    const belief = body.initial_belief ?? 0.5;
    const metaPrediction = body.meta_belief ?? 0.5;

    // Call atomic RPC function
    const { data: result, error: rpcError } = await supabase.rpc('record_trade_atomic', {
      p_pool_address: body.pool_address,
      p_post_id: body.post_id,
      p_user_id: body.user_id,
      p_wallet_address: body.wallet_address,
      p_trade_type: body.trade_type,
      p_token_amount: tokenAmount,
      p_usdc_amount: usdcAmount,
      p_tx_signature: body.tx_signature,
      p_token_type: body.side,
      p_sqrt_price_long_x96: body.sqrt_price_long_x96 || '0',
      p_sqrt_price_short_x96: body.sqrt_price_short_x96 || '0',
      p_belief_id: beliefId,
      p_agent_id: agentId,
      p_belief: belief,
      p_meta_prediction: metaPrediction,
      p_token_balance: newTokenBalance,
      p_belief_lock: newBeliefLock,
    });

    if (rpcError) {
      console.error('[Trade Record] RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to record trade', details: rpcError.message },
        { status: 500 }
      );
    }

    if (!result?.success) {
      if (result?.error === 'LOCKED') {
        return NextResponse.json(
          { error: 'Another trade in progress for this user. Please retry.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: result?.message || 'Trade recording failed' },
        { status: 500 }
      );
    }

    console.log('[Trade Record] Success:', result.trade_id, 'skim:', result.skim_amount);

    // Record implied relevance from virtual reserves after trade
    if (body.r_long_after !== undefined && body.r_short_after !== undefined && body.post_id) {
      try {
        const totalReserve = body.r_long_after + body.r_short_after;
        const impliedRelevance = totalReserve > 0 ? body.r_long_after / totalReserve : 0.5;

        const { error: impliedError } = await supabase
          .from('implied_relevance_history')
          .insert({
            post_id: body.post_id,
            belief_id: beliefId,
            implied_relevance: impliedRelevance,
            reserve_long: body.r_long_after,
            reserve_short: body.r_short_after,
            event_type: 'trade',
            event_reference: body.tx_signature,
            confirmed: false,
            recorded_by: 'server',
          });

        if (impliedError) {
          // Ignore unique constraint violations (event indexer already recorded)
          if (impliedError.code !== '23505') {
            console.error('[IMPLIED RELEVANCE] Failed to record:', impliedError);
          }
        } else {
          console.log('[IMPLIED RELEVANCE] Recorded after trade:', impliedRelevance.toFixed(4));
        }
      } catch (impliedRelevanceError) {
        console.error('[IMPLIED RELEVANCE] Error:', impliedRelevanceError);
        // Don't fail the trade recording if implied relevance tracking fails
      }
    }

    // Sync pool state after recording trade (non-blocking)
    // Uses PoolSyncService for clean, reusable sync logic
    PoolSyncService.syncAfterTrade(body.pool_address);

    return NextResponse.json({
      message: 'Trade recorded optimistically',
      recorded: true,
      note: 'Will be confirmed by event indexer'
    });

  } catch (error) {
    console.error('Error in trade recording:', error);
    return NextResponse.json(
      {
        error: 'Failed to record trade',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
