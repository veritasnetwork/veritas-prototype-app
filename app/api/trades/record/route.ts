/**
 * Trade Recording API (Optimistic Updates)
 *
 * Records trades optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { PoolSyncService } from '@/services/pool-sync.service';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';

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
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔵 [/api/trades/record] Trade recording request received');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const body: RecordTradeRequest = await req.json();

    console.log('[STEP 1/7] Request body:', {
      tx_signature: body.tx_signature,
      wallet_address: body.wallet_address,
      trade_type: body.trade_type,
      side: body.side,
      token_amount: body.token_amount,
      usdc_amount: body.usdc_amount,
      pool_address: body.pool_address,
      post_id: body.post_id,
      user_id: body.user_id,
    });

    // Validate required fields
    if (!body.tx_signature || !body.wallet_address || !body.trade_type || !body.usdc_amount || !body.side) {
      console.error('[STEP 1/7] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('[STEP 1/7] ✅ Validation passed');

    // Check rate limit (50 trades per hour)
    try {
      const { success, headers } = await checkRateLimit(body.wallet_address, rateLimiters.trade);

      if (!success) {
        console.log('[/api/trades/record] Rate limit exceeded for wallet:', body.wallet_address);
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. You can record up to 50 trades per hour.',
            rateLimitExceeded: true
          },
          { status: 429, headers }
        );
      }
    } catch (rateLimitError) {
      // Log error but don't block the request if rate limiting fails
      console.error('[/api/trades/record] Rate limit check failed:', rateLimitError);
      // Continue with request - fail open for availability
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    console.log('[STEP 2/7] Looking up user agent...');
    // Get agent_id and belief_id first (needed for RPC call)
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('agent_id')
      .eq('id', body.user_id)
      .single();

    if (userError || !user?.agent_id) {
      console.error('[STEP 2/7] ❌ Could not find agent for user:', body.user_id, userError);
      return NextResponse.json(
        { error: 'User agent not found' },
        { status: 400 }
      );
    }

    const agentId = user.agent_id;
    console.log('[STEP 2/7] ✅ Agent found:', agentId);

    console.log('[STEP 3/7] Looking up belief_id from pool deployment...');
    // Get belief_id from pool_deployments
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('belief_id')
      .eq('post_id', body.post_id)
      .single();

    if (poolError || !poolDeployment?.belief_id) {
      console.error('[STEP 3/7] ❌ Could not find pool deployment for post:', body.post_id, poolError);
      return NextResponse.json(
        { error: 'Pool deployment not found' },
        { status: 400 }
      );
    }

    const beliefId = poolDeployment.belief_id;
    console.log('[STEP 3/7] ✅ Belief found:', beliefId);

    console.log('[STEP 4/7] Calculating token balance...');
    // Calculate new token balance based on trade type
    const tokenAmount = parseFloat(body.token_amount);
    const usdcAmount = parseFloat(body.usdc_amount);

    console.log('[STEP 4/7] Trade amounts:', { tokenAmount, usdcAmount });

    // Get current balance
    const { data: existingBalance } = await supabase
      .from('user_pool_balances')
      .select('token_balance, belief_lock')
      .eq('user_id', body.user_id)
      .eq('pool_address', body.pool_address)
      .eq('token_type', body.side)
      .single();

    console.log('[STEP 4/7] Existing balance:', existingBalance);

    let newTokenBalance: number;
    let newBeliefLock: number;

    if (body.trade_type === 'buy') {
      newTokenBalance = (existingBalance?.token_balance || 0) + tokenAmount;
      newBeliefLock = Math.floor(usdcAmount * 0.02); // 2% lock on new purchase
    } else {
      // Sell
      newTokenBalance = (existingBalance?.token_balance || 0) - tokenAmount;
      if (newTokenBalance < 0) {
        console.error('[STEP 4/7] ❌ Insufficient balance. Current:', existingBalance?.token_balance, 'Selling:', tokenAmount);
        return NextResponse.json(
          { error: 'Insufficient token balance for sell' },
          { status: 400 }
        );
      }
      newBeliefLock = existingBalance?.belief_lock || 0; // Keep existing lock on sell
    }

    console.log('[STEP 4/7] ✅ New balance calculated:', { newTokenBalance, newBeliefLock });

    // Use default belief values if not provided
    const belief = body.initial_belief ?? 0.5;
    const metaPrediction = body.meta_belief ?? 0.5;
    console.log('[STEP 4/7] Beliefs:', { belief, metaPrediction });

    console.log('[STEP 5/7] Calling record_trade_atomic RPC...');
    // Call atomic RPC function
    const rpcParams = {
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
    };

    console.log('[STEP 5/7] RPC params:', rpcParams);

    const { data: result, error: rpcError } = await supabase.rpc('record_trade_atomic', rpcParams);

    if (rpcError) {
      console.error('[STEP 5/7] ❌ RPC error:', rpcError);
      return NextResponse.json(
        { error: 'Failed to record trade', details: rpcError.message },
        { status: 500 }
      );
    }

    if (!result?.success) {
      if (result?.error === 'LOCKED') {
        console.error('[STEP 5/7] ❌ Trade locked - another in progress');
        return NextResponse.json(
          { error: 'Another trade in progress for this user. Please retry.' },
          { status: 409 }
        );
      }
      console.error('[STEP 5/7] ❌ RPC failed:', result);
      return NextResponse.json(
        { error: result?.message || 'Trade recording failed' },
        { status: 500 }
      );
    }

    console.log('[STEP 5/7] ✅ RPC success:', {
      trade_id: result.trade_id,
      skim_amount: result.skim_amount,
      belief_submission_id: result.belief_submission_id,
      balance_id: result.balance_id
    });

    console.log('[STEP 6/7] Recording implied relevance...');
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
            console.error('[STEP 6/7] ❌ Failed to record implied relevance:', impliedError);
          } else {
            console.log('[STEP 6/7] ⚠️  Implied relevance already recorded (duplicate)');
          }
        } else {
          console.log('[STEP 6/7] ✅ Implied relevance recorded:', {
            impliedRelevance: impliedRelevance.toFixed(4),
            r_long: body.r_long_after,
            r_short: body.r_short_after
          });
        }
      } catch (impliedRelevanceError) {
        console.error('[IMPLIED RELEVANCE] Error:', impliedRelevanceError);
        // Don't fail the trade recording if implied relevance tracking fails
      }
    }

    console.log('[STEP 7/7] Triggering pool sync...');
    // Sync pool state after recording trade (non-blocking)
    // Uses PoolSyncService for clean, reusable sync logic
    PoolSyncService.syncAfterTrade(body.pool_address);
    console.log('[STEP 7/7] ✅ Pool sync queued (non-blocking)');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ [/api/trades/record] Trade recorded successfully');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return NextResponse.json({
      message: 'Trade recorded optimistically',
      recorded: true,
      trade_id: result.trade_id,
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
