# Belief Weight Refactor: Use w_i = belief_lock

**Date:** 2025-01-22
**Status:** 🎯 ARCHITECTURAL DESIGN - READY FOR IMPLEMENTATION

---

## Executive Summary

**Current Problem:** Epoch processing calculates `effective_stake = S / n` dynamically, creating race conditions when processing multiple beliefs sequentially.

**Solution:** Use `w_i = 2% × last_trade_amount` (already stored in `user_pool_balances.belief_lock`) as the fixed weight per belief.

**Redistribution Model:**
```
ΔS_i = score_i × w_i
S_new = clamp(S_prev + Σ ΔS_i, 0)
```

**Stake at Risk per Belief:** Exactly `w_i` (2% of last trade amount on that belief)
- Max loss when score = -1: `-w_i`
- Max gain when score = +1: `+w_i`
- Voice = Risk (larger trades = more influence AND more at stake)

---

## New Framework

### Core Principle:
- **Global stake S**: One balance per agent (`agents.total_stake`), changes via BTS
- **Per-belief weight w_i**: `w_i = 2% × last_trade_amount` (stored in `user_pool_balances.belief_lock`)
- **Stake at risk**: Exactly `w_i` for that belief (nothing more, nothing less)
- **No escrow**: Just record w_i, stake remains fungible

---

## Current State

### ✅ Already Implemented:

```sql
-- user_pool_balances table
last_buy_amount NUMERIC  -- USDC amount of most recent buy
belief_lock NUMERIC      -- 2% of last_buy_amount (= w_i)
```

Populated in [app/api/trades/record/route.ts:205](app/api/trades/record/route.ts#L205):
```typescript
last_buy_amount: usdcAmount,      // Full USDC amount
belief_lock: usdcAmount * 0.02    // w_i = 2% stake weight
```

### ❌ Not Using It:

Current epoch processing calculates:
```typescript
effective_stake = agents.total_stake / active_position_count  // WRONG
```

Should use:
```typescript
w_i = belief_lock  // From user_pool_balances
```

---

## Data Flow

### Relationship Chain:

```
belief_submissions
  → belief_id
    → pool_deployments.belief_id
      → pool_deployments.pool_address
        → user_pool_balances.pool_address
          → user_pool_balances.belief_lock (= w_i)
```

### Query Pattern:

```sql
-- For a given belief_id and agent_id, get w_i:
SELECT upb.belief_lock
FROM user_pool_balances upb
JOIN pool_deployments pd ON pd.pool_address = upb.pool_address
WHERE pd.belief_id = $belief_id
  AND upb.user_id = (SELECT id FROM users WHERE agent_id = $agent_id)
  AND upb.token_balance > 0;  -- Only if position is open
```

**Key point:** `belief_lock` is only enforced while `token_balance > 0`

---

## Files Requiring Changes

### 1. Weights Calculation (MAJOR REFACTOR)

**File:** `supabase/functions/protocol-weights-calculate/index.ts`

**Current approach (LINES 63-135):**
```typescript
// Query agents.total_stake
const agentData.total_stake

// Count open positions from user_pool_balances
const activePositionCount = openPositions?.length || 0

// Calculate ephemeral effective stake
effectiveStake = agentData.total_stake / activePositionCount  // ❌ WRONG
```

**New approach:**
```typescript
// 1. Get pool_address for this belief
const { data: poolDeployment } = await supabaseClient
  .from('pool_deployments')
  .select('pool_address')
  .eq('belief_id', belief_id)
  .single();

const poolAddress = poolDeployment.pool_address;

// 2. For each participant agent, get their belief_lock
const weights: Record<string, number> = {};

for (const agentId of participant_agents) {
  // Get user_id from agent_id
  const { data: user } = await supabaseClient
    .from('users')
    .select('id')
    .eq('agent_id', agentId)
    .single();

  // Get belief_lock (= w_i) from user_pool_balances
  const { data: balance } = await supabaseClient
    .from('user_pool_balances')
    .select('belief_lock, token_balance')
    .eq('user_id', user.id)
    .eq('pool_address', poolAddress)
    .single();

  // Only use belief_lock if position is open
  const w_i = (balance && balance.token_balance > 0)
    ? balance.belief_lock
    : 0;

  weights[agentId] = w_i;
}

// 3. Normalize to sum = 1.0
const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);

if (totalWeight > EPSILON_STAKES) {
  for (const agentId of participant_agents) {
    weights[agentId] = weights[agentId] / totalWeight;
  }
} else {
  // Equal weights if no stakes
  for (const agentId of participant_agents) {
    weights[agentId] = 1.0 / participant_agents.length;
  }
}

return { weights, belief_weights: weights };  // Note: No more effective_stakes
```

**Changes:**
- ❌ Remove `effective_stakes` return value
- ✅ Add `belief_weights` (raw w_i values before normalization)
- ✅ Query `user_pool_balances.belief_lock` directly

### 2. Epoch Processing (MINIMAL CHANGES)

**File:** `supabase/functions/protocol-belief-epoch-process/index.ts`

**Line 149:** Calls weights calculation
```typescript
const weightsData = await callInternalFunction(supabaseUrl, anonKey, 'protocol-weights-calculate', {
  belief_id: belief_id,
  participant_agents: participantAgents
})
```

**Line 222-224:** Records total_stake in history
```typescript
// BEFORE: Sum of effective_stakes
const totalStake = Object.values(weightsData.effective_stakes as Record<string, number>)
  .reduce((sum: number, stake: number) => sum + stake, 0)

// AFTER: Sum of belief_weights (raw w_i values)
const totalStake = Object.values(weightsData.belief_weights as Record<string, number>)
  .reduce((sum: number, w: number) => sum + w, 0)
```

**Line 325:** Passes to redistribution
```typescript
// BEFORE:
current_effective_stakes: weightsData.effective_stakes

// AFTER:
current_belief_weights: weightsData.belief_weights
```

### 3. Stake Redistribution (SIGNATURE CHANGE)

**File:** `supabase/functions/protocol-beliefs-stake-redistribution/index.ts`

**Line 14:** Interface change
```typescript
// BEFORE:
interface StakeRedistributionRequest {
  current_effective_stakes: Record<string, number>  // ❌
}

// AFTER:
interface StakeRedistributionRequest {
  current_belief_weights: Record<string, number>  // ✅ Raw w_i values
}
```

**Lines 98-112:** Slashing pool calculation
```typescript
// BEFORE: Sum effective stakes of losers
for (const loserId of losers) {
  slashing_pool += current_effective_stakes[loserId]  // ❌
}

// AFTER: Use actual total_stake, weighted by w_i
// Loser's at-risk amount = (w_i / Σw_j) × S_total
for (const loserId of losers) {
  const { data: agent } = await supabaseClient
    .from('agents')
    .select('total_stake')
    .eq('id', loserId)
    .single();

  const S_loser = agent.total_stake;
  slashing_pool += S_loser;  // Full stake at risk
}
```

**WAIT - This is wrong. Let me reconsider...**

Actually, the issue is more subtle. With your framework:
- **w_i determines VOICE** (how much weight in aggregation)
- **S determines RISK** (how much stake can be redistributed)

So redistribution should:
1. Use **w_i for weighting** in aggregation/BTS scoring
2. Use **S (total_stake) for redistribution amounts**

The current code CONFLATES these two concepts by using `effective_stake` for both!

Let me revise:

### 3. Stake Redistribution (CORRECTED)

**Current logic (WRONG):**
```typescript
// Treats effective_stake as both voice AND risk
slashing_pool += current_effective_stakes[loserId]
```

**New logic (CORRECT):**
```typescript
// Use belief_weights (w_i) for proportional redistribution
// Use total_stake (S) for actual amounts

// Step 1: Calculate total slashing pool (sum of loser stakes)
for (const loserId of losers) {
  const { data: agent } = await supabaseClient
    .from('agents')
    .select('total_stake')
    .eq('id', loserId)
    .single();

  slashing_pool += agent.total_stake;  // Full stake at risk
}

// Step 2: Distribute proportionally by BTS information scores
// (This part stays the same)
```

**BUT WAIT** - this means losers lose their ENTIRE stake? That seems too harsh...

Let me re-read your framework more carefully. You said:

> **Global stake S**: one balance per user, can go up/down via BTS redistribution.
> **Per-belief weight w_i**: set to w_i = 2% × buy_amount_i

So `w_i` is just the VOICE weight, not the at-risk amount.

**Question:** How much stake is at risk per belief?

**Option A:** Full stake S (seems too harsh)
**Option B:** Proportional to w_i (current effective_stake approach)
**Option C:** Fixed percentage of S based on w_i / Σw_j

I think we need clarification on: **What amount of stake should be redistributed per belief?**

---

## Stake Redistribution Model ✅

### Formula:

```typescript
ΔS_i = score_i × w_i     // |score_i| ≤ 1
S_new = clamp(S_prev + Σ ΔS_i, 0)
```

Where:
- `w_i = 2% × buy_amount_i` (belief lock for that pool)
- `score_i` = BTS information score for that belief (range: [-1, 1])
- `S` = global stake (one pot per agent)

### Key Properties:

**Voice = Risk:**
- Max loss from one belief = `w_i` (when score = -1)
- Max gain from one belief = `w_i` (when score = +1)
- Larger trade → larger w_i → more voice AND more risk

**No Over-Penalty:**
- Each belief can only move stake by ≤ `|score_i × w_i| ≤ w_i`
- Multiple beliefs settle independently, contributions sum
- Stake clamped at 0 (no negative balances)

**Example:**

| Belief | w_i  | Worst Loss (score=-1) | Best Gain (score=+1) |
|--------|------|----------------------|---------------------|
| A      | $2   | -$2                  | +$2                 |
| B      | $1   | -$1                  | +$1                 |
| C      | $4   | -$4                  | +$4                 |

Agent has `S = $100` total stake.

If all three score -1 (worst case):
```
S_new = max(0, 100 - 2 - 1 - 4) = $93
```

If all three score +1 (best case):
```
S_new = 100 + 2 + 1 + 4 = $107
```

**Aggregate risk bound:**
```
|Σ ΔS_i| ≤ Σ |score_i| × w_i ≤ Σ w_i
```

This equals 2% of all USDC routed through buys during the epoch.

---

## Why This Works

### 1. Voice = Risk Alignment
- Big trade → big w_i → more influence in aggregation AND more skin in the game
- Can't game the system by making many tiny trades (each has tiny w_i)

### 2. Coverage Guard
- Already implemented in stake-system.md
- Reject buys if `S - Σ locks < 0` after skimming w_i
- Users can't over-bet with under-funded stake

### 3. No Double-Counting
- Each belief independently contributes ΔS_i
- No race conditions (order doesn't matter)
- Total change = Σ ΔS_i, clamped at 0

### 4. Simple Accounting
- One w_i per belief (stored in user_pool_balances.belief_lock)
- One S per agent (agents.total_stake)
- No per-belief escrow, no sub-accounts

### 5. Zero-Sum Conservation

**Per-belief zero-sum:**
```
Σ_all_agents (score_i × w_i) ≈ 0  // BTS is designed to be zero-sum
```

- Winners' scores are positive, losers' scores are negative
- BTS scoring ensures Σ information_scores ≈ 0
- Therefore Σ_all_agents ΔS_i ≈ 0 globally (across all agents in that belief)

**Slashing pool from losers ≈ Rewards to winners** (per belief)

---

## Implementation Pseudo-Code

```typescript
// Runs once per epoch, per belief
async function settleBeliefEpoch(beliefId: string) {
  const participants = await getBeliefParticipants(beliefId);

  for (const agent of participants) {
    // 1. Get w_i from user_pool_balances.belief_lock
    //    w_i = 2% of last trade amount on that belief
    const w_i = await getBeliefWeight(agent.id, beliefId);

    // 2. Get BTS information score (already calculated)
    const score_i = btsScoringResults[agent.id];  // Range: [-1, 1]

    // 3. Calculate delta: ΔS_i = score_i × w_i
    //    This is the stake at risk for this belief
    const delta = score_i * w_i;

    // 4. Update global stake (with clamp at zero)
    const currentStake = await getAgentStake(agent.id);
    const newStake = Math.max(0, currentStake + delta);

    await updateAgentStake(agent.id, newStake);
  }
}
```

---

**Status:** Model clarified, ready for implementation
