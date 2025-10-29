import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Request {
  belief_id: string;
  bts_scores: Record<string, number>;
  certainty: number;
  current_epoch: number;
}

interface Response {
  redistribution_occurred: boolean;
  individual_rewards: Record<string, number>;
  individual_slashes: Record<string, number>;
  slashing_pool: number;
  scale_k: number;
  lambda: number;
  total_delta_micro: number;
  skipped?: boolean;
  reason?: string;
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
    const { belief_id, bts_scores, certainty, current_epoch } = await req.json() as Request;

    // Validate required parameters
    if (!belief_id) throw new Error('belief_id is required');
    if (!bts_scores) throw new Error('bts_scores is required');
    if (certainty === undefined || certainty === null) throw new Error('certainty is required');
    if (current_epoch === undefined || current_epoch === null) throw new Error('current_epoch is required');

    // Validate certainty range
    if (certainty < 0 || certainty > 1) throw new Error('certainty must be in range [0, 1]');

    console.log(`[Redistribution] belief_id=${belief_id}, epoch=${current_epoch}, certainty=${certainty.toFixed(3)}`);

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // 1. Fetch pool_address from belief_id
    const { data: pool, error: poolError } = await supabase
      .from('pool_deployments')
      .select('pool_address')
      .eq('belief_id', belief_id)
      .single();

    if (poolError) {
      console.error(`Pool query error for belief ${belief_id}:`, poolError);
      throw new Error(`Pool query failed: ${poolError.message} (${poolError.code})`);
    }
    if (!pool) throw new Error(`No pool found for belief ${belief_id}`);

    const poolAddress = pool.pool_address;
    const lockId = hashPoolAddress(poolAddress);

    console.log(`[Redistribution] pool_address=${poolAddress}`);

    // 2. Acquire advisory lock
    await supabase.rpc('pg_advisory_lock', { lock_id: lockId });

    try {
      // 3. Idempotency check
      const { data: existingEvents, error: checkError } = await supabase
        .from('stake_redistribution_events')
        .select('agent_id')
        .eq('belief_id', belief_id)
        .eq('epoch', current_epoch)
        .limit(1);

      if (existingEvents && existingEvents.length > 0) {
        console.log(`⏭️  Redistribution already completed for belief ${belief_id} epoch ${current_epoch}`);
        return new Response(JSON.stringify({
          redistribution_occurred: false,
          individual_rewards: {},
          individual_slashes: {},
          slashing_pool: 0,
          scale_k: 0,
          lambda: 0,
          total_delta_micro: 0,
          skipped: true,
          reason: 'already_redistributed'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 4. Get gross locks (LONG + SHORT) per agent
      const { data: userLocks, error: locksError } = await supabase
        .from('user_pool_balances')
        .select('user_id, belief_lock, token_type, users!inner(agent_id)')
        .eq('pool_address', poolAddress)
        .gt('token_balance', 0);

      if (locksError) throw new Error(`Failed to get locks: ${locksError.message}`);
      if (!userLocks || userLocks.length === 0) {
        console.log('⏭️  No participants with active positions - skipping redistribution');
        return new Response(JSON.stringify({
          redistribution_occurred: false,
          individual_rewards: {},
          individual_slashes: {},
          slashing_pool: 0,
          scale_k: 0,
          lambda: 0,
          total_delta_micro: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Aggregate gross locks per agent (sum LONG + SHORT)
      const grossLocksMicro = new Map<string, number>();
      for (const row of userLocks) {
        const agentId = (row.users as any).agent_id;
        const current = grossLocksMicro.get(agentId) || 0;
        grossLocksMicro.set(agentId, current + row.belief_lock);
      }

      const agentIds = Array.from(grossLocksMicro.keys());
      const totalLocksSum = Array.from(grossLocksMicro.values()).reduce((a, b) => a + b, 0);

      console.log(`[Redistribution] ${agentIds.length} agents with total locks = ${totalLocksSum} μUSDC ($${(totalLocksSum/1e6).toFixed(2)})`);

      // 5. Compute P90 adaptive scale
      const absScores = agentIds.map(id => Math.abs(bts_scores[id] || 0));
      absScores.sort((a, b) => a - b);  // Ascending

      const N = absScores.length;
      const r = Math.ceil(0.90 * N);  // 90th percentile index (1-indexed)
      const k_raw = absScores[r - 1];  // 0-indexed array
      const k_floor = 0.1;
      const k = Math.max(k_raw, k_floor);

      console.log(`[P90] N=${N}, P90_index=${r}, k_raw=${k_raw.toFixed(3)}, k=${k.toFixed(3)}`);

      // 6. Clamp scores to [-1, 1]
      const clampedScores = new Map<string, number>();
      for (const agentId of agentIds) {
        const s_raw = bts_scores[agentId] || 0;
        const s_clamped = Math.min(Math.max(s_raw / k, -1), 1);
        clampedScores.set(agentId, s_clamped);

        if (Math.abs(s_raw) > k * 1.5) {
          console.log(`[Clamp] Agent ${agentId.substring(0,8)}: ${s_raw.toFixed(3)} → ${s_clamped.toFixed(3)} (outlier)`);
        }
      }

      // 7. Compute noise and signal magnitudes
      const noiseMicro = new Map<string, number>();   // Losers
      const signalMicro = new Map<string, number>();  // Winners

      for (const agentId of agentIds) {
        const s_clamped = clampedScores.get(agentId)!;
        const w_micro = grossLocksMicro.get(agentId)!;

        // Noise (losers)
        noiseMicro.set(agentId, Math.max(0, -s_clamped) * w_micro);

        // Signal (winners)
        signalMicro.set(agentId, Math.max(0, s_clamped) * w_micro);
      }

      const totalSignalMicro = Array.from(signalMicro.values()).reduce((a, b) => a + b, 0);

      // 8. Calculate loser slashes (certainty-scaled)
      const slashesMicro = new Map<string, number>();
      let poolSlashMicro = 0;

      for (const agentId of agentIds) {
        const n_micro = noiseMicro.get(agentId)!;
        const n_usdc = n_micro / 1_000_000;
        const slash_usdc = certainty * n_usdc;
        const slash_micro = Math.floor(slash_usdc * 1_000_000);

        slashesMicro.set(agentId, slash_micro);
        poolSlashMicro += slash_micro;
      }

      console.log(`[Slashes] PoolSlash=${poolSlashMicro} μUSDC ($${(poolSlashMicro/1e6).toFixed(2)})`);

      // 9. Check for edge cases
      if (totalSignalMicro === 0) {
        console.log('⏭️  No winners (all scores <= 0) - skipping redistribution');
        return new Response(JSON.stringify({
          redistribution_occurred: false,
          individual_rewards: {},
          individual_slashes: {},
          slashing_pool: 0,
          scale_k: k,
          lambda: 0,
          total_delta_micro: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (poolSlashMicro === 0) {
        console.log('⏭️  No losers (all scores >= 0 or certainty = 0) - skipping redistribution');
        return new Response(JSON.stringify({
          redistribution_occurred: false,
          individual_rewards: {},
          individual_slashes: {},
          slashing_pool: 0,
          scale_k: k,
          lambda: 0,
          total_delta_micro: 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 10. Distribute to winners (largest-remainders for exact zero-sum)
      const rewardsMicro = new Map<string, number>();

      // First pass: floor allocation
      for (const agentId of agentIds) {
        const p_micro = signalMicro.get(agentId)!;
        const reward_base = Math.floor((poolSlashMicro * p_micro) / totalSignalMicro);
        rewardsMicro.set(agentId, reward_base);
      }

      // Compute remainder
      const allocated = Array.from(rewardsMicro.values()).reduce((a, b) => a + b, 0);
      const remainder = poolSlashMicro - allocated;

      console.log(`[Distribution] Allocated=${allocated}, Remainder=${remainder} μUSDC`);

      // Largest-remainders method
      if (remainder > 0) {
        const winners = agentIds.filter(id => signalMicro.get(id)! > 0);
        const residuals = winners
          .map(id => ({
            agentId: id,
            residual: (poolSlashMicro * signalMicro.get(id)!) % totalSignalMicro
          }))
          .sort((a, b) => {
            if (b.residual !== a.residual) return b.residual - a.residual;
            return a.agentId.localeCompare(b.agentId);  // Deterministic tie-break
          });

        for (let i = 0; i < remainder; i++) {
          const agentId = residuals[i].agentId;
          rewardsMicro.set(agentId, rewardsMicro.get(agentId)! + 1);
          console.log(`[Remainder] +1 μUSDC to ${agentId.substring(0,8)}`);
        }
      }

      // 11. HARD-ENFORCE zero-sum (exact micro-unit equality)
      let totalDeltaMicro = 0;
      for (const agentId of agentIds) {
        const reward = rewardsMicro.get(agentId) || 0;
        const slash = slashesMicro.get(agentId) || 0;
        const delta = reward - slash;
        totalDeltaMicro += delta;
      }

      if (totalDeltaMicro !== 0) {
        console.error(`❌ ZERO-SUM VIOLATION: Σ Δ = ${totalDeltaMicro} μUSDC`);
        console.error(`   PoolSlash: ${poolSlashMicro}`);
        console.error(`   Total Rewards: ${Array.from(rewardsMicro.values()).reduce((a,b)=>a+b,0)}`);
        console.error(`   Total Slashes: ${poolSlashMicro}`);
        throw new Error(`Zero-sum violated: Σ Δ = ${totalDeltaMicro} μUSDC (expected exactly 0)`);
      }

      console.log(`✅ Zero-sum verified: Σ Δ = 0 μUSDC`);

      // 12. Update stakes ATOMICALLY and record events
      for (const agentId of agentIds) {
        const reward_micro = rewardsMicro.get(agentId) || 0;
        const slash_micro = slashesMicro.get(agentId) || 0;
        const delta_micro = reward_micro - slash_micro;

        if (delta_micro === 0) continue;

        // Get stake before
        const { data: agentBefore, error: beforeError } = await supabase
          .from('agents')
          .select('total_stake')
          .eq('id', agentId)
          .single();

        if (beforeError || !agentBefore) {
          throw new Error(`Failed to get agent ${agentId} stake: ${beforeError?.message}`);
        }

        const stakeBeforeMicro = agentBefore.total_stake;

        // Update atomically
        const { error: updateError } = await supabase.rpc('update_stake_atomic', {
          p_agent_id: agentId,
          p_delta_micro: delta_micro
        });

        if (updateError) {
          throw new Error(`Failed to update stake for agent ${agentId}: ${updateError.message}`);
        }

        // Get stake after for verification
        const { data: agentAfter, error: afterError } = await supabase
          .from('agents')
          .select('total_stake')
          .eq('id', agentId)
          .single();

        if (afterError || !agentAfter) {
          throw new Error(`Failed to get agent ${agentId} stake after update: ${afterError?.message}`);
        }

        const stakeAfterMicro = agentAfter.total_stake;
        const expectedAfter = Math.max(0, stakeBeforeMicro + delta_micro);

        if (stakeAfterMicro !== expectedAfter) {
          console.error(`⚠️  Stake update mismatch for agent ${agentId}: expected ${expectedAfter}, got ${stakeAfterMicro}`);
        }

        // Calculate normalized weight for audit trail
        const normalizedWeight = totalLocksSum > 0
          ? (grossLocksMicro.get(agentId)! / totalLocksSum)
          : 0;

        // Record event
        const { error: eventError } = await supabase
          .from('stake_redistribution_events')
          .insert({
            belief_id: belief_id,
            epoch: current_epoch,
            agent_id: agentId,
            information_score: bts_scores[agentId] || 0,  // Raw unbounded BTS score
            belief_weight: grossLocksMicro.get(agentId)!,
            normalized_weight: normalizedWeight,
            stake_before: stakeBeforeMicro,
            stake_delta: delta_micro,
            stake_after: stakeAfterMicro,
            recorded_by: 'server'
          });

        if (eventError) {
          if (eventError.code === '23505') {  // Unique constraint violation
            console.log(`⏭️  Event already recorded for agent ${agentId}`);
          } else {
            throw new Error(`Failed to record event for agent ${agentId}: ${eventError.message}`);
          }
        }

        console.log(`💰 ${agentId.substring(0,8)}: ${stakeBeforeMicro} → ${stakeAfterMicro} (Δ${delta_micro})`);
      }

      // 13. Build response (convert to USDC for display)
      const individualRewards: Record<string, number> = {};
      const individualSlashes: Record<string, number> = {};

      for (const agentId of agentIds) {
        const reward_micro = rewardsMicro.get(agentId) || 0;
        const slash_micro = slashesMicro.get(agentId) || 0;

        if (reward_micro > 0) {
          individualRewards[agentId] = reward_micro / 1_000_000;
        }
        if (slash_micro > 0) {
          individualSlashes[agentId] = slash_micro / 1_000_000;
        }
      }

      return new Response(JSON.stringify({
        redistribution_occurred: true,
        individual_rewards: individualRewards,
        individual_slashes: individualSlashes,
        slashing_pool: poolSlashMicro / 1_000_000,
        scale_k: k,
        lambda: 0,  // Deprecated
        total_delta_micro: totalDeltaMicro
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } finally {
      // 14. Release advisory lock
      await supabase.rpc('pg_advisory_unlock', { lock_id: lockId });
    }

  } catch (error) {
    console.error('Error in stake redistribution:', error);
    return new Response(JSON.stringify({
      error: error.message,
      code: 500
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
