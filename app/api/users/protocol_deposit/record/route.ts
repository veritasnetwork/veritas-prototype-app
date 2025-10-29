/**
 * Protocol Deposit Recording API (Optimistic Updates)
 *
 * Records deposits optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { asMicroUsdc } from '@/lib/units';

interface RecordDepositRequest {
  walletAddress: string;
  amountMicro: number; // micro-USDC (from transaction)
  txSignature: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RecordDepositRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate required fields
    if (!body.txSignature || !body.walletAddress || !body.amountMicro || body.amountMicro <= 0) {
      console.error('[DEPOSIT RECORD] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Validate and use the amount from transaction (already in micro-USDC)
    const amountMicro = asMicroUsdc(body.amountMicro);

    // Verify wallet ownership and get agent_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !user) {
      console.error('[DEPOSIT RECORD] ❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's Solana address
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', user.agent_id)
      .single();

    if (agentError || !agent || !agent.solana_address) {
      console.error('[DEPOSIT RECORD] ❌ No wallet address');
      return NextResponse.json({ error: 'User has no Solana wallet' }, { status: 400 });
    }

    const userWalletAddress = agent.solana_address;

    if (userWalletAddress !== body.walletAddress) {
      console.error('[DEPOSIT RECORD] ❌ Wallet mismatch');
      return NextResponse.json({ error: 'Wallet does not belong to user' }, { status: 403 });
    }

    const agentId = user.agent_id;
    if (!agentId) {
      console.error('[DEPOSIT RECORD] ❌ No agent_id');
      return NextResponse.json({ error: 'User has no agent' }, { status: 400 });
    }

    // Check if deposit already recorded
    const { data: existing } = await supabase
      .from('custodian_deposits')
      .select('id, agent_credited')
      .eq('tx_signature', body.txSignature)
      .single();

    if (existing) {
      console.log('[DEPOSIT RECORD] ⚠️  Deposit already recorded');

      // Get current stake for response
      const { data: agentData } = await supabase
        .from('agents')
        .select('total_stake')
        .eq('id', agentId)
        .single();

      return NextResponse.json({
        success: true,
        message: 'Deposit already recorded',
        alreadyRecorded: true,
        newStake: agentData?.total_stake || 0,
      });
    }

    // Insert deposit record (optimistic, not confirmed yet)
    const { error: insertError } = await supabase
      .from('custodian_deposits')
      .insert({
        tx_signature: body.txSignature,
        depositor_address: body.walletAddress,
        amount_usdc: amountMicro,
        deposit_type: 'direct',
        recorded_by: 'server',
        confirmed: false, // Will be confirmed by indexer
        agent_credited: false, // Will be set to true after updating stake
        agent_id: agentId,
      });

    if (insertError) {
      // Check if it's a duplicate (race condition)
      if (insertError.code === '23505') {
        console.log('[DEPOSIT RECORD] ⚠️  Deposit already recorded (race condition)');

        // Get current stake for response
        const { data: agentData } = await supabase
          .from('agents')
          .select('total_stake')
          .eq('id', agentId)
          .single();

        return NextResponse.json({
          success: true,
          message: 'Deposit already recorded',
          alreadyRecorded: true,
          newStake: agentData?.total_stake || 0,
        });
      }

      console.error('[DEPOSIT RECORD] ❌ Failed to insert:', insertError);
      return NextResponse.json(
        { error: 'Failed to record deposit', details: insertError.message },
        { status: 500 }
      );
    }

    // Update agent's total_stake optimistically
    const { error: stakeError } = await supabase
      .rpc('add_agent_stake', {
        p_agent_id: agentId,
        p_amount: amountMicro,
      });

    if (stakeError) {
      console.error('[DEPOSIT RECORD] ❌ Failed to update stake:', stakeError);
      // Don't fail the request - indexer will fix it
    } else {
      // Mark as credited to prevent double-crediting
      const { error: updateError } = await supabase
        .from('custodian_deposits')
        .update({
          agent_credited: true,
          credited_at: new Date().toISOString(),
        })
        .eq('tx_signature', body.txSignature);

      if (updateError) {
        console.error('[DEPOSIT RECORD] ⚠️  Failed to mark as credited:', updateError);
        // Non-critical - record was inserted and stake updated
      }
    }

    // Get new stake amount
    const { data: agentData } = await supabase
      .from('agents')
      .select('total_stake')
      .eq('id', agentId)
      .single();

    console.log(`[DEPOSIT RECORD] ✅ Recorded deposit: ${body.txSignature} (+${amountMicro} μUSDC)`);
    console.log(`[DEPOSIT RECORD] New stake: ${agentData?.total_stake || 0} μUSDC`);

    return NextResponse.json({
      success: true,
      message: 'Deposit recorded successfully',
      amountMicro,
      txSignature: body.txSignature,
      newStake: agentData?.total_stake || 0,
    });

  } catch (error) {
    console.error('[DEPOSIT RECORD] ❌ Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to record deposit',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
