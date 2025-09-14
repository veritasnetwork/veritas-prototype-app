# Protocol Indexer Belief Submissions - Low Level Specification

## /protocol-indexer/beliefs/get-submissions

### Request Schema
```typescript
interface BeliefSubmissionsRequest {
  belief_id: string // UUID
}
```

### Response Schema
```typescript
interface BeliefSubmissionsResponse {
  belief_id: string
  belief_info: {
    creator_agent_id: string
    created_epoch: number
    expiration_epoch: number
    previous_aggregate: number
    previous_disagreement_entropy: number
    status: string
  }
  submissions: Array<{
    submission_id: string
    user: {
      id: string
      username: string
      display_name: string
    }
    agent_id: string
    belief: number // 0-1
    meta_prediction: number // 0-1
    epoch: number
    is_active: boolean
    stake_allocated: number // Calculated from epistemic weights
    created_at: string
    updated_at: string
  }>
}
```

### Algorithm

#### 1. Validate Input
- Check `belief_id` is valid UUID format
- Return 422 if invalid

#### 2. Verify Belief Exists
- Query `beliefs` table for `belief_id`
- Return 404 if belief not found
- Extract belief metadata

#### 3. Get Submissions
- Query `belief_submissions` table where `belief_id = request.belief_id`
- Join with `users` table on `agent_id` to get user info
- Order by `created_at` DESC

#### 4. Calculate Stakes
For each submission:
- Call `/protocol/weights/calculate` with:
  ```json
  {
    "agent_id": submission.agent_id,
    "target_epoch": current_epoch
  }
  ```
- Extract `stake_per_belief` from response
- Set `submission.stake_allocated = stake_per_belief`

#### 5. Format Response
- Structure according to response schema
- Return 200 with data

### Error Handling
- **422**: Invalid belief_id format
- **404**: Belief not found
- **503**: Database error or stake calculation failure