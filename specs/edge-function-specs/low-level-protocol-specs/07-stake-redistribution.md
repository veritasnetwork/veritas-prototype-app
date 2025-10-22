# Stake Redistribution Implementation

**Status:** ✅ UPDATED (2025-01-22) - Refactored to use ΔS = score × w_i

**Endpoint:** `/protocol/beliefs/stake-redistribution`

## Interface

**Input:**
- `belief_id`: string (required)
- `information_scores`: object {agent_id: number} (required, range: [-1, 1])
- `belief_weights`: object {agent_id: number} (required, w_i = 2% of last trade)
- ~~`winners`: array[string]~~ (DEPRECATED: Not used in new model)
- ~~`losers`: array[string]~~ (DEPRECATED: Not used in new model)
- ~~`current_effective_stakes`: object {agent_id: number}~~ (DEPRECATED: Use belief_weights)

**Output:**
- `redistribution_occurred`: boolean
- `updated_total_stakes`: object {agent_id: number}
- `individual_rewards`: object {agent_id: number}
- `individual_slashes`: object {agent_id: number}
- `slashing_pool`: number (for backward compatibility only)

## Algorithm

### New Model: ΔS = score × w_i

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

4. **Calculate stake changes for each agent:**
   ```
   For each agent_id in agent_ids:
     score = information_scores[agent_id]     # Range: [-1, 1]
     w_i = belief_weights[agent_id]           # 2% of last trade
     current_stake = current_stakes[agent_id]

     # Calculate delta: ΔS = score × w_i
     delta = score * w_i

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

5. **Zero-sum validation (CRITICAL):**
   ```
   total_delta = sum(stake_deltas.values())
   total_rewards = sum(individual_rewards.values())
   total_slashes = sum(individual_slashes.values())

   if abs(total_delta) > 0.01:
     log_error("ZERO-SUM VIOLATION: Total ΔS = " + total_delta)
     log_warning("This indicates a bug in BTS scoring or weight calculation")
     # Do NOT throw error - may be due to rounding
     # Proceed with redistribution but log for investigation
   ```

6. **Update database:**
   ```
   For each agent_id in agent_ids:
     UPDATE agents
     SET total_stake = updated_stakes[agent_id]
     WHERE id = agent_id

     If update fails:
       return 503 error
   ```

7. **Return results:**
   - `redistribution_occurred = true` (if any agents)
   - `updated_total_stakes` = map of new stakes
   - `individual_rewards` = map of positive deltas
   - `individual_slashes` = map of negative deltas (absolute values)
   - `slashing_pool` = total_slashes (for backward compatibility)

## Database Updates

- **agents table:** UPDATE total_stake for all participating agents

## Key Properties

### Voice = Risk
- **Voice:** w_i determines weight in aggregation (normalized to sum = 1.0)
- **Risk:** w_i determines maximum stake at risk
  - Best case (score = +1): gain w_i
  - Worst case (score = -1): lose w_i
  - Neutral (score = 0): no change

### Zero-Sum Conservation
- BTS scoring ensures: `Σ(score_i × w_i) ≈ 0` across all agents
- Therefore: `Σ ΔS_i ≈ 0` (total change ≈ 0)
- Slashing pool from losers ≈ Rewards to winners

### No Over-Penalty
- Each belief can only move stake by ≤ w_i (when |score| ≤ 1)
- Multiple beliefs process independently
- Total aggregate risk = Σ w_i (sum of all belief weights)

## Edge Cases

- **No participants:** Return error 422
- **Zero weights:** All w_i = 0 → no redistribution (deltas all zero)
- **Closed positions:** token_balance = 0 → w_i = 0 (no stake at risk)
- **Negative stakes:** Clamped at zero (no negative balances)
- **Zero-sum violation:** Log warning but proceed (may be rounding error)

## Changes from Previous Version

### OLD Model (DEPRECATED):
```
1. Classify agents as winners/losers
2. Collect slashing_pool from losers (sum of effective_stakes)
3. Distribute to winners proportionally by information scores
4. Zero-sum enforced by construction (pool collected = pool distributed)
```

**Problems:**
- Used dynamic `effective_stake = S / n`
- Race conditions when processing multiple beliefs sequentially
- Complex slashing pool logic

### NEW Model (CURRENT):
```
1. For each agent independently: ΔS = score × w_i
2. Update global stake: S_new = clamp(S_prev + ΔS, 0)
3. Zero-sum emerges from BTS scoring (Σ scores ≈ 0)
```

**Benefits:**
- Uses fixed `w_i = belief_lock` (set at trade time)
- No race conditions (beliefs process independently)
- Simpler: direct formula, no classification needed
- Voice = Risk alignment (same w_i for both)

## Example

Agent has:
- `total_stake = $100`
- `belief_lock = $2` (2% of $100 trade)
- `score = 0.5` (positive BTS score)

Calculation:
```
w_i = $2
ΔS = 0.5 × $2 = $1
S_new = $100 + $1 = $101
```

Result: Agent gains $1 stake.

If score was -0.5:
```
ΔS = -0.5 × $2 = -$1
S_new = max(0, $100 - $1) = $99
```

Result: Agent loses $1 stake.
