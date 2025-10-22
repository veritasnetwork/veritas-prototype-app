# Belief-Specific Processing Data Flow Chain

This document defines the per-belief processing chain. Each belief is processed independently on-demand, not in global epoch batches.

## Architecture: On-Demand Per-Belief Processing

**Key Change:** No global epochs. Each belief and pool maintains its own epoch counter that advances when processed/settled.

## Chain Sequence

```
Epistemic Weights → Belief Decomposition/Aggregation → BTS Scoring → Stake Redistribution
```

## Data Flow Verification

### 1. Epistemic Weights Calculation

**Inputs:**
- `belief_id` (from request)
- Participant agent IDs (from request)
- Agent total stakes (from DB)
- Agent active belief counts (from DB)

**Outputs:**
- `{w_i}` - Normalized epistemic weights (sum = 1.0)
- `{S_effective,i}` - Effective stakes per agent

**Formula:**
```
S_effective,i = S_total,i / n_beliefs,i
w_i = S_effective,i / Σ(S_effective)
```

---

### 2. Belief Aggregation

**Inputs:**
- `belief_id` (from request)
- `{w_i}` ← from Epistemic Weights
- `{p_i}` - Agent beliefs (loaded from DB)
- `{m_i}` - Agent meta-predictions (loaded from DB)

**Outputs:**
- `aggregate` - Weighted average of beliefs
- `D_JS` - Jensen-Shannon disagreement entropy
- `certainty` - Certainty metric (1 - normalized entropy)
- `leave_one_out_aggregates` - Belief aggregates excluding each agent
- `leave_one_out_meta_aggregates` - Meta-prediction aggregates excluding each agent
- `{m_i}` - Agent meta-predictions (pass-through)

**Formula:**
```
aggregate = Σ(w_i × p_i)
```

---

### 3. BTS Scoring

**Inputs:**
- `belief_id` (from request)
- `{w_i}` ← from Epistemic Weights
- `agent_beliefs` - Agent beliefs (latest submission per agent)
- `leave_one_out_aggregates` ← from Aggregation
- `leave_one_out_meta_aggregates` ← from Aggregation
- `{m_i}` - Agent meta-predictions

**Outputs:**
- `{s_i}` - BTS signal quality scores
- `{g_i}` - Information scores (g_i = w_i × s_i)
- `winners` - Agents with g_i > 0
- `losers` - Agents with g_i < 0

**Formula:**
```
s_i = D_KL(p_i || m̄_{-i}) - D_KL(p_i || p̄_{-i}) - D_KL(p̄_{-i} || m_i)
g_i = w_i × s_i
```

---

### 4. Stake Redistribution

**Inputs:**
- `belief_id` (from request)
- `{S_effective,i}` ← from Epistemic Weights
- `{g_i}` ← from BTS Scoring
- `winners` ← from BTS Scoring
- `losers` ← from BTS Scoring

**Outputs:**
- `{S_i'}` - Updated total stakes after redistribution
- `{ΔR_i}` - Individual rewards for winners
- `{ΔS_j}` - Individual slashes for losers
- `redistribution_occurred` - Boolean

**Formula:**
```
Slashing pool = Σ(S_effective,j × |g_j|) for j ∈ losers
Reward_i = (g_i / Σ(g_k for k ∈ winners)) × slashing_pool
```

---

## Verification Results

✅ **Chain is Complete**: Every function has all required inputs from previous functions

✅ **Simplified Flow**: Removed Mirror Descent and Learning Assessment

✅ **Always Redistribute**: BTS scoring and redistribution run every epoch (no learning gate)

✅ **Epistemic Weights**: Weights calculated once, used by aggregation, BTS, and redistribution

✅ **Leave-One-Out**: Computed in aggregation, used by BTS scoring

✅ **Absolute Relevance**: `aggregate` represents absolute BD relevance score [0,1], not a delta or share

---

## Database Updates Per Belief Processing

When a belief is processed (on-demand):

```sql
-- Update current belief state
UPDATE beliefs SET
  previous_aggregate = <final_aggregate>,
  certainty = <calculated_certainty>
WHERE id = <belief_id>;

-- Record history for time-series charting (uses belief's local context)
INSERT INTO belief_relevance_history (
  belief_id,
  epoch,  -- This is the belief's processing iteration, not a global epoch
  aggregate,
  certainty,
  disagreement_entropy,
  participant_count,
  total_stake,
  recorded_at
) VALUES (
  <belief_id>,
  <belief_processing_count>,  -- Incremented each time this belief is processed
  <final_aggregate>,
  <calculated_certainty>,
  <jensen_shannon_disagreement_entropy>,
  <participant_count>,
  <sum_of_effective_stakes>,
  NOW()
);
```

For each agent:
```sql
UPDATE agents SET
  total_stake = <new_stake>
WHERE id = <agent_id>;
```

---

## Pool Settlement (Per-Pool, On-Demand)

After a belief is processed, its associated pool can be settled:

### Trigger Methods

1. **User-Triggered via API:**
   ```typescript
   POST /api/pools/settle
   { postId: "...", walletAddress: "..." }
   ```

2. **Programmatic via Edge Function:**
   ```typescript
   POST /functions/v1/pool-settle-single
   { pool_address: "...", belief_id: "..." }
   ```

### Settlement Flow

1. Fetch belief's BD score from `beliefs.previous_aggregate`
2. Check pool's `current_epoch` (independent per-pool counter)
3. Verify cooldown elapsed (`last_settle_ts + min_settle_interval`)
4. Convert BD score `x ∈ [0, 1]` to Q32.32 format
5. Execute on-chain `settle_epoch` instruction:
   - Calculate market prediction `q = R_long / (R_long + R_short)`
   - Compute settlement factors: `f_long = x/q`, `f_short = (1-x)/(1-q)`
   - Scale reserves: `R_long' = R_long × f_long`, `R_short' = R_short × f_short`
   - Increment `pool.current_epoch += 1`
   - Emit `SettlementEvent` with new epoch number
6. Event indexer records settlement:
   ```sql
   INSERT INTO settlements (..., epoch) VALUES (..., pool.current_epoch);
   UPDATE pool_deployments SET current_epoch = pool.current_epoch WHERE ...;
   ```

### Key Architecture Principles

- ✅ **No Global Epochs**: Each pool has independent `current_epoch` counter
- ✅ **On-Demand Processing**: Users/systems trigger belief processing when needed
- ✅ **Independent Settlement**: Pools settle at different times, no coordination required
- ✅ **Cooldown Protection**: Smart contract enforces `min_settle_interval` (default 300s)
- ✅ **Duplicate Prevention**: Database UNIQUE constraint on `(pool_address, epoch)`
- ✅ **Event-Driven Sync**: Event indexer keeps database synchronized with on-chain state

### Services

- **`protocol-belief-epoch-process`** - Processes single belief (BD decomposition, BTS, redistribution)
- **`pool-settle-single`** - Settles single pool based on its belief's BD score
- **`pool-settlement`** - Batch settlement (legacy, filters by epoch to avoid duplicates)
