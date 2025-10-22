# Epistemic Weights & Belief Weight Calculation

**Status:** ✅ UPDATED (2025-01-22) - Refactored to use belief_lock

## Calculate Epistemic Weights

**Endpoint:** `/protocol/weights/calculate`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `participant_agents`: array[string] (required, non-empty)

#### Output
- `weights`: object {agent_id: normalized_weight} where sum = 1.0
- `belief_weights`: object {agent_id: w_i} where w_i = 2% of last trade

### Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify `participant_agents` array is non-empty
   - Return error 422 if invalid

2. **Get pool address for belief:**
   - Query `pool_deployments` table: `pool_address` WHERE `belief_id` = belief_id
   - Return error 404 if no pool found
   - Store pool_address

3. **Get belief weights (w_i) for each agent:**
   - For each agent_id in participant_agents:
     - Query `users` table to get user_id from agent_id
     - Return error 404 if user not found
     - Query `user_pool_balances` for this user_id + pool_address:
       - SELECT belief_lock, token_balance, last_buy_amount
       - WHERE user_id = user_id AND pool_address = pool_address
     - If no balance record OR token_balance = 0:
       - Set belief_weights[agent_id] = 0
       - Continue to next agent
     - Else:
       - w_i = belief_lock (already 2% of last_buy_amount)
       - Apply minimum: max(w_i, EPSILON_STAKES)
       - Store in belief_weights map

4. **Normalize weights for aggregation:**
   - Sum all belief_weights values
   - If sum > EPSILON_STAKES:
     - For each agent: weight = w_i / Σw_j
   - Else (all agents have zero weights):
     - Log warning: all agents have zero belief weights
     - Assign equal weights: 1.0 / number_of_agents
     - Set belief_weights[agent_id] = EPSILON_STAKES for all

5. **Verify normalization:**
   - Assert sum(weights) ≈ 1.0 within EPSILON_PROBABILITY
   - Return error 500 if violated

6. **Return:** Weights (normalized) and belief_weights (raw w_i values)

### Key Changes from Previous Version

**OLD:** Used `effective_stake = total_stake / active_belief_count` (dynamic calculation)
**NEW:** Uses `belief_weights = belief_lock` from `user_pool_balances` (fixed at trade time)

**Why:**
- Eliminates race conditions when processing multiple beliefs
- Voice = Risk: w_i determines both influence and stake at risk
- Simpler: No dynamic division, just read from database

## Update Agent Belief Count

**Endpoint:** `/protocol/stakes/update-belief-count`
**Complexity:** O(1)

### Interface

#### Input
- `agent_id`: string (required)
- `delta`: integer (+1 for new belief, -1 for expired belief)

#### Output
- `updated_count`: integer
- `success`: boolean

### Algorithm

1. **Validate inputs:**
   - Verify `agent_id` is non-empty
   - Verify `delta` is either +1 or -1
   - Return error 422 if invalid

2. **BEGIN TRANSACTION**

3. **Retrieve and update agent:**
   - Query `agents` table by agent_id
   - Return error 404 if not found
   - Update: active_belief_count += delta
   - Verify: active_belief_count >= 0
   - Return error 504 if negative

4. **COMMIT TRANSACTION**

5. **Return:** Updated count and success status

## Validate Minimum Stake Allocation

**Endpoint:** `/protocol/weights/validate-stake-allocation`  
**Complexity:** O(1)

### Interface

#### Input
- `agent_id`: string (required)
- `additional_beliefs`: integer (optional, default 0)

#### Output
- `valid`: boolean
- `current_effective_stake`: number
- `projected_effective_stake`: number
- `min_required`: number

### Algorithm

1. **Validate inputs:**
   - Verify `agent_id` is non-empty
   - Return error 422 if missing

2. **Retrieve agent data:**
   - Query `agents` table by agent_id
   - Return error 404 if not found

3. **Calculate current effective stake:**
   - If active_belief_count = 0: use total_stake
   - Else: current_effective_stake = total_stake / active_belief_count

4. **Calculate projected effective stake:**
   - projected_count = active_belief_count + additional_beliefs
   - If projected_count = 0: use total_stake
   - Else: projected_effective_stake = total_stake / projected_count

5. **Validate against minimum:**
   - valid = (projected_effective_stake >= MIN_STAKE_PER_BELIEF)

6. **Return:** Validation result with stake calculations

## Error Handling

### Input Validation
- Missing required fields → 422
- Agent not found → 404
- Division by zero → 501

### Constraint Violations
- Negative belief count → 504
- Normalization failure → 500

### Transaction Management
- Database failures → 503
- Rollback on any error

## Constants
See configuration spec for:
- MIN_STAKE_PER_BELIEF
- EPSILON_STAKES
- EPSILON_PROBABILITY