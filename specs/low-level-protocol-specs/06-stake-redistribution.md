# Stake Redistribution Implementation

**Endpoint:** `/protocol/beliefs/stake-redistribution`

## Interface
**Input:**
- `belief_id`: string
- `learning_occurred`: boolean
- `economic_learning_rate`: number
- `information_scores`: object {agent_id: number}
- `winner_set`: array[string]
- `loser_set`: array[string]

**Output:**
- `updated_stakes`: object {agent_id: number}
- `individual_rewards`: object {agent_id: number}
- `individual_slashes`: object {agent_id: number}

## Algorithm
1. **Check learning condition:**
   - If `!learning_occurred`: return unchanged stakes, empty rewards/slashes

2. **Load agent stakes:**
   - `agents = db.agents.where(id IN (winner_set + loser_set))`
   - Calculate effective stakes: `effective_stake = agent.total_stake / agent.active_belief_count`

3. **Calculate slashing pool:**
   - `loser_stakes = sum(effective_stake for agent_id in loser_set)`
   - `slash_pool = economic_learning_rate * loser_stakes`

4. **Calculate individual transfers:**
   - **Slashes:** For each loser:
     - `noise_contribution = abs(information_scores[agent_id])`  
     - `total_noise = sum(abs(information_scores[id]) for id in loser_set)`
     - `slash_amount = (noise_contribution / total_noise) * slash_pool`
   - **Rewards:** For each winner:
     - `signal_contribution = information_scores[agent_id]`
     - `total_signal = sum(information_scores[id] for id in winner_set)`  
     - `reward_amount = (signal_contribution / total_signal) * slash_pool`

5. **Update agent stakes:**
   - Winners: `new_stake = old_stake + reward_amount`
   - Losers: `new_stake = old_stake - slash_amount`  
   - Passive: unchanged

6. **Verify conservation:**
   - `total_rewards = sum(rewards)`
   - `total_slashes = sum(slashes)`
   - Assert: `abs(total_rewards - total_slashes) < 0.001`

7. **Save updates:**
   - `db.agents.bulk_update(updated_agents)`

8. **Handle belief termination:**
   - If learning occurred OR current_epoch >= expiration_epoch:
     - Delete: `db.belief_submissions.delete(belief_id=belief_id)`
     - Delete: `db.beliefs.delete(id=belief_id)`
     - Update agent counts: `agent.active_belief_count -= 1`

9. **Return:** Updated stakes, individual transfers

## Database Updates
- **agents table:** UPDATE total_stake for all affected agents
- **agents table:** UPDATE active_belief_count (if belief terminated)
- **beliefs table:** DELETE belief record (if terminated)
- **belief_submissions table:** DELETE all submissions (if terminated)

## Edge Cases
- No losers → no redistribution, `slash_pool = 0`
- No winners → slashed amounts stay in system (edge case, shouldn't happen)
- Division by zero in signal/noise calculations → handle gracefully
- Conservation violation → log error, proceed with best approximation