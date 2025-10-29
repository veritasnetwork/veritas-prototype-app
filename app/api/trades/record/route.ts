/**
 * Trade Recording API (Optimistic Updates)
 *
 * Records trades optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { checkRateLimit, rateLimiters } from '@/lib/rate-limit';
import { asDisplay } from '@/lib/units';
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

  // Vault balance (AFTER trade)
  vault_balance_after?: number; // Micro-USDC

  // Belief submission (optional)
  initial_belief?: number;
  meta_belief?: number;

  // Skim amount (only for buys)
  skim_amount?: number; // Display USDC
}

export async function POST(req: NextRequest) {
  try {
    const body: RecordTradeRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate required fields
    if (!body.tx_signature || !body.wallet_address || !body.trade_type || !body.usdc_amount || !body.side) {
      console.error('[STEP 1/7] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = getSupabaseServiceRole();

    // Verify wallet ownership
    const { data: verifiedUser, error: verifyError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .single();

    if (verifyError || !verifiedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's Solana address
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', verifiedUser.agent_id)
      .single();

    if (agentError || !agent || !agent.solana_address) {
      return NextResponse.json({ error: 'User has no Solana wallet' }, { status: 400 });
    }

    if (agent.solana_address !== body.wallet_address) {
      return NextResponse.json({ error: 'Wallet does not belong to authenticated user' }, { status: 403 });
    }

    if (verifiedUser.id !== body.user_id) {
      return NextResponse.json({ error: 'User ID mismatch' }, { status: 403 });
    }

    // Prevent duplicates
    const { data: existingTrade } = await supabase
      .from('trades')
      .select('id, tx_signature')
      .eq('tx_signature', body.tx_signature)
      .maybeSingle();

    if (existingTrade) {
      return NextResponse.json({
        message: 'Trade already recorded',
        trade_id: existingTrade.id,
        recorded: true
      }, { status: 200 });
    }

    // Check rate limit (50 trades per hour)
    try {
      const { success, headers } = await checkRateLimit(body.wallet_address, rateLimiters.trade);

      if (!success) {
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

    // Get belief_id from pool_deployments
    const { data: poolDeployment, error: poolError } = await supabase
      .from('pool_deployments')
      .select('belief_id, status, pool_address')
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

    // ✅ RECTIFY STATUS: If pool has status 'pool_created' but trading is happening,
    // update it to 'market_deployed' (market must be deployed if trades are occurring)
    if (poolDeployment.status === 'pool_created') {
      console.warn('[STEP 3/7] ⚠️  Pool has status "pool_created" but trade is occurring - updating to "market_deployed"');
      const { error: statusUpdateError } = await supabase
        .from('pool_deployments')
        .update({
          status: 'market_deployed',
          market_deployed_at: new Date().toISOString(),
        })
        .eq('pool_address', poolDeployment.pool_address);

      if (statusUpdateError) {
        console.error('[STEP 3/7] ⚠️  Failed to update pool status:', statusUpdateError);
        // Don't fail the trade - just log the warning
      } else {
        console.log('[STEP 3/7] ✅ Pool status updated to "market_deployed"');
      }
    }

    // Parse trade amounts (balance calculation moved to database function)
    const tokenAmount = parseFloat(body.token_amount);
    const usdcAmount = parseFloat(body.usdc_amount);


    // Use default belief values if not provided
    const belief = body.initial_belief ?? 0.5;
    const metaPrediction = body.meta_belief ?? 0.5;

    // NOTE: Balance calculation is now done inside record_trade_atomic with FOR UPDATE locks
    // This prevents race conditions when concurrent trades occur (Bug #1 fix)

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 [TRADE RECORD] Data from Frontend:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Trade:', body.trade_type, body.side);
    console.log('Amounts:');
    console.log('  token_amount:', tokenAmount);
    console.log('  usdc_amount:', usdcAmount, 'USDC');
    console.log('Supplies (AFTER trade):');
    console.log('  s_long_after:', body.s_long_after);
    console.log('  s_short_after:', body.s_short_after);
    console.log('Sqrt Prices (AFTER trade):');
    console.log('  sqrt_price_long_x96:', body.sqrt_price_long_x96);
    console.log('  sqrt_price_short_x96:', body.sqrt_price_short_x96);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

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
      // ✅ NEW: Pass supplies from on-chain state after trade
      p_s_long_after: body.s_long_after ?? null,
      p_s_short_after: body.s_short_after ?? null,
      // Skim amount for custodian accounting
      p_skim_amount: body.skim_amount ?? 0,
      // REMOVED: p_token_balance and p_belief_lock (calculated inside function with locks)
    };


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


    // Verify the trade was actually inserted
    const { error: tradeVerifyError } = await supabase
      .from('trades')
      .select('id, tx_signature, trade_type, side, token_amount, usdc_amount, recorded_by, confirmed, created_at')
      .eq('tx_signature', body.tx_signature)
      .single();

    if (tradeVerifyError) {
      console.error('[STEP 5/7] ⚠️  Could not verify trade insertion:', tradeVerifyError);
    }

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
          }
        } else {
        }
      } catch (impliedRelevanceError) {
        console.error('[IMPLIED RELEVANCE] Error:', impliedRelevanceError);
        // Don't fail the trade recording if implied relevance tracking fails
      }
    }

    // Update pool_deployments with the new state from the trade
    if (body.sqrt_price_long_x96 && body.sqrt_price_short_x96 && body.s_long_after !== undefined && body.s_short_after !== undefined) {
      try {
        // IMPORTANT: DB stores supplies in DISPLAY units (per units.ts spec)
        // Frontend sends DISPLAY units, so store directly without conversion
        const sLongDisplay = asDisplay(body.s_long_after);
        const sShortDisplay = asDisplay(body.s_short_after);

        const updateData: { sqrt_price_long_x96: string; sqrt_price_short_x96: string; s_long_supply: number; s_short_supply: number; last_synced_at: string; vault_balance?: number; r_long?: number; r_short?: number } = {
          sqrt_price_long_x96: body.sqrt_price_long_x96,
          sqrt_price_short_x96: body.sqrt_price_short_x96,
          s_long_supply: sLongDisplay,
          s_short_supply: sShortDisplay,
          last_synced_at: new Date().toISOString(),
        };

        // Update vault balance if provided (micro-USDC from chain)
        if (body.vault_balance_after !== undefined) {
          updateData.vault_balance = body.vault_balance_after;
        }

        // CRITICAL: Update reserves after trade for accurate implied relevance display
        // Reserves are stored in DISPLAY USDC units in the database
        if (body.r_long_after !== undefined) {
          updateData.r_long = body.r_long_after;
        }
        if (body.r_short_after !== undefined) {
          updateData.r_short = body.r_short_after;
        }

        const { error: poolUpdateError } = await supabase
          .from('pool_deployments')
          .update(updateData)
          .eq('pool_address', body.pool_address);

        if (poolUpdateError) {
          console.error('[STEP 7/7] ❌ Failed to update pool state:', poolUpdateError);
        } else {
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
        } else {
          console.error('[STEP 7/7] ❌ Failed to sync pool state from chain');
        }
      } catch (syncError) {
        console.error('[STEP 7/7] ❌ Exception syncing pool state from chain:', syncError);
      }
    }

    // Pool sync already handled by syncPoolFromChain above
    // PoolSyncService edge function has Docker networking issues in local dev


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
