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
import { asDisplay, displayToAtomic, poolDisplayToAtomic, asMicroUsdc } from '@/lib/units';
import { syncPoolFromChain } from '@/lib/solana/sync-pool-from-chain';

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

    console.log('[STEP 4/7] Preparing trade data...');
    // Parse trade amounts (balance calculation moved to database function)
    const tokenAmount = parseFloat(body.token_amount);
    const usdcAmount = parseFloat(body.usdc_amount);

    console.log('[STEP 4/7] Trade amounts:', { tokenAmount, usdcAmount });

    // Use default belief values if not provided
    const belief = body.initial_belief ?? 0.5;
    const metaPrediction = body.meta_belief ?? 0.5;
    console.log('[STEP 4/7] Beliefs:', { belief, metaPrediction });

    // NOTE: Balance calculation is now done inside record_trade_atomic with FOR UPDATE locks
    // This prevents race conditions when concurrent trades occur (Bug #1 fix)

    console.log('[STEP 5/7] Calling record_trade_atomic RPC...');
    // Call atomic RPC function (balance calculation happens inside the function now)
    const rpcParams = {
      p_pool_address: body.pool_address,
      p_post_id: body.post_id,
      p_user_id: body.user_id,
      p_wallet_address: body.wallet_address,
      p_trade_type: body.trade_type,
      p_token_amount: tokenAmount,
      p_usdc_amount: usdcAmount,  // IMPORTANT: In display units (USDC), converted to micro-USDC inside function
      p_tx_signature: body.tx_signature,
      p_token_type: body.side,
      p_sqrt_price_long_x96: body.sqrt_price_long_x96 || '0',
      p_sqrt_price_short_x96: body.sqrt_price_short_x96 || '0',
      p_belief_id: beliefId,
      p_agent_id: agentId,
      p_belief: belief,
      p_meta_prediction: metaPrediction,
      // REMOVED: p_token_balance and p_belief_lock (calculated inside function with locks)
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
      if (result?.error === 'INSUFFICIENT_BALANCE') {
        console.error('[STEP 5/7] ❌ Insufficient balance:', result);
        return NextResponse.json(
          {
            error: result.message || 'Insufficient token balance for sell',
            available: result.available,
            required: result.required
          },
          { status: 400 }
        );
      }
      console.error('[STEP 5/7] ❌ RPC failed:', result);
      return NextResponse.json(
        { error: result?.message || 'Trade recording failed' },
        { status: 500 }
      );
    }

    console.log('[STEP 5/7] ✅ RPC success - Trade recorded in database:', {
      trade_id: result.trade_id,
      skim_amount: result.skim_amount,
      new_balance: result.new_balance,
      new_lock: result.new_lock
    });

    // Verify the trade was actually inserted
    console.log('[STEP 5/7] Verifying trade insertion in database...');
    const { data: tradeVerify, error: verifyError } = await supabase
      .from('trades')
      .select('id, tx_signature, trade_type, side, token_amount, usdc_amount, recorded_by, confirmed, created_at')
      .eq('tx_signature', body.tx_signature)
      .single();

    if (verifyError) {
      console.error('[STEP 5/7] ⚠️  Could not verify trade insertion:', verifyError);
    } else {
      console.log('[STEP 5/7] ✅ Trade verified in trades table:', {
        id: tradeVerify.id,
        trade_type: tradeVerify.trade_type,
        side: tradeVerify.side,
        token_amount: tradeVerify.token_amount,
        usdc_amount: tradeVerify.usdc_amount,
        recorded_by: tradeVerify.recorded_by,
        confirmed: tradeVerify.confirmed,
        created_at: tradeVerify.created_at
      });
    }

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

    console.log('[STEP 7/7] Updating pool state in database...');
    // Update pool_deployments with the new state from the trade
    if (body.sqrt_price_long_x96 && body.sqrt_price_short_x96 && body.s_long_after !== undefined && body.s_short_after !== undefined) {
      try {
        // Type-safe unit conversion: Frontend sends DISPLAY units, DB expects ATOMIC units
        const poolState = poolDisplayToAtomic({
          sLong: asDisplay(body.s_long_after),
          sShort: asDisplay(body.s_short_after),
          vaultBalance: asMicroUsdc(0), // Not updating vault_balance here
        });

        const { error: poolUpdateError } = await supabase
          .from('pool_deployments')
          .update({
            sqrt_price_long_x96: body.sqrt_price_long_x96,
            sqrt_price_short_x96: body.sqrt_price_short_x96,
            s_long_supply: poolState.sLongSupply,
            s_short_supply: poolState.sShortSupply,
            last_synced_at: new Date().toISOString(),
          })
          .eq('pool_address', body.pool_address);

        if (poolUpdateError) {
          console.error('[STEP 7/7] ❌ Failed to update pool state:', poolUpdateError);
        } else {
          console.log('[STEP 7/7] ✅ Pool state updated:', {
            pool_address: body.pool_address,
            sqrt_price_long: body.sqrt_price_long_x96,
            sqrt_price_short: body.sqrt_price_short_x96,
            supply_long_display: body.s_long_after,
            supply_short_display: body.s_short_after,
            supply_long_atomic: poolState.sLongSupply,
            supply_short_atomic: poolState.sShortSupply,
          });
        }
      } catch (poolUpdateException) {
        console.error('[STEP 7/7] ❌ Exception updating pool state:', poolUpdateException);
      }
    } else {
      console.warn('[STEP 7/7] ⚠️  Missing pool state data from client - syncing from chain as fallback...');
      // Fallback: Sync from chain if client didn't provide pool state
      try {
        const synced = await syncPoolFromChain(body.pool_address);
        if (synced) {
          console.log('[STEP 7/7] ✅ Pool state synced from chain successfully');
        } else {
          console.error('[STEP 7/7] ❌ Failed to sync pool state from chain');
        }
      } catch (syncError) {
        console.error('[STEP 7/7] ❌ Exception syncing pool state from chain:', syncError);
      }
    }

    // Also trigger async pool sync as backup (non-blocking)
    PoolSyncService.syncAfterTrade(body.pool_address);

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
