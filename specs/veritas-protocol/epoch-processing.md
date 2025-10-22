# Belief-Specific Processing Data Flow Chain

**Status:** ✅ UPDATED (2025-01-22) - Refactored to use belief_weights model

This document defines the per-belief processing chain. Each belief is processed independently on-demand, not in global epoch batches.

## Architecture: On-Demand Per-Belief Processing

**Key Principle:** No global epochs. Each belief and pool maintains its own epoch counter that advances when processed/settled.

## Chain Sequence

```
Epistemic Weights → Belief Decomposition/Aggregation → BTS Scoring → Stake Redistribution
```

## Data Flow Verification

### 1. Epistemic Weights Calculation

**Edge Function:** `protocol-weights-calculate`

**Inputs:**
- `belief_id` (from request)
- `participant_agents` (array of agent IDs from request)

**Data Loaded from Database:**
- `pool_address` from `pool_deployments` WHERE `belief_id`
- For each agent:
  - `user_id` from `users` WHERE `agent_id`
  - `belief_lock`, `token_balance` from `user_pool_balances` WHERE `user_id` AND `pool_address`

**Outputs:**
- `weights`: object {agent_id: weight_i} - Normalized weights (sum = 1.0)
- `belief_weights`: object {agent_id: w_i} - Raw belief weights (2% of last trade)

**Algorithm:**
```
For each agent_id in participant_agents:
  1. Get user_id from agent_id
  2. Query user_pool_balances for belief_lock
  3. If no balance record OR token_balance = 0:
       w_i = 0  (position closed)
     Else:
       w_i = belief_lock  (already set to 2% of last_buy_amount)
  4. Apply minimum: w_i = max(w_i, EPSILON_STAKES)

If sum(w_i) > EPSILON_STAKES:
  weight_i = w_i / sum(w_j)  (normalize to sum = 1.0)
Else:
  weight_i = 1.0 / n  (equal weights fallback)
  w_i = EPSILON_STAKES for all
```

**Key Properties:**
- ✅ **Fixed weights**: w_i is set at trade time, never changes
- ✅ **No race conditions**: Multiple beliefs can process simultaneously
- ✅ **Voice = Risk**: Same w_i used for aggregation weight and stake risk
- ✅ **Closed positions**: token_balance = 0 → w_i = 0 (no voice, no risk)

---

### 2. Belief Decomposition/Aggregation

**Edge Function:** `protocol-beliefs-decompose` (preferred) or `protocol-beliefs-aggregate` (fallback)

**Inputs:**
- `belief_id` (from request)
- `weights` ← from Epistemic Weights (normalized, sum = 1.0)

**Data Loaded from Database:**
- Agent beliefs `{p_i}` from `belief_submissions` (latest per agent)
- Agent meta-predictions `{m_i}` from `belief_submissions` (latest per agent)

**Outputs:**
- `aggregate` - Weighted average belief (absolute BD relevance score [0,1])
- `certainty` - Certainty metric (1 - normalized entropy)
- `jensen_shannon_disagreement_entropy` - Disagreement measure
- `leave_one_out_aggregates` - Belief aggregates excluding each agent (for BTS)
- `leave_one_out_meta_aggregates` - Meta aggregates excluding each agent (for BTS)
- `decomposition_quality` - Quality metric (decompose only)
- `common_prior` - Shared baseline belief (decompose only)

**Algorithm:**
```
aggregate = Σ(weight_i × p_i)

For each agent i (leave-one-out):
  remaining_weights = normalize(weights[-i])  # Renormalize without agent i
  loo_aggregate_i = Σ(remaining_weights[j] × p_j) for j ≠ i
  loo_meta_i = Σ(remaining_weights[j] × m_j) for j ≠ i
```

**Key Properties:**
- ✅ **Absolute relevance**: `aggregate` is the final BD score [0,1]
- ✅ **No deltas**: Not a change or relative score, it's absolute
- ✅ **Direct to settlement**: This aggregate goes directly to pool settlement

---

### 3. BTS Scoring

**Edge Function:** `protocol-beliefs-bts-scoring`

**Inputs:**
- `belief_id` (from request)
- `normalized_weights` ← from Epistemic Weights
- `agent_beliefs` {p_i} - Agent beliefs
- `agent_meta_predictions` {m_i} - Agent meta-predictions
- `leave_one_out_aggregates` ← from Aggregation
- `leave_one_out_meta_aggregates` ← from Aggregation

**Outputs:**
- `information_scores`: object {agent_id: score_i} - BTS scores [-1, 1]
- `winners`: array of agent_ids where score > 0
- `losers`: array of agent_ids where score < 0

**Algorithm:**
```
For each agent i:
  # Bayesian Truth Serum formula
  s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)

  # Information score (BTS uses normalized weights for zero-sum)
  information_score_i = s_i × weight_i
```

**Key Properties:**
- ✅ **Zero-sum**: Σ(score_i × weight_i) ≈ 0 across all agents
- ✅ **Range**: scores ∈ [-1, 1] per agent
- ✅ **Uses normalized weights**: Not raw w_i, but weight_i (sum = 1.0)

---

### 4. Stake Redistribution

**Edge Function:** `protocol-beliefs-stake-redistribution`

**Inputs:**
- `belief_id` (from request)
- `information_scores` {score_i} ← from BTS Scoring (range [-1, 1])
- `belief_weights` {w_i} ← from Epistemic Weights (raw, 2% of last trade)

**Data Loaded from Database:**
- Current total stakes from `agents` table

**Outputs:**
- `redistribution_occurred`: boolean
- `updated_total_stakes`: object {agent_id: new_stake}
- `individual_rewards`: object {agent_id: positive_delta}
- `individual_slashes`: object {agent_id: abs(negative_delta)}
- `slashing_pool`: number (for backward compatibility = sum of slashes)

**Algorithm:**
```
For each agent i:
  current_stake = agents[i].total_stake
  score = information_scores[i]  # Range: [-1, 1]
  w_i = belief_weights[i]        # 2% of last trade

  # Calculate stake change
  ΔS_i = score × w_i

  # Update stake (clamped at zero)
  new_stake = max(0, current_stake + ΔS_i)

  # Track for reporting
  if ΔS_i > 0:
    rewards[i] = ΔS_i
  else if ΔS_i < 0:
    slashes[i] = abs(ΔS_i)

# Zero-sum validation (should be ≈ 0)
total_delta = Σ(ΔS_i)
if abs(total_delta) > 0.01:
  log_warning("Zero-sum violation detected")
```

**Key Properties:**
- ✅ **Direct formula**: ΔS = score × w_i (simple, deterministic)
- ✅ **Zero-sum**: Emerges from BTS zero-sum property
- ✅ **Voice = Risk**: Same w_i determines both aggregation weight and max stake at risk
- ✅ **Bounded risk**: Maximum loss per belief = w_i (when score = -1)
- ✅ **No race conditions**: Each belief processes independently with fixed w_i

---

## Database Updates Per Belief Processing

When `protocol-belief-epoch-process` is called:

### 1. Update Belief State
```sql
UPDATE beliefs SET
  previous_aggregate = <final_aggregate>,  -- Absolute BD score [0,1]
  certainty = <calculated_certainty>
WHERE id = <belief_id>;
```

### 2. Record History
```sql
INSERT INTO belief_relevance_history (
  belief_id,
  epoch,                    -- Belief's local processing iteration (not global)
  aggregate,                -- Absolute BD relevance score
  certainty,
  disagreement_entropy,
  participant_count,
  total_stake,             -- Sum of all w_i values (total belief weight)
  recorded_at
) VALUES (
  <belief_id>,
  <get_current_processing_count>,  -- Increments each time belief is processed
  <final_aggregate>,
  <calculated_certainty>,
  <jensen_shannon_disagreement_entropy>,
  <participant_count>,
  <sum(belief_weights)>,           -- Total weight, not total stake
  NOW()
);
```

### 3. Update Agent Stakes
```sql
-- For each participating agent
UPDATE agents SET
  total_stake = <new_stake>  -- old_stake + ΔS
WHERE id = <agent_id>;
```

---

## Pool Settlement (Per-Pool, On-Demand)

After a belief is processed, its associated pool can be settled.

### Trigger Methods

**1. User-Triggered Rebase (API):**
```typescript
POST /api/posts/[postId]/rebase
{ walletAddress: "..." }

// Internally:
// 1. Call protocol-belief-epoch-process(belief_id)
// 2. Build settle_epoch transaction with new BD score
// 3. Protocol authority partially signs
// 4. Return transaction for user to sign
```

**2. Direct Settlement (Edge Function):**
```typescript
POST /functions/v1/pool-settle-single
{ pool_address: "...", belief_id: "..." }

// Uses existing belief.previous_aggregate (must be already processed)
```

### Settlement Flow

1. **Get BD Score**: Fetch `beliefs.previous_aggregate` (absolute relevance [0,1])
2. **Check Cooldown**: Verify `now - last_settle_ts >= min_settle_interval`
3. **Check New Activity**: Verify sufficient new belief submissions since last settlement
4. **Convert Score**: BD score to Q32.32 format: `bdScore_q32 = floor(bdScore × (1 << 32))`
5. **Execute On-Chain**:
   ```rust
   // Smart contract calculates:
   q = R_long / (R_long + R_short)     // Market prediction
   f_long = bdScore / q                 // LONG settlement factor
   f_short = (1 - bdScore) / (1 - q)    // SHORT settlement factor

   R_long' = R_long × f_long            // Scale LONG reserves
   R_short' = R_short × f_short         // Scale SHORT reserves

   pool.current_epoch += 1              // Increment pool's local epoch
   ```
6. **Emit Event**: `SettlementExecuted(pool, epoch, bdScore, reserves_before, reserves_after)`
7. **Event Indexing**:
   ```sql
   INSERT INTO settlements (..., epoch) VALUES (..., pool.current_epoch);
   UPDATE pool_deployments SET current_epoch = pool.current_epoch WHERE ...;
   ```

### Settlement Constraints

**Time-based (Cooldown):**
- Each pool has `min_settle_interval` (default: 300s)
- Smart contract enforces: `now - last_settle_ts >= min_settle_interval`
- Returns error if cooldown not elapsed

**Activity-based (New Submissions):**
- Configurable via `system_config.min_new_submissions_for_rebase` (default: 2)
- Server checks: unique new belief submissions since last settlement
- Returns error if insufficient new activity

---

## Key Architecture Principles

- ✅ **No Global Epochs**: Each pool has independent `current_epoch` counter
- ✅ **On-Demand Processing**: Users/systems trigger belief processing when needed
- ✅ **Independent Settlement**: Pools settle at different times, no coordination required
- ✅ **Fixed Belief Weights**: w_i set at trade time, eliminates race conditions
- ✅ **Voice = Risk Alignment**: Same w_i for aggregation weight and stake risk
- ✅ **Cooldown Protection**: Smart contract enforces minimum settle interval
- ✅ **Activity Protection**: Server enforces minimum new submissions threshold
- ✅ **Event-Driven Sync**: Event indexer keeps database synchronized with on-chain state

---

## Edge Functions

### Core Protocol Chain
- **`protocol-weights-calculate`** - Calculate epistemic weights from belief_lock
- **`protocol-beliefs-decompose`** - BD decomposition (preferred)
- **`protocol-beliefs-aggregate`** - Naive aggregation (fallback)
- **`protocol-beliefs-bts-scoring`** - BTS scoring with zero-sum property
- **`protocol-beliefs-stake-redistribution`** - Stake updates using ΔS = score × w_i

### Orchestration
- **`protocol-belief-epoch-process`** - Orchestrates full chain for single belief

### Settlement
- **`pool-settle-single`** - Settles single pool with BD score
- **`pool-settlement`** - Batch settlement (legacy, filters by epoch)

### APIs
- **`POST /api/posts/[id]/rebase`** - User-triggered rebase (epoch process + settlement)
- **`POST /api/pools/settle`** - Direct settlement (requires existing BD score)

---

**Last Updated:** 2025-01-22
**Status:** ✅ Aligned with implementation (belief_weights model)
