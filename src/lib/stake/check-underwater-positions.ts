/**
 * Check if user has underwater positions that would cause excessive skim
 * Returns positions that user should close to enable normal trading
 */

import { getSupabaseServiceRole } from '@/lib/supabase-server';

export interface UnderwaterPosition {
  poolAddress: string;
  tokenType: 'LONG' | 'SHORT';
  beliefLock: number; // micro-USDC
  tokenBalance: number;
  postId: string;
}

export interface UnderwaterCheck {
  isUnderwater: boolean;
  currentStake: number; // micro-USDC
  totalLocks: number; // micro-USDC
  deficit: number; // micro-USDC (negative if solvent)
  positions: UnderwaterPosition[];
}

/**
 * Check if user is underwater and get their positions
 */
export async function checkUnderwaterPositions(
  userId: string,
  agentId: string
): Promise<UnderwaterCheck> {
  const supabase = getSupabaseServiceRole();

  // Get current stake
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', agentId)
    .single();

  if (agentError) {
    throw new Error(`Failed to get agent stake: ${agentError.message}`);
  }

  const currentStake = agent.total_stake || 0;

  // Get all open positions
  const { data: positions, error: positionsError } = await supabase
    .from('user_pool_balances')
    .select('pool_address, token_type, belief_lock, token_balance, post_id')
    .eq('user_id', userId)
    .gt('token_balance', 0);

  if (positionsError) {
    throw new Error(`Failed to get positions: ${positionsError.message}`);
  }

  const totalLocks = positions.reduce((sum, p) => sum + (p.belief_lock || 0), 0);
  const deficit = totalLocks - currentStake;

  return {
    isUnderwater: deficit > 0,
    currentStake,
    totalLocks,
    deficit,
    positions: positions.map((p) => ({
      poolAddress: p.pool_address,
      tokenType: p.token_type as 'LONG' | 'SHORT',
      beliefLock: p.belief_lock || 0,
      tokenBalance: p.token_balance || 0,
      postId: p.post_id || '',
    })),
  };
}

/**
 * Calculate what skim would be for a proposed trade
 * Returns info about whether skim is excessive
 */
export async function calculateSkimWithWarning(params: {
  userId: string;
  agentId: string;
  poolAddress: string;
  side: 'LONG' | 'SHORT';
  tradeAmountMicro: number; // micro-USDC
}): Promise<{
  skimAmount: number; // micro-USDC
  skimPercentage: number; // 0-100+
  isExcessive: boolean; // true if > 20%
  underwaterCheck: UnderwaterCheck;
  recommendation: string;
}> {
  const supabase = getSupabaseServiceRole();

  // Get current stake
  const { data: agent } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', params.agentId)
    .single();

  const currentStake = agent?.total_stake || 0;

  // Calculate skim using the database function
  const { data: skimData, error: skimError } = await supabase.rpc(
    'calculate_skim_with_lock',
    {
      p_user_id: params.userId,
      p_wallet_address: '', // Not needed for calculation
      p_pool_address: params.poolAddress,
      p_side: params.side,
      p_trade_amount_micro: params.tradeAmountMicro,
    }
  );

  if (skimError) {
    throw new Error(`Skim calculation failed: ${skimError.message}`);
  }

  const skimAmount = skimData?.[0]?.skim_amount || 0;
  const skimPercentage = (skimAmount / params.tradeAmountMicro) * 100;
  const isExcessive = skimPercentage > 20;

  // Get underwater status
  const underwaterCheck = await checkUnderwaterPositions(params.userId, params.agentId);

  let recommendation = '';
  if (isExcessive && underwaterCheck.isUnderwater) {
    recommendation = `Your skim (${skimPercentage.toFixed(0)}%) is high because you have underwater positions. Close some positions to reduce your locks and enable normal trading.`;
  } else if (isExcessive) {
    recommendation = `Your skim (${skimPercentage.toFixed(0)}%) is high. Consider trading in pools where you already have positions to replace locks instead of adding new ones.`;
  }

  return {
    skimAmount,
    skimPercentage,
    isExcessive,
    underwaterCheck,
    recommendation,
  };
}
