# BTS Scoring Implementation

**Endpoint:** `/protocol/beliefs/bts-scoring`

## Interface
**Input:**
- `belief_id`: string
- `agent_meta_predictions`: object {agent_id: number}
- `active_agent_indicators`: array[string]

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
   - Call `/protocol/beliefs/leave-one-out-aggregate` with `exclude_agent_id = agent_id`
   - Get `belief_aggregate_minus_i` and `meta_aggregate_minus_i`
   - Calculate binary KL divergences:
     - `D_KL(p_i || meta_minus_i)`
     - `D_KL(p_i || belief_minus_i)` 
     - `D_KL(belief_minus_i || meta_i)`
   - BTS score: `s_i = (D_KL1 - D_KL2) - D_KL3`

3. **Calculate information scores:**
   - For each active agent: `g_i = effective_stake_i * s_i`
   - `effective_stake = agent.total_stake / agent.active_belief_count`

4. **Partition agents:**
   - `winners = [agent_id for agent_id, g_i in info_scores.items() if g_i > 0]`
   - `losers = [agent_id for agent_id, g_i in info_scores.items() if g_i < 0]`

5. **Return:** All computed scores and partitions

## Binary KL Divergence Helper
```python
def binary_kl(p, q):
    if p == 0: return -log(1-q) if q < 1 else float('inf')
    if p == 1: return -log(q) if q > 0 else float('inf')  
    if q == 0 or q == 1: return float('inf')
    return p * log(p/q) + (1-p) * log((1-p)/(1-q))
```

## Database Updates
None (read-only operations)

## Edge Cases
- Single agent → no leave-one-out possible, return empty scores
- Identical beliefs → BTS scores approach 0
- Handle KL divergence edge cases (0, 1 probabilities)
- Active agents only → passive agents get score 0