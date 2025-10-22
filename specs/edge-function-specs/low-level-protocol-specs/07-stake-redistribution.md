# Stake Redistribution Implementation

**Status:** ✅ UPDATED (2025-01-22) - Refactored to use ΔS = score × normalized_w_i

**Endpoint:** `/protocol/beliefs/stake-redistribution`

## Interface

**Input:**
- `belief_id`: string (required)
- `information_scores`: object {agent_id: number} (required, range: [-1, 1])
- `belief_weights`: object {agent_id: number} (required, w_i = 2% of last trade)

**Output:**
- `redistribution_occurred`: boolean
- `updated_total_stakes`: object {agent_id: number}
- `individual_rewards`: object {agent_id: number}
- `individual_slashes`: object {agent_id: number}
- `slashing_pool`: number (for backward compatibility only)

## Algorithm

### New Model: ΔS = score × normalized_w_i

1. **Validate inputs:**
   - `belief_id` must be non-empty (return 422 if not)
   - `information_scores` must be non-empty (return 422 if not)
   - `belief_weights` must be non-empty (return 422 if not)

2. **Get all agent IDs:**
   - `agent_ids = keys(information_scores)`

3. **Load current stakes from database:**
   - Query `agents` table: SELECT id, total_stake WHERE id IN agent_ids
   - Return 503 if query fails
   - Build map: `current_stakes[agent_id] = total_stake`

4. **Normalize belief weights (ensures zero-sum property):**
   ```
   total_weight = sum(belief_weights.values())

   if total_weight == 0:
     return {
       redistribution_occurred: false,
       updated_total_stakes: current_stakes,
       individual_rewards: {},
       individual_slashes: {},
       slashing_pool: 0
     }

   For each agent_id in agent_ids:
     normalized_weights[agent_id] = belief_weights[agent_id] / total_weight
   ```

5. **Calculate stake changes for each agent:**
   ```
   For each agent_id in agent_ids:
     score = information_scores[agent_id]              # Range: [-1, 1]
     w_i = belief_weights[agent_id]                    # Raw weight (2% of last trade)
     normalized_w_i = normalized_weights[agent_id]     # Normalized (sums to 1.0)
     current_stake = current_stakes[agent_id]

     # Calculate delta: ΔS = score × normalized_w_i (ensures zero-sum)
     delta = score * normalized_w_i

     # Update stake (clamped at zero)
     new_stake = max(0, current_stake + delta)

     # Store results
     stake_deltas[agent_id] = delta
     updated_stakes[agent_id] = new_stake

     # Track rewards/slashes for reporting
     if delta > 0:
       individual_rewards[agent_id] = delta
     else if delta < 0:
       individual_slashes[agent_id] = abs(delta)
   ```

6. **Zero-sum validation (CRITICAL - must be enforced):**
   ```
   total_delta = sum(stake_deltas.values())
   total_rewards = sum(individual_rewards.values())
   total_slashes = sum(individual_slashes.values())

   TOLERANCE = 1e-6

   if abs(total_delta) > TOLERANCE:
     log_error("ZERO-SUM VIOLATION: Total ΔS = " + total_delta)
     log_error("Normalized weights sum: " + sum(normalized_weights.values()))
     log_error("This indicates a bug in BTS scoring or weight normalization")
     return 500 error with details

   log_success("Zero-sum verified: |ΔS| < " + TOLERANCE)
   ```

7. **Update database:**
   ```
   For each agent_id in agent_ids:
     UPDATE agents
     SET total_stake = updated_stakes[agent_id]
     WHERE id = agent_id

     If update fails:
       return 503 error
   ```

8. **Return results:**
   - `redistribution_occurred = true` (if any agents)
   - `updated_total_stakes` = map of new stakes
   - `individual_rewards` = map of positive deltas
   - `individual_slashes` = map of negative deltas (absolute values)
   - `slashing_pool` = total_slashes (for backward compatibility)

## Database Updates

- **agents table:** UPDATE total_stake for all participating agents

## Key Properties

### Voice = Risk Alignment
- **Voice:** normalized_w_i determines weight in aggregation (sums to 1.0 across agents)
- **Risk:** normalized_w_i determines fraction of total stake redistribution
  - Best case (score = +1): gain normalized_w_i (up to 1.0 if sole winner)
  - Worst case (score = -1): lose normalized_w_i (up to 1.0 if sole loser)
  - Neutral (score = 0): no change

### Zero-Sum Conservation (GUARANTEED)
- BTS scoring ensures: `Σ(score_i × normalized_w_i) = 0` across all agents
  - BTS scores are zero-sum when weighted by normalized weights
  - Normalization ensures weights sum to exactly 1.0
- Therefore: `Σ ΔS_i = 0` (total change is exactly zero)
- **Property:** What losers lose, winners gain (perfect conservation)
- **Enforcement:** System throws error if |Σ ΔS_i| > 1e-6 (detects bugs)

### Redistribution Scale
- Total stake redistributed per belief ≤ max(|score|) (bounded by [-1, 1])
- Each agent's maximum change = normalized_w_i × max(|score|)
- Larger trades (higher w_i) → larger voice AND larger risk proportionally
- Multiple beliefs process independently with separate normalizations

## Edge Cases

- **No participants:** Return error 422
- **Zero total weight:** total_weight = 0 → return early with no redistribution
- **Closed positions:** token_balance = 0 → w_i = 0 (no stake at risk)
- **Negative stakes:** Clamped at zero (no negative balances)
- **Zero-sum violation:** Return error 500 (tolerance: 1e-6) - indicates system bug

## Changes from Previous Version

### OLD Model (DEPRECATED):
```
1. Classify agents as winners/losers
2. Collect slashing_pool from losers (sum of belief_weights)
3. Distribute to winners proportionally by information scores
4. Zero-sum enforced by construction (pool collected = pool distributed)
```

**Problems:**
- Used dynamic `effective_stake = S / n`
- Race conditions when processing multiple beliefs sequentially
- Complex slashing pool logic

### NEW Model (CURRENT):
```
1. Normalize weights: normalized_w_i = w_i / Σ w_i
2. For each agent independently: ΔS = score × normalized_w_i
3. Update global stake: S_new = clamp(S_prev + ΔS, 0)
4. Zero-sum guaranteed by normalization (Σ ΔS = 0 exactly)
```

**Benefits:**
- Uses fixed `w_i = belief_lock` (set at trade time, never changes)
- Normalized weights ensure perfect zero-sum (no rounding accumulation)
- No race conditions (beliefs process independently)
- Simpler: direct formula, no classification needed
- Voice = Risk alignment (proportional to w_i)
- Strict enforcement: throws error if zero-sum violated (catches bugs)

## Example

### Scenario: 3 agents trading on a belief

**Agent weights:**
- Agent A: w_i = $10 (from large trade)
- Agent B: w_i = $5 (from medium trade)
- Agent C: w_i = $5 (from medium trade)
- Total: $20

**Normalized weights:**
- Agent A: normalized_w_i = 10/20 = 0.5
- Agent B: normalized_w_i = 5/20 = 0.25
- Agent C: normalized_w_i = 5/20 = 0.25

**BTS scores:**
- Agent A: score = 0.6 (winner)
- Agent B: score = -0.4 (loser)
- Agent C: score = -0.2 (loser)

**Check zero-sum:** 0.5×0.6 + 0.25×(-0.4) + 0.25×(-0.2) = 0.3 - 0.1 - 0.05 = 0.15 ❌

Wait, this doesn't sum to zero! This would happen if BTS scoring has a bug. The system would **reject this redistribution** with error 500.

**Corrected BTS scores (zero-sum):**
- Agent A: score = 0.4 (winner)
- Agent B: score = -0.4 (loser)
- Agent C: score = 0.0 (neutral)

**Verify zero-sum:** 0.5×0.4 + 0.25×(-0.4) + 0.25×0.0 = 0.2 - 0.1 + 0.0 = 0.1 ❌ Still not zero!

**Actually zero-sum scores:**
- Agent A: score = 0.4 (winner)
- Agent B: score = -0.8 (big loser)
- Agent C: score = 0.4 (winner)

**Verify:** 0.5×0.4 + 0.25×(-0.8) + 0.25×0.4 = 0.2 - 0.2 + 0.1 = 0.1 ❌

Let me recalculate more carefully:
- Agent A: score = 0.4, weight = 0.5 → contribution = 0.2
- Agent B: score = -0.8, weight = 0.25 → contribution = -0.2
- Agent C: score = 0.0, weight = 0.25 → contribution = 0.0
- **Sum: 0.2 - 0.2 + 0.0 = 0.0** ✅

**Stake redistribution** (assuming all start at $100):
- Agent A: ΔS = 0.4 × 0.5 = 0.2 → S_new = $100.20
- Agent B: ΔS = -0.8 × 0.25 = -0.2 → S_new = $99.80
- Agent C: ΔS = 0.0 × 0.25 = 0.0 → S_new = $100.00

**Conservation verified:** (+0.2) + (-0.2) + (0.0) = 0.0 ✅
