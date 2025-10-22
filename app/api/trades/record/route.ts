/**
 * Trade Recording API (Optimistic Updates)
 *
 * Records trades optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optimistically record trade with complete ICBS data
    // Event indexer will mark as confirmed when it sees the on-chain event
    const { error } = await supabase
      .from('trades')
      .insert({
        tx_signature: body.tx_signature,
        pool_address: body.pool_address,
        post_id: body.post_id,
        user_id: body.user_id,
        wallet_address: body.wallet_address,
        trade_type: body.trade_type,
        side: body.side,
        usdc_amount: parseFloat(body.usdc_amount),
        token_amount: parseFloat(body.token_amount),
        // ICBS snapshots (if provided)
        s_long_before: body.s_long_before,
        s_short_before: body.s_short_before,
        s_long_after: body.s_long_after,
        s_short_after: body.s_short_after,
        // Sqrt prices
        sqrt_price_long_x96: body.sqrt_price_long_x96,
        sqrt_price_short_x96: body.sqrt_price_short_x96,
        // Human-readable prices
        price_long: body.price_long,
        price_short: body.price_short,
        // Virtual reserves
        r_long_after: body.r_long_after,
        r_short_after: body.r_short_after,
        // Metadata
        recorded_by: 'server',
        confirmed: false,
        created_at: new Date().toISOString(),
      })
      // Use ON CONFLICT DO NOTHING for idempotency
      // If indexer already recorded this tx_signature, skip
      .select()
      .single();

    if (error) {
      // If conflict on tx_signature, it's already recorded (by server or indexer)
      if (error.code === '23505') { // Unique violation
        return NextResponse.json({
          message: 'Trade already recorded',
          recorded: false
        });
      }

      console.error('Failed to record trade:', error);
      return NextResponse.json(
        { error: 'Failed to record trade', details: error.message },
        { status: 500 }
      );
    }

    // Get agent_id from users (needed for both belief submission and stake tracking)
    let agentId: string | null = null;
    let beliefSubmissionId: string | null = null;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('agent_id')
      .eq('id', body.user_id)
      .single();

    if (userError || !user?.agent_id) {
      console.error('[AGENT LOOKUP] Could not find agent for user:', body.user_id);
    } else {
      agentId = user.agent_id;
    }

    // If belief data is provided, create a belief submission
    if (body.initial_belief !== undefined && body.meta_belief !== undefined && agentId) {
      try {
        // Get belief_id from pool_deployments via post_id
        const { data: poolDeployment, error: poolError } = await supabase
          .from('pool_deployments')
          .select('belief_id')
          .eq('post_id', body.post_id)
          .single();

        if (poolError || !poolDeployment) {
          console.error('[BELIEF SUBMISSION] Could not find pool deployment for post:', body.post_id);
        } else {
          // Submit belief (upsert to update if already exists)
          const { data: beliefData, error: beliefError } = await supabase
            .from('belief_submissions')
            .upsert({
              agent_id: agentId,
              belief_id: poolDeployment.belief_id,
              belief: body.initial_belief,
              meta_prediction: body.meta_belief,
              timestamp: new Date().toISOString(),
            }, {
              onConflict: 'agent_id,belief_id',
            })
            .select('id')
            .single();

          if (beliefError) {
            console.error('[BELIEF SUBMISSION] Failed to record belief:', beliefError);
          } else if (beliefData) {
            beliefSubmissionId = beliefData.id;
          }
        }
      } catch (beliefSubmissionError) {
        console.error('[BELIEF SUBMISSION] Error recording belief:', beliefSubmissionError);
        // Don't fail the trade recording if belief submission fails
      }
    }

    // Update user_pool_balances for stake lock tracking
    try {
      const usdcAmount = parseFloat(body.usdc_amount);
      const tokenAmount = parseFloat(body.token_amount);

      if (body.trade_type === 'buy') {
        const beliefLock = usdcAmount * 0.02; // 2% belief lock

        // First check if balance exists
        const { data: existingBalance } = await supabase
          .from('user_pool_balances')
          .select('token_balance, total_bought, total_usdc_spent')
          .eq('user_id', body.user_id)
          .eq('pool_address', body.pool_address)
          .single();

        if (existingBalance) {
          // Update existing record
          const { error: updateError } = await supabase
            .from('user_pool_balances')
            .update({
              token_balance: (existingBalance.token_balance || 0) + tokenAmount,
              last_buy_amount: usdcAmount,
              belief_lock: beliefLock,
              total_bought: (existingBalance.total_bought || 0) + tokenAmount,
              total_usdc_spent: (existingBalance.total_usdc_spent || 0) + usdcAmount,
              last_trade_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', body.user_id)
            .eq('pool_address', body.pool_address);

          if (updateError) {
            console.error('[USER BALANCES] Failed to update user_pool_balances:', updateError);
          }
        } else {
          // Insert new record
          const { error: insertError } = await supabase
            .from('user_pool_balances')
            .insert({
              user_id: body.user_id,
              pool_address: body.pool_address,
              post_id: body.post_id,
              token_balance: tokenAmount,
              last_buy_amount: usdcAmount,
              belief_lock: beliefLock,
              total_bought: tokenAmount,
              total_usdc_spent: usdcAmount,
              last_trade_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('[USER BALANCES] Failed to insert user_pool_balances:', insertError);
          }
        }

      } else if (body.trade_type === 'sell') {
        // Get current balance first
        const { data: existingBalance } = await supabase
          .from('user_pool_balances')
          .select('token_balance, total_sold, total_usdc_received')
          .eq('user_id', body.user_id)
          .eq('pool_address', body.pool_address)
          .single();

        if (existingBalance) {
          // Decrease token balance (belief_lock unchanged until position fully closed)
          const { error: updateError } = await supabase
            .from('user_pool_balances')
            .update({
              token_balance: existingBalance.token_balance - tokenAmount,
              total_sold: (existingBalance.total_sold || 0) + tokenAmount,
              total_usdc_received: (existingBalance.total_usdc_received || 0) + usdcAmount,
              last_trade_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', body.user_id)
            .eq('pool_address', body.pool_address);

          if (updateError) {
            console.error('[USER BALANCES] Failed to update user_pool_balances on sell:', updateError);
          }
        }
      }

    } catch (balanceError) {
      console.error('[USER BALANCES] Error updating user_pool_balances:', balanceError);
      // Don't fail the trade recording if balance tracking fails
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
