# Stake Redistribution Implementation

**Endpoint:** `/protocol/beliefs/stake-redistribution`

## Interface
**Input:**
- `belief_id`: string
- `information_scores`: object {agent_id: number}
- `winners`: array[string]
- `losers`: array[string]
- `current_effective_stakes`: object {agent_id: number}

**Output:**
- `redistribution_occurred`: boolean
- `updated_total_stakes`: object {agent_id: number}
- `individual_rewards`: object {agent_id: number}
- `individual_slashes`: object {agent_id: number}
- `slashing_pool`: number

## Algorithm
1. **Validate inputs:**
   - `belief_id` must be non-empty
   - `information_scores` and `current_effective_stakes` must be non-empty

2. **Check zero-sum constraint:**
   - If only winners OR only losers (not both): return no redistribution
   - Need both for zero-sum transfers

3. **Calculate slashing pool (100% redistribution):**
   - `loser_stakes = sum(current_effective_stakes[id] for id in losers)`
   - `slash_pool = loser_stakes` (full redistribution)

4. **Calculate individual transfers:**
   - **Slashes:** For each loser:
     - `noise_contribution = abs(information_scores[agent_id])`
     - `total_noise = sum(abs(information_scores[id]) for id in losers)`
     - `slash_amount = (noise_contribution / total_noise) * slash_pool`
   - **Rewards:** For each winner:
     - `signal_contribution = information_scores[agent_id]`
     - `total_signal = sum(information_scores[id] for id in winners)`
     - `reward_amount = (signal_contribution / total_signal) * slash_pool`

5. **Load current agent stakes from database:**
   - `agents = db.agents.where(id IN current_effective_stakes.keys())`
   - Get current `total_stake` for each agent

6. **Update agent stakes:**
   - Winners: `new_stake = old_stake + reward_amount`
   - Losers: `new_stake = max(0, old_stake - slash_amount)` (prevent negative)
   - Others: unchanged

7. **Verify conservation:**
   ```python
   total_rewards = sum(rewards.values())
   total_slashes = sum(slashes.values())

   # Strong conservation check
   if abs(total_rewards - total_slashes) > 0.001:
       # RETURN ERROR
       return {"error": f"Conservation violated: rewards={total_rewards}, slashes={total_slashes}",
               "code": 500}
   ```

8. **Save updates:**
   - `db.agents.update(total_stake)` for each affected agent
   - Verify all updates succeeded
   - If any fail, return error

9. **Return:** Redistribution results with updated stakes and transfers

## Database Updates
- **agents table:** UPDATE total_stake for all affected agents

## Edge Cases
- No losers → no redistribution, `slash_pool = 0`, `redistribution_occurred = false`
- No winners → no redistribution, `slash_pool = 0`, `redistribution_occurred = false`
- Only winners or only losers → no redistribution (zero-sum constraint)
- Division by zero in signal/noise calculations → distribute equally among agents
- Conservation violation → return 500 error, do not save
