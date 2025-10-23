# Belief Aggregation Implementation

## Main Aggregation

**Endpoint:** `/protocol/beliefs/aggregate`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `weights`: object {agent_id: weight} where sum = 1.0

#### Output
- `aggregate`: number ∈ [0,1]
- `jensen_shannon_disagreement_entropy`: number ∈ [0,1]
- `normalized_disagreement_entropy`: number ∈ [0,1]
- `certainty`: number ∈ [0,1]
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]

### Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify `weights` is non-empty
   - Verify sum(weights) ≈ 1.0 within EPSILON_PROBABILITY
   - Return error 422/400 if invalid

2. **Load submissions:**
   - Query `belief_submissions` where:
     - `belief_id` = provided
     - `epoch` = current_epoch
   - Return error 404 if no submissions

3. **Calculate weighted aggregate:**
   - Initialize aggregate = 0.0
   - For each submission:
     - Verify agent_id has weight
     - Clamp belief to [EPSILON_PROBABILITY, 1-EPSILON_PROBABILITY]
     - Add weight × clamped_belief to aggregate
   - Clamp final aggregate to [EPSILON_PROBABILITY, 1-EPSILON_PROBABILITY]

4. **Calculate disagreement entropy:**
   - Define binary entropy H(p) = -p×log₂(p) - (1-p)×log₂(1-p)
   - Handle edge cases: H(p) = 0 when p ≈ 0 or p ≈ 1
   - Calculate H_avg = Σ(weight × H(belief)) for all agents
   - Calculate H_agg = H(aggregate)
   - Jensen-Shannon disagreement: D_JS = H_agg - H_avg
   - Ensure D_JS ≥ 0 (numerical stability)
   - Normalize: D_JS_norm = min(1.0, D_JS)
   - Certainty = 1.0 - D_JS_norm

5. **Collect metadata:**
   - Extract meta_predictions map from submissions
   - Filter active_agents where is_active = true

6. **Return:** Aggregation results and metadata

## Leave-One-Out Aggregation

**Endpoint:** `/protocol/beliefs/leave-one-out-aggregate`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `exclude_agent_id`: string (required)
- `weights`: object {agent_id: weight} (excluding target agent)

#### Output
- `leave_one_out_belief_aggregate`: number ∈ [0,1]
- `leave_one_out_meta_prediction_aggregate`: number ∈ [0,1]

### Algorithm

1. **Validate inputs:**
   - Verify `belief_id` and `exclude_agent_id` non-empty
   - Verify excluded agent not in weights
   - Verify sum(weights) ≈ 1.0 (if weights non-empty)
   - Return error 422/400 if invalid

2. **Load submissions excluding target:**
   - Query `belief_submissions` where:
     - `belief_id` = provided
     - `epoch` = current_epoch
     - `agent_id` ≠ exclude_agent_id
   - If no submissions:
     - Return defaults (0.5, 0.5)

3. **Calculate leave-one-out aggregates:**
   - Initialize belief_aggregate = 0.0
   - Initialize meta_aggregate = 0.0
   - For each submission:
     - Verify agent_id has weight
     - Clamp belief to [EPSILON_PROBABILITY, 1-EPSILON_PROBABILITY]
     - Clamp meta_prediction similarly
     - Add weight × clamped_belief to belief_aggregate
     - Add weight × clamped_meta to meta_aggregate

4. **Apply final clamping:**
   - Clamp belief_aggregate to [EPSILON_PROBABILITY, 1-EPSILON_PROBABILITY]
   - Clamp meta_aggregate to [EPSILON_PROBABILITY, 1-EPSILON_PROBABILITY]

5. **Return:** Leave-one-out aggregates

## Error Handling

### Input Validation
- Missing required fields → 422
- Invalid weight normalization → 400
- Excluded agent in weights → 400

### State Validation
- Missing weight for participant → 504
- No submissions found → 404 (main aggregation only)

### Numerical Stability
- Clamp all probabilities to [ε, 1-ε]
- Handle near-zero entropy cases
- Ensure non-negative disagreement

## Constants
- EPSILON_PROBABILITY: 1e-10 (see configuration spec)