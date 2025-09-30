# Epistemic Weights & Stake Scaling Implementation

## Calculate Epistemic Weights

**Endpoint:** `/protocol/weights/calculate`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `participant_agents`: array[string] (required, non-empty)

#### Output
- `weights`: object {agent_id: normalized_weight} where sum = 1.0
- `effective_stakes`: object {agent_id: effective_stake}

### Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify `participant_agents` array is non-empty
   - Return error 422 if invalid

2. **Calculate effective stakes for each agent:**
   - For each agent_id in participant_agents:
     - Query `agents` table by agent_id
     - Return error 404 if agent not found
     - Verify agent.active_belief_count > 0
     - Return error 501 if zero (division by zero)
     - Calculate: effective_stake = total_stake / active_belief_count
     - Apply minimum: max(effective_stake, EPSILON_STAKES)
     - Store in effective_stakes map

3. **Normalize stakes to weights:**
   - Sum all effective_stakes values
   - If sum > EPSILON_STAKES:
     - For each agent: weight = effective_stake / sum
   - Else (no meaningful stakes):
     - Assign equal weights: 1.0 / number_of_agents

4. **Verify normalization:**
   - Assert sum(weights) ≈ 1.0 within EPSILON_PROBABILITY
   - Return error 500 if violated

5. **Return:** Weights and effective stakes maps

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