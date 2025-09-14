# User Activity Indexer Implementation

## Get Agent Activity Data

**Endpoint:** `/protocol-indexer/users/get-activity`
**Complexity:** O(n*m) where n = agents, m = avg beliefs per agent

### Interface

#### Input
- `agent_ids`: array[string] (optional, if empty returns all agents)
- `limit`: integer (optional, default 50, max 100)
- `offset`: integer (optional, default 0)

#### Output
- `agent_activities`: array of agent activity objects
- `total_count`: integer (total agents matching criteria)

### Data Structure

```typescript
interface AgentActivity {
  agent_id: string
  total_stake: number
  active_belief_count: number
  submissions: Array<{
    submission_id: string
    belief_id: string
    belief_value: number
    meta_prediction: number
    epoch: number
    is_active: boolean
    stake_allocated: number
    created_at: string
    updated_at: string
    belief_info: {
      creator_agent_id: string
      created_epoch: number
      expiration_epoch: number
      current_aggregate: number
      current_disagreement_entropy: number
      status: string
    }
  }>
}
```

### Algorithm

1. **Validate inputs:**
   - Verify limit ≤ 100, offset ≥ 0
   - Validate agent_ids array if provided
   - Return error 422 if invalid

2. **Query agents:**
   - If agent_ids provided: filter by those IDs
   - Else: get all agents with pagination
   - Select: id, total_stake, active_belief_count
   - Order by created_at desc
   - Apply limit/offset

3. **For each agent, get submissions:**
   - Query belief_submissions table by agent_id
   - Select all submission fields
   - Order by updated_at desc for chronological activity

4. **For each submission, calculate stake:**
   - Call `/protocol/weights/calculate` with:
     - belief_id = submission.belief_id
     - participant_agents = [agent_id]
   - Extract effective_stakes[agent_id] for stake_allocated
   - Handle calculation failures gracefully (default to 0)

5. **For each submission, get belief info:**
   - Query beliefs table by belief_id
   - Select: creator_agent_id, created_epoch, expiration_epoch,
           previous_aggregate, previous_disagreement_entropy, status
   - Map previous_aggregate to current_aggregate
   - Map previous_disagreement_entropy to current_disagreement_entropy

6. **Aggregate and return:**
   - Combine agent data with enriched submissions
   - Return structured agent activities array
   - Include total_count for pagination

### Performance Optimizations

- **Batch stake calculations:** Group submissions by belief_id to reduce API calls
- **Cache belief info:** Avoid duplicate belief queries for shared beliefs
- **Streaming processing:** Process agents individually to reduce memory usage
- **Early termination:** Stop processing if client disconnects

### Error Handling

#### Input Validation
- Invalid limit/offset → 422
- Malformed agent_ids → 422
- Non-existent agent_ids → Continue with warning

#### Data Retrieval
- Agent not found → Skip and continue
- Submission query failure → Return partial data with warning
- Belief query failure → Include submission without belief_info
- Stake calculation failure → Set stake_allocated = 0

#### System Errors
- Database connection failure → 503
- Timeout during processing → 504
- Memory/resource exhaustion → 503

### Database Operations

**Primary queries:**
- `agents`: SELECT with optional filtering and pagination
- `belief_submissions`: SELECT by agent_id with ordering
- `beliefs`: SELECT by belief_id for metadata

**External calls:**
- `/protocol/weights/calculate`: For stake allocation calculations

### Constants and Limits

- **MAX_AGENTS_PER_REQUEST**: 100
- **DEFAULT_LIMIT**: 50
- **MAX_SUBMISSIONS_PER_AGENT**: No limit (but paginated at agent level)
- **STAKE_CALCULATION_TIMEOUT**: 5000ms per calculation
- **TOTAL_REQUEST_TIMEOUT**: 30000ms

### Response Codes

- **200**: Success with data
- **206**: Partial success (some data unavailable)
- **422**: Invalid input parameters
- **503**: Database or dependency failure
- **504**: Request timeout