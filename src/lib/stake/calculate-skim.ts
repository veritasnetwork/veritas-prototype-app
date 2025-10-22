/**
 * Stake Skim Calculation - Simplified System
 *
 * Calculates the required stake skim for a trade based on:
 * - Agent's current GLOBAL total_stake (across all pools)
 * - Active belief locks per pool (2% of last buy per pool)
 * - This trade's belief lock (2% of trade amount)
 *
 * Core principle: One active belief per user per pool.
 * Required lock = sum of all active belief locks.
 * Net skim = amount needed to reach required lock.
 *
 * Note: Stakes are tracked globally in agents.total_stake, not per-pool.
 * The VeritasCustodian holds all stakes in a global vault.
 * Locks are tracked per-pool in user_pool_balances.
 */

import { createClient } from '@supabase/supabase-js';

interface StakeSkimParams {
  userId: string;
  poolAddress: string;
  tradeType: 'buy' | 'sell';
  tradeAmount: number; // micro-USDC
  walletAddress: string; // For querying agent
}

const SKIM_RATE = 0.02; // 2% of trade value

/**
 * Calculate stake skim required for a trade
 *
 * Sells don't require stake skims.
 * Buys require 2% of trade value as belief weight/lock.
 * Net-skim only takes the delta needed to cover sum of active locks.
 *
 * Edge cases:
 * - If user has no stake yet (null/undefined), defaults to 0 and skims the full required amount
 * - If user has some stake but less than required, skims the difference
 * - If user has sufficient stake, skims 0
 * - New buy in same pool supersedes old belief (old lock replaced by new lock)
 * - Locks only apply to open positions (token_balance > 0)
 *
 * @param params - Trade parameters
 * @returns Stake skim amount in micro-USDC
 */
export async function calculateStakeSkim(params: StakeSkimParams): Promise<number> {
  // Sells don't require stake skim
  if (params.tradeType === 'sell') {
    return 0;
  }

  // Create Supabase client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get agent's current total stake (global) via wallet address
  const { data: agent } = await supabase
    .from('agents')
    .select('id, total_stake')
    .eq('solana_address', params.walletAddress)
    .single();

  if (!agent) {
    throw new Error('Agent not found');
  }

  const currentStakeMicro = (agent.total_stake ?? 0) * 1_000_000;

  // Get sum of belief locks from OPEN positions only (token_balance > 0)
  const { data: openPositions } = await supabase
    .from('user_pool_balances')
    .select('pool_address, belief_lock, token_balance')
    .eq('user_id', params.userId)
    .gt('token_balance', 0); // Only count open positions

  // Calculate lock for this buy (2% of trade amount)
  const thisBuyLock = params.tradeAmount * SKIM_RATE;

  // Calculate total required lock after this buy
  // Sum all OTHER pools' locks + this pool's NEW lock
  const otherPoolsLock = (openPositions || [])
    .filter(p => p.pool_address !== params.poolAddress)
    .reduce((sum, p) => sum + parseFloat(p.belief_lock.toString()), 0);

  const newRequiredLock = otherPoolsLock + thisBuyLock;

  // Net skim = amount needed to reach new required lock
  const netSkim = Math.max(0, newRequiredLock - currentStakeMicro);

  return Math.ceil(netSkim);
}
