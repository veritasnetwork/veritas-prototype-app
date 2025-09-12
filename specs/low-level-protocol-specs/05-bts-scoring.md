# BTS Scoring Implementation

**Endpoint:** `/protocol/beliefs/bts-scoring`

## Interface
**Input:**
- `belief_id`: string
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]
- `weights`: object {agent_id: weight}

**Output:**
- `bts_signal_quality_scores`: object {agent_id: number}
- `information_scores`: object {agent_id: number}  
- `winner_set`: array[string]
- `loser_set`: array[string]

## Algorithm
1. **Load updated beliefs and stakes:**
   - `submissions = db.belief_submissions.where(belief_id=belief_id)`
   - `agents = db.agents.where(id IN submission.agent_ids)`

2. **For each active agent, calculate BTS score:**
   - `p_i = submission.belief` (agent i's belief)
   - `meta_i = submission.meta_prediction` (agent i's meta-prediction)  
   - Call `/protocol/beliefs/leave-one-out-aggregate` with `exclude_agent_id = agent_id`
   - Get `belief_minus_i` and `meta_minus_i` (leave-one-out aggregates)
   - Calculate binary KL divergences:
     - `D_KL1 = D_KL(p_i || meta_minus_i)`
     - `D_KL2 = D_KL(p_i || belief_minus_i)` 
     - `D_KL3 = D_KL(belief_minus_i || meta_i)`
   - BTS score: `s_i = (D_KL1 - D_KL2) - D_KL3`

3. **Calculate information scores:**
   - For each active agent: `g_i = weights[agent_id] * s_i`

4. **Partition agents:**
   - `winners = [agent_id for agent_id, g_i in info_scores.items() if g_i > 0]`
   - `losers = [agent_id for agent_id, g_i in info_scores.items() if g_i < 0]`

5. **Return:** All computed scores and partitions

## Binary KL Divergence Helper
```python
def binary_kl(p, q, eps=1e-10):
    # Clamp to avoid numerical issues
    p = max(eps, min(1-eps, p))
    q = max(eps, min(1-eps, q))
    return p * log2(p/q) + (1-p) * log2((1-p)/(1-q))
```

## Database Updates
None (read-only operations)

## Edge Cases
- Single agent → no leave-one-out possible, return empty scores
- Identical beliefs → BTS scores approach 0
- Handle KL divergence edge cases (0, 1 probabilities)
- Active agents only → passive agents get score 0