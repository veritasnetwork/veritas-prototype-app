# Mirror Descent Implementation

**Endpoint:** `/protocol/beliefs/mirror-descent`  
**Complexity:** O(n) where n = number of participants

## Interface

### Input
- `belief_id`: string (required)
- `pre_mirror_descent_aggregate`: number ∈ [0,1]
- `certainty`: number ∈ [0,1]
- `active_agent_indicators`: array[string]
- `weights`: object {agent_id: weight}

### Output
- `updated_beliefs`: object {agent_id: number}
- `post_mirror_descent_aggregate`: number ∈ [0,1]
- `post_mirror_descent_disagreement_entropy`: number ∈ [0,1]

## Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify pre_mirror_descent_aggregate ∈ [0,1]
   - Verify certainty ∈ [0,1]
   - Return error 422/400 if invalid

2. **BEGIN TRANSACTION**

3. **Load submissions:**
   - Query `belief_submissions` where `belief_id` = provided
   - Return error 404 if no submissions

4. **Apply mirror descent updates:**
   - Set learning_rate = certainty
   - Clamp aggregate: P_pre ∈ [ε, 1-ε]
   - For each submission:
     - If agent_id in active_agent_indicators:
       - Keep belief unchanged (active agents don't update)
     - Else (passive agent):
       - Clamp old belief: p_old ∈ [ε, 1-ε]
       - Apply multiplicative update rule:
         - If learning_rate ≈ 1: p_new = P_pre (full convergence)
         - If learning_rate ≈ 0: p_new = p_old (no update)
         - Else: Apply multiplicative formula
           - numerator = p_old^(1-α) × P_pre^α
           - denominator = p_old^(1-α) × P_pre^α + (1-p_old)^(1-α) × (1-P_pre)^α
           - p_new = numerator / denominator
       - Clamp result: p_new ∈ [ε, 1-ε]
       - Update submission.belief = p_new

5. **Bulk update database:**
   - Update all modified submissions atomically

6. **Recalculate post-mirror descent metrics:**
   - Call aggregation function with updated beliefs and weights
   - Extract post_aggregate and post_entropy

7. **COMMIT TRANSACTION**

8. **Return:** Updated beliefs and new metrics

## Error Handling

### Input Validation
- Missing required fields → 422
- Values out of range → 400
- No submissions found → 404

### Numerical Stability
- Clamp all probabilities to [ε, 1-ε]
- Handle division by near-zero denominators
- Special cases for learning_rate ≈ 0 or ≈ 1

### Transaction Management
- Atomic bulk update
- Rollback on any failure
- Return error 503 on database failure

## Database Operations
- **belief_submissions**: BULK UPDATE belief values

## Edge Cases
- No passive agents → aggregate unchanged
- Certainty = 0 → no updates
- Certainty = 1 → full convergence
- Near-zero/one beliefs → numerical safeguards