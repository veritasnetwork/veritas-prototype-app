/**
 * Withdrawal Recording API (Optimistic Updates)
 *
 * Records withdrawals optimistically for immediate UI feedback.
 * Event indexer will confirm/correct these records when blockchain events arrive.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { verifyAuthHeader } from '@/lib/auth/privy-server';
import { asMicroUsdc } from '@/lib/units';

interface RecordWithdrawalRequest {
  walletAddress: string;
  amountMicro: number; // micro-USDC (from blockchain confirmation)
  txSignature: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RecordWithdrawalRequest = await req.json();

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const privyUserId = await verifyAuthHeader(authHeader);

    if (!privyUserId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Validate required fields
    if (!body.txSignature || !body.walletAddress || !body.amountMicro || body.amountMicro <= 0) {
      console.error('[WITHDRAW RECORD] ❌ Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceRole();

    // Validate and use the amount from blockchain (already in micro-USDC)
    const amountMicro = asMicroUsdc(body.amountMicro);

    // Verify wallet ownership and get agent_id
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, agent_id')
      .eq('auth_id', privyUserId)
      .single();

    if (userError || !user) {
      console.error('[WITHDRAW RECORD] ❌ User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's Solana address
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('solana_address')
      .eq('id', user.agent_id)
      .single();

    if (agentError || !agent || !agent.solana_address) {
      console.error('[WITHDRAW RECORD] ❌ No wallet address');
      return NextResponse.json({ error: 'User has no Solana wallet' }, { status: 400 });
    }

    const userWalletAddress = agent.solana_address;

    if (userWalletAddress !== body.walletAddress) {
      console.error('[WITHDRAW RECORD] ❌ Wallet mismatch');
      return NextResponse.json({ error: 'Wallet does not belong to user' }, { status: 403 });
    }

    const agentId = user.agent_id;
    if (!agentId) {
      console.error('[WITHDRAW RECORD] ❌ No agent_id');
      return NextResponse.json({ error: 'User has no agent' }, { status: 400 });
    }

    // Atomically record withdrawal and update stake in a single transaction
    // This prevents race conditions and ensures consistency
    const { data: result, error: atomicError } = await supabase.rpc('record_withdrawal_atomic', {
      p_agent_id: agentId,
      p_amount_usdc: amountMicro / 1_000_000, // Convert micro-USDC to display USDC
      p_tx_signature: body.txSignature,
      p_wallet_address: body.walletAddress,
      p_authority_address: userWalletAddress,
    });

    if (atomicError || !result?.success) {
      const errorMsg = atomicError?.message || result?.error || 'Unknown error';
      console.error('[WITHDRAW RECORD] ❌ Atomic operation failed:', errorMsg);

      // Check if it's a duplicate (already recorded)
      if (errorMsg.includes('duplicate') || errorMsg.includes('conflict')) {
        console.log('[WITHDRAW RECORD] ⚠️  Withdrawal already recorded');
        return NextResponse.json({
          success: true,
          message: 'Withdrawal already recorded',
          alreadyRecorded: true,
        });
      }

      return NextResponse.json(
        { error: 'Failed to record withdrawal', details: errorMsg },
        { status: 500 }
      );
    }

    console.log(`[WITHDRAW RECORD] ✅ Recorded withdrawal: ${body.txSignature} (-${amountMicro} μUSDC)`);
    console.log(`[WITHDRAW RECORD] New stake: ${result.new_stake} μUSDC`);

    return NextResponse.json({
      success: true,
      message: 'Withdrawal recorded successfully',
      amountMicro,
      txSignature: body.txSignature,
      withdrawalId: result.withdrawal_id,
      newStake: result.new_stake,
    });

  } catch (error) {
    console.error('[WITHDRAW RECORD] ❌ Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to record withdrawal',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}