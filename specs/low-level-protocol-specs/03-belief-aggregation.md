# Belief Aggregation Implementation

## Main Aggregation
**Endpoint:** `/protocol/beliefs/aggregate`

### Interface
**Input:**
- `belief_id`: string
- `weights`: object {agent_id: weight}

**Output:**
- `pre_mirror_descent_aggregate`: number
- `jensen_shannon_disagreement_entropy`: number  
- `normalized_disagreement_entropy`: number
- `certainty`: number
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]

### Algorithm
1. **Load data:**
   - `submissions = db.belief_submissions.where(belief_id=belief_id, epoch=current_epoch)`
   - `agents = db.agents.where(id IN submissions.agent_ids)`

2. **Compute aggregate:**
   - `aggregate = sum(weights[agent_id] * submission.belief for each submission)`

3. **Calculate Jensen-Shannon disagreement entropy:**
   - Binary entropy: `H(p) = -p * log2(p) - (1-p) * log2(1-p)` where `H(0) = H(1) = 0` (edge cases)
   - Weighted average entropy: `H_avg = sum(weights[agent_id] * H(submission.belief))`
   - Aggregate entropy: `H_agg = H(aggregate)` 
   - Jensen-Shannon disagreement: `D_JS = H_agg - H_avg`
   - Normalized: `D_JS_norm = D_JS / 1.0` (binary max entropy = 1)
   - Certainty: `certainty = 1 - D_JS_norm`

5. **Return:** All computed values plus meta-predictions and active agents as pass-through

## Leave-One-Out Aggregation
**Endpoint:** `/protocol/beliefs/leave-one-out-aggregate`

### Interface
**Input:**
- `belief_id`: string  
- `exclude_agent_id`: string
- `weights`: object {agent_id: weight} (excluding target agent)

**Output:**
- `leave_one_out_belief_aggregate`: number
- `leave_one_out_meta_prediction_aggregate`: number

### Algorithm
1. **Load data excluding target agent:**
   - `submissions = db.belief_submissions.where(belief_id=belief_id, epoch=current_epoch, agent_id != exclude_agent_id)`

2. **Compute aggregates:**
   - `belief_aggregate = sum(weights[agent_id] * submission.belief)`
   - `meta_aggregate = sum(weights[agent_id] * submission.meta_prediction)`

3. **Return:** Both aggregates

## Database Updates
None (read-only operations)

## Edge Cases
- No submissions → return default values (0.5 aggregate, 0 entropy, 1 certainty)
- Single agent → certainty = 1, no disagreement
- Division by zero in entropy → handle p=0,1 cases with limits