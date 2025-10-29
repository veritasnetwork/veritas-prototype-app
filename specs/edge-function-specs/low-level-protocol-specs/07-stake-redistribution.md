# Stake Redistribution Implementation

**Status:** ✅ UPDATED (2025-01-28) - P90-scaled, certainty-weighted, single-weight redistribution

**Endpoint:** `/protocol/beliefs/stake-redistribution`

## Overview

Redistributes stake each epoch within a pool so that noisier losers pay more (but never more than their lock), and winners receive exactly what losers pay. Uses adaptive P90 scaling to normalize BTS scores, applies certainty as a dampening factor, and ensures exact zero-sum through integer micro-unit accounting.

## Interface

**Input:**
- `belief_id`: string (required) - The belief market being processed
- `bts_scores`: object {agent_id: number} (required) - Raw BTS scores (unbounded)
- `gross_locks`: object {agent_id: number} (required) - Gross belief locks in micro-USDC (LONG + SHORT)
- `certainty`: number (required, range: [0, 1]) - Pool confidence level
- `current_epoch`: number (required) - Current epoch number

**Output:**
- `redistribution_occurred`: boolean - Whether redistribution happened
- `individual_rewards`: object {agent_id: number} - Rewards in USDC (display units)
- `individual_slashes`: object {agent_id: number} - Slashes in USDC (display units, absolute values)
- `slashing_pool`: number - Total collected from losers in USDC
- `scale_k`: number - Computed P90 scale factor (for debugging)
- `lambda`: number - (deprecated, kept for compatibility)
- `total_delta_micro`: number - Zero-sum check result (should be 0)

## Key Definitions

### Per Pool, Per Epoch

- **agents**: Participants with non-zero `gross_locks[agent_id] > 0`
- **Weight `w_i` (gross lock)**: Sum of user's locks across both sides for this pool
  ```
  w_i = lock_i(LONG) + lock_i(SHORT)  [in micro-USDC]
  ```
- **Raw BTS score `s_i ∈ ℝ`**: Unweighted information score from BTS scoring (unbounded)
- **Scale `k > 0`**: Adaptive dispersion scale computed from P90 of `{|s_i|}`
- **Clamped score `ŝ_i`**: Normalized score in range [-1, 1]
  ```
  ŝ_i = clamp(s_i / k, -1, 1)
  ```
- **Certainty `c ∈ [0, 1]`**: Confidence level for this pool/epoch (from BD aggregate)
- **Noise magnitude (losers)**:
  ```
  n_i = (-ŝ_i)+ · w_i  [in micro-USDC]
  where (x)+ = max(x, 0)
  ```
- **Signal magnitude (winners)**:
  ```
  p_i = (ŝ_i)+ · w_i  [in micro-USDC]
  ```

## Algorithm

### Step 0: Filter Participants

```javascript
agents = {agent_id : gross_locks[agent_id] > 0}
if agents.length == 0:
  return {redistribution_occurred: false, ...}
```

### Step 1: Adaptive Scale (P90)

Compute scale factor `k` from current epoch's raw scores:

```javascript
// Gather absolute values
a = [|bts_scores[agent_id]| for agent_id in agents]

// Compute P90 by nearest-rank quantile
N = a.length
r = Math.ceil(0.90 * N)  // 90th percentile index
a_sorted = sort(a, ascending)  // deterministic stable sort
k_raw = a_sorted[r - 1]  // 0-indexed

// Apply floor
k_floor = 0.1
k = Math.max(k_raw, k_floor)
```

**Properties:**
- No history/smoothing - computed fresh each epoch
- Deterministic - stable sort with tie-breaking by agent_id
- Prevents extreme outliers from dominating
- Most agents' `ŝ_i` will fall inside (-1, 1)

### Step 2: Clamp Scores

For each agent:

```javascript
ŝ_i = clamp(bts_scores[agent_id] / k, -1, 1)

function clamp(x, min, max):
  return Math.min(Math.max(x, min), max)
```

### Step 3: Compute Noise and Signal Magnitudes

For each agent, compute in micro-USDC:

```javascript
// Losers' noise magnitude
n_i_micro = Math.max(0, -ŝ_i) * gross_locks[agent_id]

// Winners' signal magnitude
p_i_micro = Math.max(0, ŝ_i) * gross_locks[agent_id]
```

**Note:** Weight is applied exactly **once** here. No double-weighting.

### Step 4: Loser Slashes (Per-User Deltas)

For each agent:

```javascript
// Compute slash in USDC first
n_i_usdc = n_i_micro / 1_000_000
slash_i_usdc = certainty * n_i_usdc

// Convert to integer micro-USDC (rounding done here, once)
slash_i_micro = Math.floor(slash_i_usdc * 1_000_000)

// If ŝ_i >= 0, slash_i_micro = 0
```

**Pool collected from losers:**
```javascript
PoolSlash = Σ slash_i_micro  [integer micro-USDC]
```

**Bounds:**
- `0 ≤ slash_i ≤ c · w_i ≤ w_i` (can't lose more than your lock)

### Step 5: Winner Rewards (Zero-Sum Split)

```javascript
// Total signal from winners
P = Σ p_i_micro  [for agents with ŝ_i > 0]

if P == 0:
  // No winners - skip redistribution
  // Set all slashes to 0 to maintain zero-sum
  return {redistribution_occurred: false, ...}

// First pass: proportional allocation with floor
for each winner i:
  reward_i_base_micro = Math.floor((PoolSlash * p_i_micro) / P)

// Compute remainder to distribute
remainder = PoolSlash - Σ reward_i_base_micro

// Largest-remainders method for exact zero-sum
residuals = []
for each winner i:
  r_i = (PoolSlash * p_i_micro) % P
  residuals.push({agent_id: i, residual: r_i})

// Sort by residual (descending), tie-break by agent_id (deterministic)
sort(residuals, (a, b) => {
  if (b.residual != a.residual) return b.residual - a.residual
  return a.agent_id.localeCompare(b.agent_id)
})

// Distribute remainder one micro-unit at a time
for i = 0 to remainder - 1:
  reward_i_base_micro[residuals[i].agent_id] += 1

// Final rewards
reward_i_micro = reward_i_base_micro
```

**Zero-sum check (must be exact):**
```javascript
assert(Σ reward_i_micro == PoolSlash)  // exact integer equality
```

### Step 6: Stake Updates (Atomic, Integer)

For each agent:

```javascript
if (slash_i_micro > 0):
  Δ_i = -slash_i_micro
else if (reward_i_micro > 0):
  Δ_i = +reward_i_micro
else:
  Δ_i = 0

// Apply atomically in database
UPDATE agents
SET total_stake = GREATEST(0, total_stake + Δ_i)
WHERE id = agent_id

// Record event for audit trail
INSERT INTO stake_redistribution_events (
  belief_id,
  epoch,
  agent_id,
  information_score,  -- Store raw bts_scores[agent_id] (unbounded)
  belief_weight,      -- gross_locks[agent_id] in micro-USDC
  normalized_weight,  -- gross_locks[agent_id] / Σ gross_locks
  stake_before,
  stake_delta,        -- Δ_i
  stake_after,
  recorded_by
) VALUES (...)
```

**Solvency guarantee:**
- System elsewhere enforces: `total_stake ≥ Σ(all locks for agent)`
- Since `slash_i ≤ c · w_i ≤ w_i` and agent has at least `w_i` locked, `total_stake ≥ w_i`
- After applying `-slash_i`, agent remains solvent

### Step 7: Return Results

```javascript
return {
  redistribution_occurred: true,
  individual_rewards: {agent_id: reward_i_micro / 1_000_000},  // USDC
  individual_slashes: {agent_id: slash_i_micro / 1_000_000},   // USDC
  slashing_pool: PoolSlash / 1_000_000,  // USDC
  scale_k: k,
  lambda: 0,  // deprecated
  total_delta_micro: Σ Δ_i  // should be 0
}
```

## Step-by-Step Procedure (Concise)

1. **Filter participants:** `agents = {i : gross_locks[i] > 0}`
2. **Compute P90 scale:** `k = max(P90({|s_i|}), 0.1)`
3. **Clamp scores:** `ŝ_i = clamp(s_i / k, -1, 1)`
4. **Compute magnitudes:** `n_i = (-ŝ_i)+ · w_i`, `p_i = (ŝ_i)+ · w_i` (in micro-USDC)
5. **Loser slashes:** `slash_i = floor(c · n_i)`, `PoolSlash = Σ slash_i`
6. **Winner split:** If `P = Σ p_i == 0`, skip. Else distribute `PoolSlash` via floor + largest-remainders
7. **Apply updates:** `Δ_i = reward_i - slash_i`, update `total_stake` atomically
8. **Assert zero-sum:** `Σ Δ_i == 0` (exact micro-unit equality)
9. **Emit events:** Record per-agent redistribution events

## Invariants & Bounds

### Must Hold

1. **Per-user cap:** `0 ≤ slash_i ≤ c · w_i ≤ w_i`
2. **Pool bound:** `0 ≤ PoolSlash ≤ c · Σ_{losers} w_i`
3. **Zero-sum:** `Σ_i Δ_i = 0` (exact, micro-units)
4. **No penalty without winners:** If `Σ p_i = 0` ⇒ `PoolSlash = 0` (skip redistribution)
5. **Solvency:** `total_stake_after ≥ 0` for all agents
6. **Single weighting:** Score weighted exactly once by `w_i` when forming `n_i / p_i`

### Computational Guarantees

- **Deterministic:** Stable sort with agent_id tie-breaking
- **Bounded deltas:** `|ŝ_i| ≤ 1` ⇒ `n_i ≤ w_i` and `p_i ≤ w_i`
- **No rounding drift:** Largest-remainders ensures exact zero-sum
- **Complexity:** O(N log N) for P90 sort, O(N) for all other steps

## Edge Cases

### No Participants
```javascript
if agents.length == 0:
  return {redistribution_occurred: false, ...}
```

### All Winners or All Losers
```javascript
if P == 0:  // No winners
  skip redistribution (set all slashes to 0)
  return {redistribution_occurred: false, ...}

if PoolSlash == 0:  // No losers
  skip redistribution (all rewards = 0)
  return {redistribution_occurred: false, ...}
```

### Closed Positions
- If `token_balance = 0` for both LONG and SHORT ⇒ `w_i = 0`
- Agent is excluded from redistribution (not in `agents` set)

### Zero Certainty
- If `c = 0` ⇒ all `slash_i = 0` ⇒ `PoolSlash = 0`
- No redistribution occurs (all deltas = 0)

### Tiny Scores
- `k_floor = 0.1` prevents division by near-zero
- If all `|s_i| < 0.1`, then `k = 0.1`, so `ŝ_i = s_i / 0.1` (scaled up)

### Idempotence
- Edge function should check if redistribution already occurred for `(belief_id, epoch)`
- Constraint: `UNIQUE(belief_id, epoch, agent_id)` on `stake_redistribution_events`

## Key Properties

### Single Weighting
- BTS scores are **unweighted** (raw information scores)
- Weight `w_i` applied **exactly once** when forming noise/signal magnitudes
- No double-counting of position size

### Bounded Risk Per Belief
- Maximum loss per belief: `c · w_i ≤ w_i` (your lock in this pool)
- Independent from `total_stake` (global across all beliefs)
- Multiple beliefs process independently

### Adaptive Scaling
- P90 prevents extreme outliers from dominating
- Most agents' scores fall inside [-1, 1] after clamping
- Relative BTS score magnitudes preserved within [-1, 1] range

### Certainty as Impact Dampener
- High certainty (c → 1): larger stake movements
- Low certainty (c → 0): smaller stake movements
- Applies uniformly to all losers' slashes

### Exact Zero-Sum
- Integer micro-unit accounting throughout
- Largest-remainders method distributes remainder exactly
- `Σ Δ_i = 0` (no rounding drift)

## Example

### Scenario: 3 agents, high certainty

**Inputs:**
- Agent A: `s_A = 2.5`, `w_A = 1,000,000 μUSDC` ($1.00)
- Agent B: `s_B = -1.8`, `w_B = 2,000,000 μUSDC` ($2.00)
- Agent C: `s_C = 0.3`, `w_C = 1,500,000 μUSDC` ($1.50)
- `c = 0.8` (high certainty)

**Step 1: Compute k (P90)**
```
a = [2.5, 1.8, 0.3]
a_sorted = [0.3, 1.8, 2.5]
N = 3, r = ceil(0.9 * 3) = 3
k_raw = a_sorted[2] = 2.5
k = max(2.5, 0.1) = 2.5
```

**Step 2: Clamp scores**
```
ŝ_A = clamp(2.5 / 2.5, -1, 1) = 1.0
ŝ_B = clamp(-1.8 / 2.5, -1, 1) = -0.72
ŝ_C = clamp(0.3 / 2.5, -1, 1) = 0.12
```

**Step 3: Magnitudes**
```
n_A = max(0, -1.0) * 1,000,000 = 0
n_B = max(0, 0.72) * 2,000,000 = 1,440,000 μUSDC
n_C = max(0, -0.12) * 1,500,000 = 0

p_A = max(0, 1.0) * 1,000,000 = 1,000,000 μUSDC
p_B = max(0, -0.72) * 2,000,000 = 0
p_C = max(0, 0.12) * 1,500,000 = 180,000 μUSDC
```

**Step 4: Loser slashes**
```
n_B_usdc = 1,440,000 / 1,000,000 = 1.44
slash_B_usdc = 0.8 * 1.44 = 1.152
slash_B_micro = floor(1.152 * 1,000,000) = 1,152,000 μUSDC

PoolSlash = 1,152,000 μUSDC
```

**Step 5: Winner rewards**
```
P = 1,000,000 + 180,000 = 1,180,000 μUSDC

reward_A_base = floor((1,152,000 * 1,000,000) / 1,180,000) = floor(976,271.186) = 976,271
reward_C_base = floor((1,152,000 * 180,000) / 1,180,000) = floor(175,728.814) = 175,728

Sum = 976,271 + 175,728 = 1,151,999
Remainder = 1,152,000 - 1,151,999 = 1 μUSDC

Residuals:
  r_A = (1,152,000 * 1,000,000) % 1,180,000 = 220,000
  r_C = (1,152,000 * 180,000) % 1,180,000 = 960,000

Sort by residual (desc): C (960,000), A (220,000)
Distribute 1 μUSDC to C

reward_A_micro = 976,271
reward_C_micro = 175,729

Verify: 976,271 + 175,729 = 1,152,000 ✅
```

**Step 6: Deltas**
```
Δ_A = +976,271 μUSDC = +$0.976271
Δ_B = -1,152,000 μUSDC = -$1.152
Δ_C = +175,729 μUSDC = +$0.175729

Zero-sum check: 976,271 - 1,152,000 + 175,729 = 0 ✅
```

## Changes from Previous Version

### OLD Model (DEPRECATED):
- Lambda-scaled redistribution with double-weighting
- `informationScore = normalized_weight × btsScore`
- `rawDelta = informationScore × grossLock = (w_i² / Σw_j) × btsScore`
- Unbounded BTS scores with no normalization
- Database constraints limited scores to [-1, 1] (incorrect)

**Problems:**
- Weight counted twice (in information score and again in delta)
- Unbounded deltas could exceed total_stake
- Breaking zero-sum when clamping occurred
- Unclear relationship between score magnitude and penalty

### NEW Model (CURRENT):
- P90 adaptive scaling with single weighting
- `rawDelta = certainty × (-ŝ_i)+ × w_i`
- Clamped scores to [-1, 1] via adaptive P90
- Exact zero-sum via largest-remainders
- Bounded risk: `slash_i ≤ c · w_i`

**Benefits:**
- **No double-weighting:** Weight applied exactly once
- **Bounded risk:** Can't lose more than your lock in this pool
- **Adaptive normalization:** P90 prevents outliers, preserves relative magnitudes
- **Certainty control:** Clear dial for impact dampening
- **Exact zero-sum:** Integer accounting with no drift
- **Solvency guaranteed:** Slashes respect lock constraints
- **Interpretable:** Clamped scores in [-1, 1] are intuitive

## Database Schema Changes

### stake_redistribution_events

**Remove constraints:**
- ~~`information_score CHECK (information_score >= -1 AND information_score <= 1)`~~ (BTS scores are unbounded)
- ~~`numeric(10,8)` precision~~ (needs to store large values)

**New schema:**
```sql
CREATE TABLE stake_redistribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id UUID NOT NULL,
  epoch INTEGER NOT NULL,
  agent_id UUID NOT NULL,
  information_score NUMERIC NOT NULL,  -- Raw BTS score (unbounded)
  belief_weight NUMERIC NOT NULL,      -- gross_locks in micro-USDC
  normalized_weight NUMERIC NOT NULL,  -- belief_weight / Σ belief_weights
  stake_before BIGINT NOT NULL,
  stake_delta BIGINT NOT NULL,
  stake_after BIGINT NOT NULL,
  recorded_by TEXT NOT NULL DEFAULT 'server',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stake_redistribution_events_pkey PRIMARY KEY (id),
  CONSTRAINT stake_redistribution_events_unique_per_epoch UNIQUE (belief_id, epoch, agent_id),
  CONSTRAINT stake_redistribution_events_belief_weight_check CHECK (belief_weight >= 0),
  CONSTRAINT stake_redistribution_events_normalized_weight_check CHECK (normalized_weight >= 0 AND normalized_weight <= 1),
  CONSTRAINT stake_redistribution_events_stake_before_check CHECK (stake_before >= 0),
  CONSTRAINT stake_redistribution_events_stake_after_check CHECK (stake_after >= 0),
  CONSTRAINT stake_redistribution_events_recorded_by_check CHECK (recorded_by IN ('server', 'indexer'))
);
```

**Note:** `information_score` is now unbounded `NUMERIC` to store raw BTS scores.
