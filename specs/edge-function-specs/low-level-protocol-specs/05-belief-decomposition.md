# Belief Decomposition Implementation

## Purpose

Extracts the **common knowledge baseline** (prior) from **private signals** in agent beliefs using Belief Decomposition, a Bayesian technique that separates:
- **Common prior**: Shared baseline probability all agents agree on
- **Private signals**: Independent information each agent contributes beyond the prior

This enables the protocol to compute a full-information aggregate that properly weights private information against shared beliefs.

## Main Decomposition

**Endpoint:** `/protocol/beliefs/decompose`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `weights`: object {agent_id: weight} where sum = 1.0

#### Output
- `aggregate`: number ∈ [0,1] - Full information posterior
- `common_prior`: number ∈ [0,1] - Extracted common knowledge baseline
- `local_expectations_matrix`: object - 2×2 matrix W for binary beliefs
- `jensen_shannon_disagreement_entropy`: number ∈ [0,1]
- `normalized_disagreement_entropy`: number ∈ [0,1]
- `certainty`: number ∈ [0,1]
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]
- `decomposition_quality`: number ∈ [0,1] - Health metric of decomposition
- `leave_one_out_aggregates`: object {agent_id: number} - Belief aggregate excluding each agent (for BTS scoring)
- `leave_one_out_meta_aggregates`: object {agent_id: number} - Meta-prediction aggregate excluding each agent (for BTS scoring)

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
   - Require minimum 2 submissions for decomposition

3. **Extract belief and meta-prediction vectors:**
   - Filter submissions to agents with non-zero weights
   - Clamp all values to [ε, 1-ε] to prevent numerical issues
   - Build parallel arrays: beliefs[], metaPredictions[], orderedWeights[]

4. **Estimate local expectations matrix W (weighted regression):**
   - Compute weighted regression of meta-predictions on beliefs
   - For binary case: W is 2×2 where w_ij = E[P(j|signal) | world=i]
   - Use ridge regularization (ε=1e-5) to prevent singular matrix
   - Clamp w11 and w21 to [0,1], set w12=1-w11, w22=1-w21 to enforce row-stochastic property

5. **Extract common prior (stationary distribution):**
   - Compute left eigenvector of W with eigenvalue 1 (stationary distribution)
   - Binary case closed form: prior = w21 / (w21 + (1 - w11))
   - Clamp to [ε, 1-ε]

6. **Calculate weighted aggregate with prior correction:**
   - BD formula: Aggregate = Π(belief_i^w_i) / prior^(Σw_i)
   - Compute in log space: logAggregate = Σ(w_i × log(belief_i)) - effectiveN × log(prior)
   - Normalize using log-sum-exp trick to prevent overflow:
     - logComplement = Σ(w_i × log(1-belief_i)) - effectiveN × log(1-prior)
     - aggregate = 1 / (1 + exp(logComplement - logAggregate))
   - Clamp to [ε, 1-ε]

7. **Calculate decomposition quality metric:**
   - Matrix health: 1 / (1 + log₁₀(conditionNumber))
   - Prediction accuracy: 1 - (average error predicting meta from beliefs via W)
   - Combined: quality = 0.7 × matrixHealth + 0.3 × predictionAccuracy
   - Quality < 0.3 triggers fallback to naive aggregation

8. **Calculate disagreement entropy metrics:**
   - Binary entropy: H(p) = -p×log₂(p) - (1-p)×log₂(1-p)
   - Weighted average entropy: H_avg = Σ(w_i × H(belief_i))
   - Jensen-Shannon disagreement: D_JS = max(0, H(aggregate) - H_avg)
   - Certainty = 1 - D_JS (normalized to [0,1])

9. **Collect metadata:**
   - Extract meta_predictions map and active_agent_indicators from submissions

10. **Calculate leave-one-out aggregates (for BTS scoring):**
   - For each agent: compute weighted average of beliefs/metas excluding that agent
   - Renormalize by remaining weight sum
   - If only 1 agent remains after exclusion: return neutral (0.5, 0.5)
   - Returns: leave_one_out_aggregates and leave_one_out_meta_aggregates maps

11. **Return:** Complete decomposition results including leave-one-out aggregates

## Leave-One-Out Decomposition

**Endpoint:** `/protocol/beliefs/leave-one-out-decompose`
**Complexity:** O(n) where n = number of participants

### Interface

#### Input
- `belief_id`: string (required)
- `exclude_agent_id`: string (required)
- `weights`: object {agent_id: weight} (excluding target agent)

#### Output
- `leave_one_out_aggregate`: number ∈ [0,1]
- `leave_one_out_prior`: number ∈ [0,1]
- `leave_one_out_meta_aggregate`: number ∈ [0,1]

### Algorithm

1. **Validate inputs:**
   - Verify `belief_id` and `exclude_agent_id` non-empty
   - Verify excluded agent not in weights
   - Re-normalize remaining weights to sum to 1.0
   - Return error 422/400 if invalid

2. **Load submissions excluding target:**
   - Query `belief_submissions` where:
     - `belief_id` = provided
     - `epoch` = current_epoch
     - `agent_id` ≠ exclude_agent_id
   - If < 2 submissions remain:
     - Return defaults (0.5, 0.5, 0.5)

3. **Run decomposition on reduced set:**
   - Follow steps 3-6 from main decomposition
   - Use re-normalized weights

4. **Calculate leave-one-out meta aggregate:**
   ```typescript
   const metaAggregate = orderedWeights.reduce((sum, w, i) =>
     sum + w * metaPredictions[i], 0);
   ```

5. **Return:** Leave-one-out results

## Error Handling

### Input Validation Errors (422 Unprocessable Entity)
- **Missing belief_id**: `"belief_id is required"`
- **Missing weights**: `"weights object is required"`
- **Invalid belief_id type**: `"belief_id must be a non-empty string"`
- **Invalid weights type**: `"weights must be an object mapping agent_id to numeric weight"`
- **Empty weights object**: `"weights must contain at least one agent"`

### Input Validation Errors (400 Bad Request)
- **Weight normalization**: `"Weights must sum to 1.0, got {actual_sum}"`
  - Tolerance: ±1e-10
- **Negative weights**: `"All weights must be non-negative, agent {agent_id} has weight {weight}"`
- **Excluded agent in weights**: `"Excluded agent {agent_id} must not be in weights object"`
- **Invalid weight values**: `"Weight for agent {agent_id} is NaN or Infinity"`

### State Validation Errors (404 Not Found)
- **No submissions found**: `"No submissions found for belief_id {belief_id} in epoch {epoch}"`
- **Belief not found**: `"Belief {belief_id} does not exist"`

### Processing Errors (409 Conflict)
- **Insufficient participants**: `"Insufficient participants for decomposition: {count} < 2. Need at least 2 agents with non-zero weights."`
- **Insufficient weighted participants**: `"After filtering by weights, only {count} participants remain (need ≥2)"`

### Numerical Stability Warnings (200 OK with warnings in logs)
- **High condition number**: `"Matrix condition number {number} exceeds recommended threshold {MAX_CONDITION_NUMBER}. Decomposition quality: {quality}"`
- **Poor prediction accuracy**: `"Matrix prediction error {error} is high. Average per-agent error: {avg_error}. Decomposition quality: {quality}"`
- **Matrix near-singular**: `"Matrix determinant {det} is near zero. Using ridge regularization with epsilon={RIDGE_EPSILON}"`
- **Extreme probabilities clamped**: `"Clamped {count} probability values to [{epsilon}, {1-epsilon}] range"`

### Matrix Validation Errors (500 Internal Server Error)
- **Non-stochastic matrix**: `"Extracted matrix W is not row-stochastic. Row 0 sum: {sum0}, Row 1 sum: {sum1}"`
- **Invalid matrix elements**: `"Matrix contains invalid values. W11={w11}, W12={w12}, W21={w21}, W22={w22}"`
- **Failed eigenvalue computation**: `"Cannot compute stationary distribution. Matrix eigenvalues: λ1={l1}, λ2={l2}"`
- **NaN in computation**: `"Numerical instability detected: {variable_name} is NaN at step {step_name}"`

### Database Errors (500 Internal Server Error)
- **Query failure**: `"Failed to load submissions: {db_error_message}"`
- **Epoch fetch failure**: `"Failed to get current epoch: {db_error_message}"`

## Invariants

These properties MUST hold throughout execution. Violations indicate bugs:

### Input Invariants
1. `Σ(weights) = 1.0 ± 1e-10`
2. `∀agent: 0 ≤ weight[agent] ≤ 1`
3. `belief_id is non-empty UUID`

### Data Invariants
4. `∀belief ∈ beliefs: 0 < belief < 1` (after clamping)
5. `∀meta ∈ metaPredictions: 0 < meta < 1` (after clamping)
6. `length(beliefs) = length(metaPredictions) = length(orderedWeights)`

### Matrix Invariants
7. `W.w11 + W.w12 = 1.0 ± 1e-6` (row-stochastic)
8. `W.w21 + W.w22 = 1.0 ± 1e-6` (row-stochastic)
9. `∀w ∈ W: 0 ≤ w ≤ 1` (probability elements)

### Output Invariants
10. `0 < aggregate < 1`
11. `0 < commonPrior < 1`
12. `0 ≤ certainty ≤ 1`
13. `0 ≤ decompositionQuality ≤ 1`
14. `0 ≤ jensenShannonDisagreementEntropy ≤ 1` (after normalization)

### Computational Invariants
15. `!isNaN(aggregate) && isFinite(aggregate)` (no numerical explosion)
16. `!isNaN(commonPrior) && isFinite(commonPrior)`
17. `conditionNumber > 0`

## Numerical Stability Measures

### Probability Clamping
- **When**: Before any computation using probabilities
- **Range**: [1e-10, 1 - 1e-10]
- **Why**: Prevents log(0) and division by zero

### Log-Space Computation
- **When**: Computing products of probabilities
- **Why**: Avoids underflow when multiplying many small numbers
- **Formula**: `exp(Σ log(x_i))` instead of `Π x_i`

### Ridge Regularization
- **When**: Estimating matrix W via regression
- **Epsilon**: 1e-5
- **Why**: Prevents singular matrix when beliefs are highly correlated
- **Formula**: `denominator + RIDGE_EPSILON` instead of `denominator`

### Condition Number Monitoring
- **Threshold**: 1000 (warning if exceeded)
- **Why**: High condition number → small input changes cause large output changes
- **Action**: Log warning, reduce decomposition_quality score

### Matrix Row Normalization
- **When**: During matrix construction
- **Method**: Clamp one element, compute complement
- **Formula**:
  - `w11 = clamp(w11_raw, 0, 1)`
  - `w12 = 1 - w11` (guaranteed in [0,1])
  - `w21 = clamp(w21_raw, 0, 1)`
  - `w22 = 1 - w21` (guaranteed in [0,1])
- **Why**: Maintains row-stochastic property by construction, no renormalization needed

### Log-Sum-Exp Trick
- **When**: Computing final aggregate from log probabilities
- **Why**: Prevents overflow when exp(logAggregate) or exp(logComplement) exceed float range
- **Formula**: `aggregate = 1 / (1 + exp(logComplement - logAggregate))`
- **Edge cases**:
  - If `logDiff > 700`: aggregate ≈ 0 (complement dominates)
  - If `logDiff < -700`: aggregate ≈ 1 (aggregate dominates)
  - Prevents overflow with large effectiveN or extreme priors

## Constants
- EPSILON_PROBABILITY: 1e-10 (probability bounds)
- RIDGE_EPSILON: 1e-5 (regularization parameter)
- MIN_PARTICIPANTS: 2 (minimum for decomposition)
- MAX_CONDITION_NUMBER: 1000 (matrix health threshold)

## Fallback Behavior

### When Fallback Occurs
Decomposition falls back to naive aggregation if:
1. **Decomposition quality < 0.3** (30% threshold)
   - Rationale: Quality below 0.3 indicates either:
     - Matrix condition number > ~500 (numerical instability)
     - Prediction error > 70% (W doesn't explain meta-predictions)
2. **Exception during decomposition** (any runtime error)
3. **Matrix validation failures** (non-stochastic, NaN values)

### Fallback Procedure
When fallback is triggered:
1. **Log structured warning**:
   ```
   {
     "event": "decomposition_fallback",
     "belief_id": "{belief_id}",
     "reason": "{why_fallback_triggered}",
     "decomposition_quality": {quality_or_null},
     "condition_number": {number_or_null},
     "prediction_accuracy": {accuracy_or_null},
     "participant_count": {n}
   }
   ```

2. **Call naive aggregation function**: `/protocol/beliefs/aggregate`
   - Pass same `belief_id` and `weights`
   - Returns compatible output structure

3. **Augment aggregation response**: Add BD-specific fields with defaults
   - `common_prior`: 0.5 (uninformative prior)
   - `local_expectations_matrix`: `{w11: 0.5, w12: 0.5, w21: 0.5, w22: 0.5}` (identity-like)
   - `decomposition_quality`: 0.0 (indicates fallback)

4. **Continue epoch processing**: Fallback is transparent to caller

### Quality Threshold Rationale
- **0.3 threshold chosen because**:
  - Below 0.3: Matrix health < 0.43 OR prediction accuracy < 0.43
  - Matrix health 0.43 → condition number ~370
  - Prediction accuracy 0.43 → 57% average error per agent
  - Both indicate decomposition is unreliable
- **Conservative**: Prefer fallback over bad decomposition
- **Tested empirically**: Random beliefs have quality 0.2-0.4 range

## Weighted BD Interpretation

### Importance Weighting vs Frequency Weighting

**Our implementation uses importance weighting**, not frequency weighting:

- **Importance weighting**: Each agent contributes proportionally to their epistemic weight
  - Agent with weight 0.5 contributes half as much as agent with weight 1.0
  - Formula: `Π(belief_i^w_i) / prior^(Σw_i)`
  - Effective N = Σw_i (typically ≈ 1.0 when weights normalized)

- **Frequency weighting** (NOT used): Simulate multiple copies of same belief
  - Agent with weight 0.5 would be counted as 0.5 agents
  - Would make beliefs too similar → decomposition fails
  - Not suitable for sybil resistance

### Mathematical Properties

**Weighted effective N:**
```
effectiveN = Σw_i
```

When weights sum to 1.0 (as enforced by input validation):
- `effectiveN = 1.0`
- We compute: `Π(belief_i^w_i) / prior^1`
- This is geometrically weighted aggregate divided by common prior
- Maintains BD's information decomposition property

**Why this is correct:**
- Weights represent relative information quality, not observation count
- High-weight agents get more influence on aggregate AND prior extraction
- Preserves BD's ability to separate shared vs. independent information

## Integration Notes

### Replacing Naive Aggregation
To replace the current aggregation with BD:
1. Call `/protocol/beliefs/decompose` instead of `/protocol/beliefs/aggregate`
2. Use the `aggregate` field from BD response
3. Monitor `decomposition_quality` for health checks
4. Fall back to naive aggregation if quality < 0.3

### Database Schema
No schema changes required. BD uses existing:
- `belief_submissions.belief` → beliefs vector
- `belief_submissions.meta_prediction` → meta-predictions vector
- Epistemic weights from weight calculation

### Performance Specifications
- **Computational complexity**: O(n) where n = participant count
  - Matrix estimation: 5n operations (weighted sums)
  - Aggregate calculation: 2n operations (log products)
  - Quality metrics: 2n operations (condition number + prediction error)
  - Total: ~9n floating-point operations
- **Memory complexity**: O(n) - three vectors of size n
- **Expected throughput**:
  - Single-threaded: >10,000 beliefs/second (n=100)
  - Bottleneck: Database I/O (100-500ms per belief)
  - Computation overhead: <1ms per belief
- **Scalability**: Linear with participant count
  - n=10: <0.1ms
  - n=100: <1ms
  - n=1000: <10ms
- **No caching required**: Stateless computation, results not reused

## Edge Cases

| Scenario | Behavior | Quality Impact |
|----------|----------|----------------|
| **Identical beliefs** (all 0.6) | Aggregate=0.6, prior≈0.6, certainty≈1.0 | Low (singular matrix) → may fallback |
| **Extreme disagreement** (0.95 vs 0.05) | Aggregate≈0.5, prior≈0.5, certainty<0.5 | Depends on meta-predictions |
| **n=2 participants** | Proceeds but underdetermined (4 params, 2 points) | Low → likely fallback |
| **Single weighted agent** | Error 409 (insufficient participants) | N/A - triggers fallback |
| **Extreme probabilities** (>0.999 or <0.001) | Clamped to [ε, 1-ε], logs warning | No impact if moderate |
| **Uncorrelated metas** | W can't predict → low accuracy | <0.3 → fallback |
| **Highly correlated beliefs** | Near-singular matrix, high condition number | Low → may fallback |
| **Leave-one-out n=2** | Returns neutral defaults (0.5, 0.5, 0.5) | N/A - graceful degradation |