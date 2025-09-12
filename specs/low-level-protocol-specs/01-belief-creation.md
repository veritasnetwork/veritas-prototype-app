# Belief Creation Implementation

**Endpoint:** `/protocol/beliefs/create`

## Interface
**Input:** 
- `agent_id`: string
- `initial_belief`: number ∈ [0,1] 
- `duration_epochs`: integer > 0

**Output:**
- `belief_id`: string
- `initial_aggregate`: number (equals initial_belief)
- `expiration_epoch`: integer

## Algorithm
1. **Validate inputs:**
   - Check agent exists: `agent = db.agents.get(agent_id)`
   - Check sufficient stake: `agent.total_stake >= 5.0`
   - Validate belief range: `0 <= initial_belief <= 1`

2. **Create belief record:**
   - Generate unique `belief_id`
   - Set `expiration_epoch = current_epoch + duration_epochs`
   - Insert belief: `{id: belief_id, creator: agent_id, initial_aggregate: initial_belief, expiration_epoch, previous_disagreement_entropy: 0}`

3. **Update agent:**
   - Subtract stake: `agent.total_stake -= 5.0`
   - Increment count: `agent.active_belief_count += 1`
   - Save: `db.agents.update(agent_id, agent)`

4. **Return:** `{belief_id, initial_aggregate: initial_belief, expiration_epoch}`

## Database Updates
- **beliefs table:** INSERT new record
- **agents table:** UPDATE total_stake, active_belief_count

## Error Cases
- Agent not found → 404 "Agent not found"
- Insufficient stake → 400 "Insufficient stake (need $5)"
- Invalid belief range → 400 "Belief must be between 0 and 1"