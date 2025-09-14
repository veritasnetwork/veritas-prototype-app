# BTS Scoring Implementation

**Endpoint:** `/protocol/beliefs/bts-scoring`
**Complexity:** O(n²) where n = number of participants (due to leave-one-out calculations)

## Interface

### Input
- `belief_id`: string (required)
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]
- `weights`: object {agent_id: weight}

### Output
- `bts_signal_quality_scores`: object {agent_id: number}
- `information_scores`: object {agent_id: number}
- `winner_set`: array[string]
- `loser_set`: array[string]

## Algorithm

1. **Validate inputs:**
   - Verify `belief_id` is non-empty
   - Verify `weights` sum to 1.0
   - Return error 422/400 if invalid

2. **Load submissions:**
   - Query `belief_submissions` where `belief_id` = provided
   - Return error 404 if no submissions
   - Verify at least MIN_PARTICIPANTS_FOR_SCORING agents

3. **Calculate BTS score for each active agent:**
   - For each agent_id in active_agent_indicators:
     - Extract agent's belief (p_i) and meta-prediction (meta_i)
     - Calculate leave-one-out weights (renormalize excluding agent)
     - Call `/protocol/beliefs/leave-one-out-aggregate` to get:
       - belief_minus_i (aggregate belief without agent i)
       - meta_minus_i (aggregate meta-prediction without agent i)
     - Calculate three binary KL divergences:
       - D_KL1 = D_KL(p_i || meta_minus_i)
       - D_KL2 = D_KL(p_i || belief_minus_i)
       - D_KL3 = D_KL(belief_minus_i || meta_i)
     - BTS score: s_i = (D_KL1 - D_KL2) - D_KL3
   - Passive agents get score = 0

4. **Calculate information scores:**
   - For each agent: g_i = weight × BTS_score
   - Store in information_scores map

5. **Partition into winners and losers:**
   - winners = agents where g_i > 0
   - losers = agents where g_i < 0
   - neutral (g_i = 0) excluded from both sets

6. **Return:** Scores and partitions

## Binary KL Divergence Calculation

For probabilities p and q:
- Clamp both to [ε, 1-ε] for numerical stability
- D_KL(p||q) = p × log₂(p/q) + (1-p) × log₂((1-p)/(1-q))
- Handle edge cases where p ≈ q (return 0)

## Error Handling

### Input Validation
- Missing required fields → 422
- Invalid weights → 400
- Insufficient participants → 409

### Numerical Stability
- Clamp all probabilities before KL calculation
- Handle log(0) and division by zero
- Use EPSILON_PROBABILITY constant

### Edge Cases
- Single agent → return empty scores (need ≥ 2)
- All identical beliefs → scores approach 0
- No active agents → all scores 0

## Database Operations
- **belief_submissions**: READ only
- No updates (read-only scoring)