import { getSupabaseServiceRole } from '@/lib/supabase-server';
import { asMicroUsdc } from '@/lib/units';

export interface WithdrawableResult {
  totalStakeMicro: number;   // micro-USDC
  totalLocksMicro: number;   // micro-USDC
  withdrawableMicro: number; // micro-USDC (can be negative)
}

/**
 * Calculate withdrawable amount for a user
 * Returns values in micro-USDC
 *
 * Formula: withdrawable = total_stake - Σ(belief_lock WHERE token_balance > 0)
 */
export async function calculateWithdrawable(userId: string): Promise<WithdrawableResult> {
  const supabase = getSupabaseServiceRole();

  // First get the agent_id from users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('agent_id')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    throw new Error(`User not found: ${userId}: ${userError?.message}`);
  }

  // Get total stake (stored in micro-USDC)
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('total_stake')
    .eq('id', user.agent_id)
    .single();

  if (agentError || !agent) {
    throw new Error(`Agent not found for user ${userId}: ${agentError?.message}`);
  }

  // Validate and convert total_stake to micro-USDC
  const totalStakeMicro = asMicroUsdc(Math.round(Number(agent.total_stake) || 0));

  // Get all active locks (stored in micro-USDC)
  const { data: locks, error: locksError } = await supabase
    .from('user_pool_balances')
    .select('belief_lock')
    .eq('user_id', userId)
    .gt('token_balance', 0);

  if (locksError) {
    throw new Error(`Failed to fetch locks: ${locksError.message}`);
  }

  // Sum all belief_lock values (gross sum of LONG + SHORT)
  const totalLocksMicro = asMicroUsdc(
    (locks || []).reduce(
      (sum, row) => sum + Math.round(Number(row.belief_lock) || 0),
      0
    )
  );

  // Calculate withdrawable (can be negative)
  const withdrawableMicro = totalStakeMicro - totalLocksMicro;

  return {
    totalStakeMicro,
    totalLocksMicro,
    withdrawableMicro,
  };
}