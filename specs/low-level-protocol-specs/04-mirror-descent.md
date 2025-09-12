# Mirror Descent Implementation

**Endpoint:** `/protocol/beliefs/mirror-descent`

## Interface
**Input:**
- `belief_id`: string
- `pre_mirror_descent_aggregate`: number
- `certainty`: number
- `active_agent_indicators`: array[string]

**Output:**
- `updated_beliefs`: object {agent_id: number}
- `post_mirror_descent_aggregate`: number  
- `post_mirror_descent_disagreement_entropy`: number

## Algorithm
1. **Load agent beliefs:**
   - `submissions = db.belief_submissions.where(belief_id=belief_id)`
   - `agents = db.agents.where(id IN submission.agent_ids)`

2. **Update passive agents:**
   - `learning_rate = certainty`
   - For each submission where `agent_id NOT IN active_agent_indicators`:
     - `p_old = submission.belief`
     - `P_pre = pre_mirror_descent_aggregate`
     - Multiplicative update: `p_new = (p_old^(1-η) * P_pre^η) / (p_old^(1-η) * P_pre^η + (1-p_old)^(1-η) * (1-P_pre)^η)`
     - Handle edge cases: if `p_old = 0`: `p_new = 0`, if `p_old = 1`: `p_new = 1`
     - Update: `submission.belief = p_new`

3. **Keep active agents unchanged:**
   - Active agents retain their submitted beliefs

4. **Save updated beliefs:**
   - `db.belief_submissions.bulk_update(submissions)`

5. **Recalculate aggregate:**
   - Calculate new weights (same as aggregation)
   - `post_aggregate = sum(weights[agent_id] * updated_belief)`

6. **Calculate post-mirror descent entropy:**
   - Use same entropy calculation as aggregation but with updated beliefs
   - Return `D_JS_post`

7. **Return:** `{updated_beliefs: {agent_id: new_belief}, post_aggregate, post_entropy}`

## Database Updates
- **belief_submissions table:** UPDATE belief values for passive agents

## Edge Cases
- No passive agents → no belief updates, aggregate unchanged
- Certainty = 0 → no updates (learning_rate = 0)
- Certainty = 1 → full convergence to aggregate
- Handle numerical edge cases in multiplicative update (0/1 beliefs)