# Belief Weight Refactor - Breaking Changes Analysis

**Date:** 2025-01-22
**Status:** 🔴 BREAKING CHANGES IDENTIFIED

---

## Executive Summary

**CRITICAL:** This refactor introduces **BREAKING CHANGES** that will affect:
- 3 edge functions (function signatures changed)
- 2 test suites (expect `effective_stakes` in responses)
- 1 deprecated function (protocol-epochs-process)

**Migration Required:** Yes - data model changes from `effective_stake` to `belief_weight`

---

## Breaking Changes by Component

### 1. protocol-weights-calculate (BREAKING)

**Current Response:**
```typescript
{
  weights: Record<string, number>,           // Normalized weights (sum = 1.0)
  effective_stakes: Record<string, number>   // ❌ REMOVED
}
```

**New Response:**
```typescript
{
  weights: Record<string, number>,         // Normalized weights (sum = 1.0)
  belief_weights: Record<string, number>   // ✅ NEW (raw w_i values)
}
```

**Impact:**
- ❌ **BREAKS:** Tests expect `data.effective_stakes` (epistemic-weights.test.ts:60, 79, 80, 99)
- ❌ **BREAKS:** protocol-belief-epoch-process reads `weightsData.effective_stakes` (line 222-224)
- ❌ **BREAKS:** protocol-epochs-process (deprecated) reads `weightsData.effective_stakes`

**Callsites:**
- supabase/functions/protocol-belief-epoch-process/index.ts:149-152
- supabase/functions/protocol-epochs-process/index.ts (DEPRECATED)
- tests/protocol/epistemic-weights.test.ts
- tests/protocol/belief-aggregation.test.ts

---

### 2. protocol-beliefs-stake-redistribution (BREAKING)

**Current Request:**
```typescript
interface StakeRedistributionRequest {
  belief_id: string
  information_scores: Record<string, number>
  winners: string[]
  losers: string[]
  current_effective_stakes: Record<string, number>  // ❌ REMOVED
}
```

**New Request:**
```typescript
interface StakeRedistributionRequest {
  belief_id: string
  information_scores: Record<string, number>
  belief_weights: Record<string, number>  // ✅ NEW (w_i per agent)
}
```

**Current Logic:**
```typescript
// Calculate slashing pool from effective stakes
for (const loserId of losers) {
  slashing_pool += current_effective_stakes[loserId]
}

// Distribute to winners proportionally
for (const winnerId of winners) {
  individualRewards[winnerId] = (score / totalScore) * slashing_pool
}
```

**New Logic:**
```typescript
// ΔS = score × w_i for each agent (NO slashing pool)
for (const agentId in information_scores) {
  const score = information_scores[agentId]
  const w_i = belief_weights[agentId]
  const delta = score * w_i

  // Update global stake
  const currentStake = agents[agentId].total_stake
  const newStake = Math.max(0, currentStake + delta)
  await updateStake(agentId, newStake)
}
```

**Impact:**
- ❌ **BREAKS:** Function signature completely different
- ❌ **BREAKS:** Removes `winners` and `losers` parameters (not needed in new model)
- ❌ **BREAKS:** Tests expect `current_effective_stakes` parameter (stake-redistribution.test.ts:10, 123)
- ❌ **BREAKS:** Changes redistribution semantics (no slashing pool, direct ΔS application)

**Callsites:**
- supabase/functions/protocol-belief-epoch-process/index.ts:320-326
- supabase/functions/protocol-epochs-process/index.ts (DEPRECATED)
- tests/protocol/stake-redistribution.test.ts

---

### 3. protocol-belief-epoch-process (BREAKING)

**Current Flow:**
```typescript
// Line 149: Get effective_stakes from weights calculation
const weightsData = await callInternalFunction('protocol-weights-calculate', {...})

// Line 222-224: Sum effective stakes for history
const totalStake = Object.values(weightsData.effective_stakes).reduce(...)

// Line 325: Pass to redistribution
await callInternalFunction('protocol-beliefs-stake-redistribution', {
  current_effective_stakes: weightsData.effective_stakes
})
```

**New Flow:**
```typescript
// Line 149: Get belief_weights from weights calculation
const weightsData = await callInternalFunction('protocol-weights-calculate', {...})

// Line 222-224: Sum belief weights for history
const totalStake = Object.values(weightsData.belief_weights).reduce(...)

// Line 320: Pass to redistribution (NEW SIGNATURE)
await callInternalFunction('protocol-beliefs-stake-redistribution', {
  information_scores: btsData.information_scores,
  belief_weights: weightsData.belief_weights
})
```

**Impact:**
- ⚠️ **CHANGES:** Internal function calls updated
- ✅ **NON-BREAKING:** External API unchanged (still accepts belief_id, current_epoch)
- ⚠️ **SEMANTIC CHANGE:** Different redistribution results (ΔS = score × w_i vs slashing pool)

---

## Test Suite Impact

### tests/protocol/epistemic-weights.test.ts

**Broken Assertions:**
```typescript
// Line 60
assertEquals(data.effective_stakes[agentId], 50) // ❌ Field doesn't exist

// Line 79-80
assertEquals(data.effective_stakes[agent1Id], 50) // ❌
assertEquals(data.effective_stakes[agent2Id], 50) // ❌

// Line 99-101
assertEquals(Math.abs(data.weights[agent1Id] - 0.8) < EPSILON_PROBABILITY, true)
// Expects effective_stake = 100 vs 25 (4:1 ratio)
```

**Required Changes:**
- Replace `effective_stakes` assertions with `belief_weights`
- **BUT:** Test logic is fundamentally different:
  - Old: Creates beliefs, counts active positions, calculates S/n
  - New: Must create trades first to set user_pool_balances.belief_lock

**Migration Strategy:**
- Need to create actual pool trades in test setup
- Cannot test without pool_address → user_pool_balances → belief_lock data

### tests/protocol/stake-redistribution.test.ts

**Broken Calls:**
```typescript
// Line 123: Passes current_effective_stakes
const request: StakeRedistributionRequest = {
  current_effective_stakes: {}  // ❌ Parameter removed
}
```

**Required Changes:**
- Update interface to use `belief_weights` instead
- Remove `winners` and `losers` parameters
- Update expected behavior (no slashing pool model)

---

## Data Dependencies

### Critical Missing Link:

**Current System:**
- `protocol-weights-calculate` uses `active_belief_count` from agents table
- Calculates `effective_stake = total_stake / active_belief_count` dynamically

**New System:**
- `protocol-weights-calculate` must query `user_pool_balances.belief_lock`
- **Requires:** pool_address from pool_deployments

**Query Chain:**
```sql
-- Given belief_id, get belief_lock for agent:
SELECT upb.belief_lock
FROM user_pool_balances upb
JOIN pool_deployments pd ON pd.pool_address = upb.pool_address
WHERE pd.belief_id = $belief_id
  AND upb.user_id = (SELECT id FROM users WHERE agent_id = $agent_id)
  AND upb.token_balance > 0
```

**Problem:** Tests create beliefs WITHOUT pools or trades!

**Current Test Setup:**
```typescript
// Creates agent + belief, but NO pool, NO trades
const agentId = await createTestAgent(100, 2)
const { data } = await callWeightsCalculate({
  belief_id: 'test-belief-1',
  participant_agents: [agentId]
})
```

**New Requirements:**
```typescript
// Must create: belief → pool → trade → user_pool_balances
const agentId = await createTestAgent()
const beliefId = await createTestBelief(agentId)
const poolAddress = await deployPool(beliefId)
await recordTrade({
  user_id: getUserId(agentId),
  pool_address: poolAddress,
  trade_type: 'buy',
  usdc_amount: 100_000_000  // Sets belief_lock = 2M micro-USDC
})
const { data } = await callWeightsCalculate({
  belief_id: beliefId,
  participant_agents: [agentId]
})
```

---

## Architectural Concerns

### 1. Circular Dependency Risk

**New Flow:**
```
belief_submission → requires pool_address
                 → requires pool deployment
                 → requires belief_id
```

**Question:** Can users submit beliefs BEFORE pools are deployed?

**Current Code (app/api/trades/record/route.ts:143-181):**
- Belief submission happens DURING trade recording
- Pool must already exist

**Implication:** This is fine - pools are deployed before trading begins.

### 2. Zero-Sum Conservation

**Old Model:**
```typescript
// Slashing pool collected from losers
slashing_pool = Σ effective_stakes[loser]

// Distributed to winners
total_rewards = slashing_pool  // Exactly zero-sum
```

**New Model:**
```typescript
// Each agent independently: ΔS = score × w_i
Σ ΔS = Σ (score × w_i)
     = Σ score × w_i
```

**Conservation Requirement:**
```
Σ_all_agents (score_i × w_i) = 0  // BTS must ensure this
```

**Risk:** If BTS scoring doesn't guarantee Σ scores = 0, we'll create/destroy stake!

**Mitigation:** BTS scoring already enforces zero-sum via normalization.

### 3. Belief Lock Staleness

**Scenario:**
1. User makes $100 trade → belief_lock = $2
2. User makes another $10 trade → belief_lock = $0.20 (OVERWRITTEN)
3. Epoch processes → uses $0.20, not $2

**Question:** Should belief_lock be cumulative or last-trade-only?

**Current Implementation (app/api/trades/record/route.ts:205-206):**
```typescript
last_buy_amount: usdcAmount,      // Overwrites previous
belief_lock: usdcAmount * 0.02    // Overwrites previous
```

**Implication:** Only last trade counts. Earlier trades are forgotten.

**Is this correct?** Per your spec: "w_i = 2% × last_trade_amount" → YES, last trade only.

### 4. Position Exit Handling

**Current Logic:**
```typescript
// Only enforce belief_lock while token_balance > 0
SELECT belief_lock WHERE token_balance > 0
```

**Scenario:**
1. User buys $100 → belief_lock = $2, token_balance = X
2. User sells ALL → token_balance = 0
3. Epoch processes → belief_lock ignored (WHERE clause filters out)

**Question:** Should user still participate in BTS if they exited position?

**Current Behavior:** Belief submission persists even after position exit.

**Conflict:**
- `belief_submissions` table has the submission (p, m values)
- But `user_pool_balances.belief_lock = 0` (or filtered out by WHERE clause)

**Result:** Agent participates with w_i = 0 → zero weight in aggregation → no stake redistribution

**Is this correct?** Probably not. Should clean up submissions when position exits.

---

## Migration Plan

### Phase 1: Code Changes (BREAKING)

**Files to modify:**
1. ✅ `supabase/functions/protocol-weights-calculate/index.ts`
   - Change response: `effective_stakes` → `belief_weights`
   - Change logic: Query `user_pool_balances.belief_lock` instead of calculating S/n

2. ✅ `supabase/functions/protocol-beliefs-stake-redistribution/index.ts`
   - Change request: `current_effective_stakes` → `belief_weights`
   - Remove: `winners`, `losers` parameters
   - Change logic: ΔS = score × w_i (no slashing pool)

3. ✅ `supabase/functions/protocol-belief-epoch-process/index.ts`
   - Update line 222-224: `effective_stakes` → `belief_weights`
   - Update line 320-326: New redistribution call signature

4. ⚠️ `supabase/functions/protocol-epochs-process/index.ts` (DEPRECATED)
   - Mark as broken or update to match new API

### Phase 2: Test Updates (BREAKING)

**Files to modify:**
1. ✅ `tests/protocol/epistemic-weights.test.ts`
   - Replace `effective_stakes` assertions with `belief_weights`
   - Add pool deployment + trade setup to tests
   - Verify w_i matches `belief_lock` from database

2. ✅ `tests/protocol/stake-redistribution.test.ts`
   - Update interface: `current_effective_stakes` → `belief_weights`
   - Remove `winners`/`losers` arrays
   - Update expected behavior: no slashing pool, direct ΔS

3. ✅ `tests/protocol/belief-aggregation.test.ts`
   - Check if it uses `effective_stakes` anywhere

### Phase 3: Edge Cases

**Handle:**
1. ✅ Position exit → Clean up belief submission OR allow w_i = 0
2. ✅ Multiple trades → Last trade overwrites (confirm this is correct)
3. ✅ Zero-sum enforcement → Add assertion in redistribution
4. ✅ Missing belief_lock → Fall back to equal weights or error?

### Phase 4: Deployment Strategy

**Option A: Big Bang (NOT RECOMMENDED)**
- Deploy all changes at once
- High risk of breakage

**Option B: Feature Flag (RECOMMENDED)**
- Add `use_belief_weights` flag to system_config
- Both code paths coexist
- Gradual migration

**Option C: Parallel Testing (SAFEST)**
- Deploy new functions with different names
- Run both systems in parallel
- Compare outputs before switching

---

## Rollback Strategy

### If Refactor Fails:

**Immediate Rollback:**
1. Revert function deployments to previous versions
2. Old code continues to work (no schema changes required)

**Data Cleanup:**
- No data migration needed (belief_lock column already exists)
- Can ignore `belief_weights` field if present

**Timing:**
- Rollback window: < 5 minutes (edge function redeployment)

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| Tests fail | 🔴 High | 100% | Update tests as part of refactor |
| Zero-sum violation | 🔴 High | Low | Add assertion in redistribution |
| Missing belief_lock data | 🟡 Medium | Medium | Handle gracefully (equal weights fallback) |
| Position exit edge case | 🟡 Medium | High | Document behavior or add cleanup |
| Deprecated function breaks | 🟢 Low | 100% | Already deprecated, low impact |

---

## Recommendations

### BEFORE Implementation:

1. ✅ **Verify belief_lock population**
   - Check that trades are correctly setting `user_pool_balances.belief_lock`
   - Query existing data to confirm non-zero values

2. ✅ **Clarify position exit behavior**
   - Should belief submissions be deleted when token_balance → 0?
   - Or should they remain with w_i = 0?

3. ✅ **Add zero-sum assertion**
   - In `protocol-beliefs-stake-redistribution`, assert:
   ```typescript
   const totalDelta = Object.values(deltas).reduce((sum, d) => sum + d, 0)
   if (Math.abs(totalDelta) > 0.01) {
     throw new Error('Zero-sum violation: ' + totalDelta)
   }
   ```

4. ✅ **Test with real data**
   - Create pool → trade → epoch process flow
   - Verify w_i matches expectations

### AFTER Implementation:

1. ✅ **Monitor zero-sum conservation**
   - Log total ΔS per belief
   - Alert if |Σ ΔS| > threshold

2. ✅ **Track belief_lock = 0 cases**
   - How often do agents have submissions without open positions?
   - Should this be prevented?

---

## Timeline Estimate

- **Code Changes:** 6-8 hours
- **Test Updates:** 4-6 hours
- **Integration Testing:** 4 hours
- **Edge Case Handling:** 2-4 hours
- **Deployment + Monitoring:** 2 hours

**Total:** 18-24 hours (2-3 days)

---

**Status:** Ready for implementation with known breaking changes documented
