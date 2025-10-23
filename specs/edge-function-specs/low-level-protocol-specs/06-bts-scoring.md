# BTS Scoring Implementation

## Purpose

Measures **informativeness** of each agent's belief using Bayesian Truth Serum. BTS scores quantify how much **surprising, high-quality information** an agent contributes beyond the group consensus.

**Key insight**: Agents who predict what others will believe (meta-prediction) but hold a different belief themselves are providing valuable private information. BTS rewards agents whose beliefs are:
1. Different from the aggregate (surprising)
2. Consistent with their meta-prediction (well-calibrated)
3. More informative than just predicting the aggregate

**Endpoint:** `/protocol/beliefs/bts-scoring`
**Complexity:** O(n) - leave-one-out aggregates pre-computed by BD

## Interface

### Input
- `belief_id`: string (required)
- `weights`: object {agent_id: weight} where sum = 1.0
- `leave_one_out_aggregates`: object {agent_id: number} (from BD)
- `leave_one_out_meta_aggregates`: object {agent_id: number} (from BD)
- `active_agent_indicators`: array[string]

### Output
- `bts_signal_quality_scores`: object {agent_id: number} - Raw BTS scores ∈ ℝ
- `information_scores`: object {agent_id: number} - Weighted scores (g_i = w_i × BTS_i)
- `winner_set`: array[string] - Agents with g_i > 0
- `loser_set`: array[string] - Agents with g_i < 0

## Algorithm

1. **Validate inputs:**
   - Verify `belief_id`, `weights`, `leave_one_out_aggregates`, `leave_one_out_meta_aggregates` present
   - Verify `weights` sum to 1.0 ± 1e-10
   - Return error 422/400 if invalid

2. **Load submissions:**
   - Query `belief_submissions` where `belief_id` = provided and `epoch` = current
   - Return error 404 if no submissions
   - Require minimum 2 participants

3. **Calculate BTS score for each agent:**
   - For each agent_id in submissions:
     - Extract: p_i (belief), meta_i (meta-prediction), w_i (weight)
     - Get from BD output: belief_-i, meta_-i (leave-one-out aggregates)
     - Compute BTS score: **s_i = D_KL(p_i || meta_-i) - D_KL(p_i || belief_-i) - D_KL(belief_-i || meta_i)**
     - If agent not active: set s_i = 0
   - Store in `bts_signal_quality_scores`

4. **Calculate information scores:**
   - For each agent: **g_i = w_i × s_i**
   - Store in `information_scores`

5. **Partition agents:**
   - `winner_set`: agents where g_i > 0
   - `loser_set`: agents where g_i < 0
   - Neutral agents (g_i = 0) excluded from both

6. **Return:** Complete scoring results

## Binary KL Divergence

**Formula:** D_KL(p||q) = p × log₂(p/q) + (1-p) × log₂((1-p)/(1-q))

**Numerical stability:**
- Clamp both p and q to [ε, 1-ε] where ε = 1e-10
- If |p - q| < ε: return 0 (probabilities effectively equal)
- Never compute log(0) or division by zero

## Constants

- **EPSILON_PROBABILITY**: 1e-10 (probability bounds for clamping)
- **MIN_PARTICIPANTS**: 2 (minimum for BTS scoring)

## Invariants

1. `Σ(weights) = 1.0 ± 1e-10` (input)
2. `∀agent: leave_one_out_aggregates[agent] ∈ [0,1]` (from BD)
3. `∀agent: belief, meta ∈ [0,1]` (after clamping)
4. `∀agent: BTS score ∈ ℝ` (unbounded, can be negative)
5. `∀agent: g_i = w_i × s_i` (information score)
6. `winner_set ∩ loser_set = ∅` (disjoint sets)

## Error Handling

| Error Type | HTTP Code | Example Message |
|------------|-----------|-----------------|
| Missing belief_id | 422 | `"belief_id is required"` |
| Missing leave-one-out data | 422 | `"leave_one_out_aggregates required from BD"` |
| Invalid weights sum | 400 | `"Weights must sum to 1.0, got {sum}"` |
| No submissions | 404 | `"No submissions for belief_id {id}"` |
| Insufficient participants | 409 | `"Need ≥2 participants, got {n}"` |
| NaN in computation | 500 | `"Numerical error: {variable} is NaN"` |

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Single participant** | Error 409 (insufficient participants) |
| **All identical beliefs** | All BTS scores ≈ 0 (no surprising information) |
| **No active agents** | All scores = 0 (passive agents excluded) |
| **Extreme probabilities** (>0.999 or <0.001) | Clamped before KL divergence computation |
| **Leave-one-out = agent belief** | D_KL2 ≈ 0, agent rewarded if meta calibrated |
| **All winners or all losers** | Valid - one set may be empty |

## Integration with Belief Decomposition

**Critical dependency:** BTS requires BD's leave-one-out aggregates for efficiency.

**Pipeline:**
1. BD computes leave-one-out aggregates for all agents in O(n) total
2. BTS receives pre-computed aggregates as input
3. BTS computes KL divergences in O(n) (no repeated decompositions)
4. **Total complexity: O(n)** instead of O(n²)

**Without BD integration:**
- BTS would need to call leave-one-out decomposition n times
- Each call is O(n) → total O(n²)
- 100 agents: 100× slower

## Performance

- **Complexity**: O(n) per belief (with pre-computed leave-one-out)
- **Throughput**: >10,000 beliefs/second (computation only)
- **Bottleneck**: Database I/O, not computation