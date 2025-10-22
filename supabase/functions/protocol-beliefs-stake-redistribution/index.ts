import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Request {
  belief_id: string;
  information_scores: Record<string, number>;
}

function hashPoolAddress(address: string): number {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = ((hash << 5) - hash) + address.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { belief_id, information_scores } = await req.json() as Request;
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch pool_address
    const { data: pool, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('belief_id', belief_id)
      .single();

    if (poolError || !pool) throw new Error(`No pool found for belief ${belief_id}`);

    const poolAddress = pool.pool_address;
    const lockId = hashPoolAddress(poolAddress);

    // Acquire advisory lock
    await supabase.rpc('pg_advisory_lock', { lock_id: lockId });

    try {
      // Get gross locks (LONG + SHORT) with agent mapping
      const { data: userLocks } = await supabase
        .from('user_pool_balances')
        .select('user_id, belief_lock, users!inner(agent_id)')
        .eq('pool_address', poolAddress)
        .gt('token_balance', 0);

      if (!userLocks || userLocks.length === 0) {
        return new Response(JSON.stringify({
          redistribution_occurred: false,
          individual_rewards: {},
          individual_slashes: {},
          slashing_pool: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Aggregate gross locks per agent (keyed by agent_id, not user_id)
      const grossLocks = new Map<string, number>();
      for (const row of userLocks) {
        const agentId = (row.users as any)?.agent_id;
        if (!agentId) continue;
        grossLocks.set(agentId, (grossLocks.get(agentId) || 0) + row.belief_lock);
      }

      // Calculate raw deltas (absolute weights)
      const agentIds = Object.keys(information_scores);
      const agentDeltas = agentIds.map(id => ({
        agentId: id,
        rawMicro: Math.floor(information_scores[id] * (grossLocks.get(id) || 0))
      }));

      // Separate winners and losers
      const lossesMicro = agentDeltas.filter(d => d.rawMicro < 0).reduce((s, d) => s + Math.abs(d.rawMicro), 0);
      const gainsMicro = agentDeltas.filter(d => d.rawMicro > 0).reduce((s, d) => s + d.rawMicro, 0);

      // Calculate λ
      const lambda = gainsMicro > 0 ? lossesMicro / gainsMicro : 0;

      // Apply scaled deltas
      const finalDeltas = agentDeltas.map(d => ({
        agentId: d.agentId,
        deltaMicro: d.rawMicro > 0 ? Math.floor(d.rawMicro * lambda) : d.rawMicro
      }));

      // Zero-sum check (only enforce when there are both winners and losers)
      const totalDelta = finalDeltas.reduce((s, d) => s + d.deltaMicro, 0);

      // If there are both winners and losers, enforce strict zero-sum
      // If there are only winners or only losers, allow non-zero-sum (edge case)
      const hasWinners = gainsMicro > 0;
      const hasLosers = lossesMicro > 0;

      if (hasWinners && hasLosers && Math.abs(totalDelta) > 1) {
        throw new Error(`Zero-sum violated: Σ Δ = ${totalDelta} μUSDC (tolerance: 1 μUSDC)`);
      }

      // Update stakes atomically
      for (const { agentId, deltaMicro } of finalDeltas) {
        if (deltaMicro === 0) continue;
        await supabase.rpc('update_stake_atomic', { p_agent_id: agentId, p_delta_micro: deltaMicro });
      }

      // Build individual rewards/slashes for reporting
      const individualRewards: Record<string, number> = {};
      const individualSlashes: Record<string, number> = {};

      for (const { agentId, deltaMicro } of finalDeltas) {
        const deltaUsdc = deltaMicro / 1_000_000;
        if (deltaMicro > 0) {
          individualRewards[agentId] = deltaUsdc;
        } else if (deltaMicro < 0) {
          individualSlashes[agentId] = Math.abs(deltaUsdc);
        }
      }

      const totalSlashes = Object.values(individualSlashes).reduce((s, v) => s + v, 0);

      return new Response(JSON.stringify({
        redistribution_occurred: true,
        individual_rewards: individualRewards,
        individual_slashes: individualSlashes,
        slashing_pool: totalSlashes,
        lambda,
        total_delta_micro: totalDelta
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } finally {
      await supabase.rpc('pg_advisory_unlock', { lock_id: lockId });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
