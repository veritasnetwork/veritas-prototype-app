# P90 Redistribution Implementation Plan

**Status:** 🔴 Ready for Implementation
**Priority:** Critical - Fixes double-weighting bug, unbounded risk
**Estimated:** 3-4 hours

---

## Problems Fixed

1. **Double-weighting:** Weight counted twice (`w_i²` instead of `w_i`)
2. **Unbounded risk:** BTS scores unbounded, deltas can exceed stake
3. **Database constraint:** `information_score` limited to [-1, 1] but BTS scores are unbounded

---

## Implementation Steps

### Step 1: Database Migration (10 min)

**File:** `supabase/migrations/20251028200000_remove_information_score_constraint.sql`

**Create new migration:**
```sql
-- Remove invalid constraint on information_score
-- BTS scores are unbounded (KL divergence can be arbitrarily large)

BEGIN;

-- Drop the check constraint
ALTER TABLE stake_redistribution_events
  DROP CONSTRAINT IF EXISTS stake_redistribution_events_information_score_check;

-- Change column type from numeric(10,8) to unbounded numeric
ALTER TABLE stake_redistribution_events
  ALTER COLUMN information_score TYPE NUMERIC;

COMMENT ON COLUMN stake_redistribution_events.information_score IS
  'Raw BTS score (unbounded). Represents information contribution via KL divergence. Typically in range [-10, +10] but can be larger.';

COMMIT;
```

**Apply migration:**
```bash
npx supabase db reset  # Apply all migrations including new one
```

**Verification:**
```sql
\d stake_redistribution_events
-- Verify no CHECK constraint on information_score
-- Verify column type is NUMERIC (not numeric(10,8))
```

---

### Step 2: Update BTS Scoring (30 min)

**File:** `supabase/functions/protocol-beliefs-bts-scoring/index.ts`

#### 2.1 Update Request Interface (line 11-18)

**Before:**
```typescript
interface BTSScoringRequest {
  belief_id: string
  agent_beliefs: Record<string, number>
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  normalized_weights: Record<string, number>  // REMOVE
  agent_meta_predictions: Record<string, number>
}
```

**After:**
```typescript
interface BTSScoringRequest {
  belief_id: string
  agent_beliefs: Record<string, number>
  leave_one_out_aggregates: Record<string, number>
  leave_one_out_meta_aggregates: Record<string, number>
  agent_meta_predictions: Record<string, number>
}
```

#### 2.2 Update Response Interface (line 20-25)

**Before:**
```typescript
interface BTSScoringResponse {
  bts_scores: Record<string, number>
  information_scores: Record<string, number>  // REMOVE
  winners: string[]
  losers: string[]
}
```

**After:**
```typescript
interface BTSScoringResponse {
  bts_scores: Record<string, number>  // Raw unweighted scores (unbounded)
  winners: string[]
  losers: string[]
}
```

#### 2.3 Remove Normalized Weights Validation (around line 101-109)

**Delete this block:**
```typescript
if (!(agentId in normalized_weights)) {
  return new Response(
    JSON.stringify({ error: `Missing normalized_weight for agent ${agentId}`, code: 422 }),
    {
      status: 422,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}
```

#### 2.4 Remove Information Score Calculation (around line 122-142)

**Before:**
```typescript
// 2. Calculate BTS scores for each agent
const btsScores: Record<string, number> = {}
const informationScores: Record<string, number> = {}

for (const agentId of agentIds) {
  const pi = agent_beliefs[agentId]
  const pBarMinusI = leave_one_out_aggregates[agentId]
  const mBarMinusI = leave_one_out_meta_aggregates[agentId]
  const mi = agent_meta_predictions[agentId]
  const weight = normalized_weights[agentId]

  // BTS score
  const term1 = binaryKLDivergence(pi, mBarMinusI)
  const term2 = binaryKLDivergence(pi, pBarMinusI)
  const term3 = binaryKLDivergence(pBarMinusI, mi)

  const btsScore = term1 - term2 - term3
  const informationScore = weight * btsScore  // REMOVE

  btsScores[agentId] = btsScore
  informationScores[agentId] = informationScore  // REMOVE
}
```

**After:**
```typescript
// 2. Calculate BTS scores for each agent (raw, unweighted)
const btsScores: Record<string, number> = {}

for (const agentId of agentIds) {
  const pi = agent_beliefs[agentId]
  const pBarMinusI = leave_one_out_aggregates[agentId]
  const mBarMinusI = leave_one_out_meta_aggregates[agentId]
  const mi = agent_meta_predictions[agentId]

  // BTS score: s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)
  const term1 = binaryKLDivergence(pi, mBarMinusI)
  const term2 = binaryKLDivergence(pi, pBarMinusI)
  const term3 = binaryKLDivergence(pBarMinusI, mi)

  const btsScore = term1 - term2 - term3
  btsScores[agentId] = btsScore  // Store raw unweighted score
}
```

#### 2.5 Update Winner/Loser Partitioning (around line 144-163)

**Before:**
```typescript
// 3. Partition into winners and losers
const winners: string[] = []
const losers: string[] = []

for (const agentId of agentIds) {
  if (informationScores[agentId] > 0) {
    winners.push(agentId)
  } else if (informationScores[agentId] < 0) {
    losers.push(agentId)
  }
}

// 4. Return BTS scoring results
const response: BTSScoringResponse = {
  bts_scores: btsScores,
  information_scores: informationScores,
  winners: winners,
  losers: losers
}
```

**After:**
```typescript
// 3. Partition into winners and losers (based on raw BTS scores)
const winners: string[] = []
const losers: string[] = []

for (const agentId of agentIds) {
  if (btsScores[agentId] > 0) {
    winners.push(agentId)
  } else if (btsScores[agentId] < 0) {
    losers.push(agentId)
  }
}

// 4. Return BTS scoring results
const response: BTSScoringResponse = {
  bts_scores: btsScores,
  winners: winners,
  losers: losers
}
```

---

### Step 3: Update Epoch Processor (15 min)

**File:** `supabase/functions/protocol-belief-epoch-process/index.ts`

#### 3.1 Remove Normalized Weights from BTS Call (line 315-322)

**Before:**
```typescript
const btsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-bts-scoring', {
  belief_id: belief_id,
  agent_beliefs: agentBeliefs,
  leave_one_out_aggregates: aggregationData.leave_one_out_aggregates,
  leave_one_out_meta_aggregates: aggregationData.leave_one_out_meta_aggregates,
  normalized_weights: weightsData.weights,  // REMOVE
  agent_meta_predictions: agentMetaPredictions
})
```

**After:**
```typescript
const btsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-bts-scoring', {
  belief_id: belief_id,
  agent_beliefs: agentBeliefs,
  leave_one_out_aggregates: aggregationData.leave_one_out_aggregates,
  leave_one_out_meta_aggregates: aggregationData.leave_one_out_meta_aggregates,
  agent_meta_predictions: agentMetaPredictions
})
```

#### 3.2 Update Logging (line 324-331)

**Before:**
```typescript
console.log(`🎯 Step 5: BTS scoring complete`)
console.log(`🎯 Information scores calculated for ${Object.keys(btsData.information_scores).length} agents`)
console.log(`🎯 Winners: ${btsData.winners.length} agents (${btsData.winners.map(id => id.substring(0, 8)).join(', ')})`)
console.log(`🎯 Losers: ${btsData.losers.length} agents (${btsData.losers.map(id => id.substring(0, 8)).join(', ')})`)
const scoresSummary = Object.entries(btsData.information_scores)
  .map(([id, score]) => `${id.substring(0, 8)}:${(score as number).toFixed(3)}`)
  .join(', ')
console.log(`🎯 Information scores: ${scoresSummary}`)
```

**After:**
```typescript
console.log(`🎯 Step 5: BTS scoring complete`)
console.log(`🎯 BTS scores calculated for ${Object.keys(btsData.bts_scores).length} agents`)
console.log(`🎯 Winners: ${btsData.winners.length} agents (${btsData.winners.map(id => id.substring(0, 8)).join(', ')})`)
console.log(`🎯 Losers: ${btsData.losers.length} agents (${btsData.losers.map(id => id.substring(0, 8)).join(', ')})`)
const scoresSummary = Object.entries(btsData.bts_scores)
  .map(([id, score]) => `${id.substring(0, 8)}:${(score as number).toFixed(3)}`)
  .join(', ')
console.log(`🎯 BTS scores (raw, unbounded): ${scoresSummary}`)
```

#### 3.3 Update Redistribution Call (line 333-338)

**Before:**
```typescript
// Step 6: Stake Redistribution (ΔS = score × w_i)
const redistributionData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-stake-redistribution', {
  belief_id: belief_id,
  information_scores: btsData.information_scores,
  current_epoch: currentEpoch
})
```

**After:**
```typescript
// Step 6: Stake Redistribution (P90-scaled)
const redistributionData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-beliefs-stake-redistribution', {
  belief_id: belief_id,
  bts_scores: btsData.bts_scores,        // Raw unbounded scores
  certainty: aggregationData.certainty,  // From BD aggregate
  current_epoch: currentEpoch
})
```

---

### Step 4: Rewrite Stake Redistribution (2-2.5 hours)

**File:** `supabase/functions/protocol-beliefs-stake-redistribution/index.ts`

**Complete rewrite** - Replace entire file with P90 algorithm.

#### 4.1 Update Interfaces (line 9-13)

**Before:**
```typescript
interface Request {
  belief_id: string;
  information_scores: Record<string, number>;
  current_epoch: number;
}
```

**After:**
```typescript
interface Request {
  belief_id: string;
  bts_scores: Record<string, number>;     // Raw unbounded BTS scores
  certainty: number;                       // From BD aggregate, range [0, 1]
  current_epoch: number;
}
```

#### 4.2 Add Response Interface

**Add after Request interface:**
```typescript
interface Response {
  redistribution_occurred: boolean;
  individual_rewards: Record<string, number>;  // In USDC (display)
  individual_slashes: Record<string, number>;  // In USDC (display, absolute values)
  slashing_pool: number;                       // In USDC
  scale_k: number;                             // P90 scale factor (debugging)
  lambda: number;                              // Deprecated, always 0
  total_delta_micro: number;                   // Zero-sum check (should be 0)
}
```

#### 4.3 Update Main Handler (line 24-end)

**Replace from line 28 onwards:**

```typescript
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

    if (poolError || !pool) throw new Error(`No pool found for belief ${belief_id}`);

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
        const agentId = row.users.agent_id;
        const current = grossLocksMicro.get(agentId) || 0;
        grossLocksMicro.set(agentId, current + row.belief_lock);
      }

      const agentIds = Array.from(grossLocksMicro.keys());
      const totalLocksSum = Array.from(grossLocksMicro.values()).reduce((a, b) => a + b, 0);

      console.log(`[Redistribution] ${agentIds.length} agents with total locks = ${totalLocksSum} μUSDC ($${(totalLocksSum/1e6).toFixed(2)})`);

      // 5. Compute P90 adaptive scale
      const absScores = agentIds.map(id => Math.abs(bts_scores[id]));
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
        const s_raw = bts_scores[agentId];
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
          slashing_pool: poolSlashMicro / 1_000_000,
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
            information_score: bts_scores[agentId],  // Raw unbounded BTS score
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
```

---

## Testing Checklist

### After Step 1 (Database)
- [ ] Migration applies cleanly
- [ ] No CHECK constraint on `information_score`
- [ ] Column type is `NUMERIC` (unbounded)

### After Step 2 (BTS Scoring)
- [ ] Function deploys: `npx supabase functions deploy protocol-beliefs-bts-scoring`
- [ ] Test call returns raw BTS scores (no information_scores field)
- [ ] Winners/losers correctly identified by sign of BTS score

### After Step 3 (Epoch Processor)
- [ ] Function deploys: `npx supabase functions deploy protocol-belief-epoch-process`
- [ ] Test epoch process logs show "BTS scores (raw, unbounded)"
- [ ] Certainty value passed to redistribution

### After Step 4 (Redistribution)
- [ ] Function deploys: `npx supabase functions deploy protocol-beliefs-stake-redistribution`
- [ ] Test redistribution with 3-5 agents
- [ ] Verify P90 scale factor logged
- [ ] Verify zero-sum: `Σ Δ = 0` (exact)
- [ ] Verify bounded slashes: `slash_i ≤ certainty × lock_i`
- [ ] Verify events recorded with unbounded `information_score`
- [ ] Test idempotency: second call skips redistribution
- [ ] Test edge cases:
  - [ ] All winners (no losers)
  - [ ] All losers (no winners)
  - [ ] Zero certainty
  - [ ] Single agent
  - [ ] Extreme outlier scores

---

## Deployment Commands

```bash
# 1. Apply migration
npx supabase db reset

# 2. Deploy functions (in order)
npx supabase functions deploy protocol-beliefs-bts-scoring
npx supabase functions deploy protocol-belief-epoch-process
npx supabase functions deploy protocol-beliefs-stake-redistribution

# 3. Test epoch process
# (via admin UI or direct function call)

# 4. Verify zero-sum in database
psql $DATABASE_URL -c "
  SELECT belief_id, epoch, SUM(stake_delta) as total_delta
  FROM stake_redistribution_events
  GROUP BY belief_id, epoch
  HAVING SUM(stake_delta) != 0;
"
# Should return 0 rows
```

---

## Success Criteria

✅ **No double-weighting:** BTS scores weighted exactly once by gross lock
✅ **Bounded risk:** Max loss per pool = `certainty × lock_i ≤ lock_i`
✅ **Exact zero-sum:** `Σ Δ_i = 0` (exact integer equality)
✅ **P90 scaling:** Outliers clamped, relative magnitudes preserved
✅ **Certainty control:** Impact scales with `c ∈ [0, 1]`
✅ **Unbounded storage:** `information_score` can store large BTS values
✅ **Idempotency:** Same epoch can't be processed twice

---

## Rollback Plan

If critical issues discovered:

```bash
# 1. Revert functions via git
git checkout HEAD~1 -- supabase/functions/protocol-beliefs-bts-scoring/
git checkout HEAD~1 -- supabase/functions/protocol-belief-epoch-process/
git checkout HEAD~1 -- supabase/functions/protocol-beliefs-stake-redistribution/

# 2. Redeploy old versions
npx supabase functions deploy protocol-beliefs-bts-scoring
npx supabase functions deploy protocol-belief-epoch-process
npx supabase functions deploy protocol-beliefs-stake-redistribution

# 3. Revert migration (if needed)
npx supabase migration down
```

---

## Additional Notes

### Database Schema Status
✅ **`token_type` column already exists** in `user_pool_balances` with:
- Primary key: `(user_id, pool_address, token_type)`
- Check constraint: `token_type IN ('LONG', 'SHORT')`
- Default value: `'LONG'`

✅ **`update_stake_atomic` function already exists** with correct signature:
```sql
CREATE FUNCTION update_stake_atomic(p_agent_id UUID, p_delta_micro BIGINT)
  UPDATE agents SET total_stake = GREATEST(0, total_stake + p_delta_micro)
  WHERE id = p_agent_id
```

✅ **Current redistribution already fetches pool_address** from belief_id
✅ **Current redistribution already uses advisory locks** for concurrency protection
✅ **Current redistribution already aggregates LONG + SHORT** (line 108-113)

### What's Actually Broken

**Current flow (WRONG):**
1. BTS Scoring calculates `information_scores = normalized_weights × bts_scores` ❌ (first weighting)
2. Redistribution calculates `rawDelta = information_scores × grossLocks` ❌ (second weighting)
3. Result: `rawDelta = (w_i / Σw_j) × bts_score × w_i = (w_i² / Σw_j) × bts_score` ❌❌

**After fix (CORRECT):**
1. BTS Scoring returns raw `bts_scores` (unweighted) ✅
2. Redistribution uses P90 scaling: `slash_i = floor(certainty × max(0, -s_clamped) × w_i)` ✅
3. Result: Weight applied exactly once ✅

### Tests Will Need Updates

#### File: `tests/protocol/bts-scoring.test.ts`

**Lines to update:**

1. **Line 5-12: Request Interface**
   ```typescript
   // REMOVE normalized_weights from interface
   interface BTSScoringRequest {
     belief_id: string
     agent_beliefs: Record<string, number>
     leave_one_out_aggregates: Record<string, number>
     leave_one_out_meta_aggregates: Record<string, number>
     agent_meta_predictions: Record<string, number>  // No normalized_weights
   }
   ```

2. **Line 14-19: Response Interface**
   ```typescript
   // REMOVE information_scores from interface
   interface BTSScoringResponse {
     bts_scores: Record<string, number>
     winners: string[]
     losers: string[]
   }
   ```

3. **Line 58-80, 134-141, 161-188, etc.: Remove `normalized_weights` from all test requests**
   ```typescript
   // DELETE normalized_weights parameter from all callBTSScoring calls
   const request: BTSScoringRequest = {
     belief_id: 'test-belief',
     agent_beliefs: { 'agent-a': 0.9, 'agent-b': 0.4 },
     leave_one_out_aggregates: { 'agent-a': 0.4, 'agent-b': 0.9 },
     leave_one_out_meta_aggregates: { 'agent-a': 0.8, 'agent-b': 0.6 },
     agent_meta_predictions: { 'agent-a': 0.6, 'agent-b': 0.8 }
     // normalized_weights: { 'agent-a': 0.5, 'agent-b': 0.5 }  // DELETE THIS
   };
   ```

4. **Line 86: Remove `information_scores` check**
   ```typescript
   // DELETE: assertExists(result.information_scores);
   ```

5. **Line 94-106: Update information score tests to check BTS scores directly**
   ```typescript
   // BEFORE:
   assertAlmostEquals(
     result.information_scores['agent-a'],
     0.5 * result.bts_scores['agent-a'],
     1e-6
   );

   // AFTER: Just verify BTS scores exist and are finite
   assertExists(result.bts_scores['agent-a'], "Agent A should have BTS score");
   assert(isFinite(result.bts_scores['agent-a']), "BTS score should be finite");
   ```

6. **Line 109-115: Update winner/loser checks to use bts_scores**
   ```typescript
   // BEFORE: if (result.information_scores[agentId] > 0)
   // AFTER:
   for (const agentId of ['agent-a', 'agent-b']) {
     if (result.bts_scores[agentId] > 0) {
       assert(result.winners.includes(agentId), `${agentId} with positive score should be in winners`);
     } else if (result.bts_scores[agentId] < 0) {
       assert(result.losers.includes(agentId), `${agentId} with negative score should be in losers`);
     }
   }
   ```

7. **Line 194, 250-251, 319-323, 364-372: Update all `information_scores` references to `bts_scores`**

8. **Line 303-326: Remove zero weights test (no longer relevant)**
   ```typescript
   // DELETE entire test "BTS Scoring - Zero Weights Edge Case"
   // Weights are not part of BTS scoring anymore
   ```

#### File: `tests/protocol/stake-redistribution.test.ts`

**Lines to update:**

1. **Line 30-34: Update callRedistribution function signature**
   ```typescript
   // BEFORE:
   async function callRedistribution(params: {
     belief_id: string;
     information_scores: Record<string, number>;
     current_epoch?: number;
   })

   // AFTER:
   async function callRedistribution(params: {
     belief_id: string;
     bts_scores: Record<string, number>;  // Changed
     certainty: number;                    // Added
     current_epoch?: number;
   })
   ```

2. **Line 260-263: Update test to pass bts_scores**
   ```typescript
   const response = await callRedistribution({
     belief_id: '',
     bts_scores: { 'agent1': 0.5 },  // Changed
     certainty: 0.8                    // Added
   });
   ```

3. **Line 275-302: Update lambda test**
   ```typescript
   // BEFORE:
   const response = await callRedistribution({
     belief_id: beliefId,
     information_scores: {
       [agent1Id]: 1.0,   // Raw delta = +$10
       [agent2Id]: -1.0   // Raw delta = -$10
     }
   });

   // AFTER:
   const response = await callRedistribution({
     belief_id: beliefId,
     bts_scores: {
       [agent1Id]: 1.0,   // Raw BTS score
       [agent2Id]: -1.0   // Raw BTS score
     },
     certainty: 1.0  // Full certainty for max impact
   });

   // UPDATE ASSERTIONS:
   // Lambda is deprecated, check scale_k instead
   assertExists(data.scale_k, "Should return P90 scale factor");

   // Agent deltas will be different due to P90 scaling
   // With certainty=1.0 and scores=±1.0, slashes = locks
   assertAlmostEquals(data.individual_slashes[agent2Id], 10, 1e-6);
   ```

4. **Line 305-337: Update all test calls**
   ```typescript
   // Change all information_scores → bts_scores
   // Add certainty parameter to all calls
   const response = await callRedistribution({
     belief_id: beliefId,
     bts_scores: {  // Changed
       [agent1Id]: 1.0,
       [agent2Id]: 1.0,
       [agent3Id]: -1.0
     },
     certainty: 0.8  // Added
   });
   ```

5. **Line 296-297, 327-328: Update lambda assertions**
   ```typescript
   // BEFORE: assertAlmostEquals(data.lambda, 1.0, 1e-6);
   // AFTER: assertEquals(data.lambda, 0);  // Always 0 (deprecated)

   // Add new P90 assertions:
   assertExists(data.scale_k, "Should return P90 scale factor");
   assert(data.scale_k > 0, "P90 scale should be positive");
   ```

6. **Update all remaining test calls (lines 339-686)**
   - Change `information_scores` → `bts_scores`
   - Add `certainty: 1.0` for most tests (max impact)
   - Use `certainty: 0.5` for tests checking dampened slashes

7. **Line 466-497: Update max loss test**
   ```typescript
   // With P90 and certainty, max loss = certainty × lock
   const response = await callRedistribution({
     belief_id: scenario.beliefId,
     bts_scores: {
       [scenario.agent1Id]: -1.0  // Worst possible
     },
     certainty: 1.0  // Max certainty
   });

   const loss = initialStake - finalStake;
   assertEquals(loss, 10_000_000);  // Full lock amount
   ```

8. **Line 575-576: Update event assertions**
   ```typescript
   // BEFORE: assertEquals(winnerEvent.information_score, 0.5);
   // AFTER:
   assertExists(winnerEvent.information_score, "Event should record BTS score");
   // Note: This is now the raw BTS score (unbounded)
   ```

#### New Tests to Add

**Add to `tests/protocol/stake-redistribution.test.ts`:**

```typescript
Deno.test("P90 scaling clamps extreme outliers", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id, agent3Id } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,  // $10
    agent2Lock: 10_000_000,  // $10
    agent3Lock: 10_000_000   // $10
  });

  // One extreme outlier, two normal scores
  const response = await callRedistribution({
    belief_id: beliefId,
    bts_scores: {
      [agent1Id]: 100.0,  // Extreme outlier
      [agent2Id]: 1.0,    // Normal
      [agent3Id]: -1.0    // Normal loser
    },
    certainty: 1.0
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // P90 should be ~100, so agent1 score = 100/100 = 1.0 (clamped)
  // agent2 score = 1.0/100 = 0.01
  // agent3 score = -1.0/100 = -0.01
  assertExists(data.scale_k);
  assert(data.scale_k > 50, "P90 should detect outlier");

  await teardown();
});

Deno.test("certainty scales impact (c=0.5 → half slashes)", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id } = await setupTwoAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    bts_scores: {
      [agent1Id]: 1.0,
      [agent2Id]: -1.0
    },
    certainty: 0.5  // Half certainty
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // With c=0.5, loser slashed 50% of lock
  assertAlmostEquals(data.individual_slashes[agent2Id], 5.0, 1e-6);

  await teardown();
});

Deno.test("zero-sum with largest-remainders (exact)", async () => {
  setup();
  const { beliefId, agent1Id, agent2Id, agent3Id } = await setupThreeAgentScenario({
    agent1Lock: 10_000_000,
    agent2Lock: 10_000_000,
    agent3Lock: 7_000_000  // Odd amount
  });

  const response = await callRedistribution({
    belief_id: beliefId,
    bts_scores: {
      [agent1Id]: 0.6,
      [agent2Id]: 0.4,
      [agent3Id]: -1.0
    },
    certainty: 1.0
  });

  assertEquals(response.status, 200);
  const data = await response.json();

  // Must be EXACTLY 0 (not within tolerance)
  assertEquals(data.total_delta_micro, 0, "Zero-sum must be exact");

  await teardown();
});
```

### No Additional Database Migrations Needed

The only schema change is removing the `information_score` constraint (Step 1).
Everything else (token_type, update_stake_atomic, advisory locks) is already implemented.

---

*Last updated: 2025-01-28*