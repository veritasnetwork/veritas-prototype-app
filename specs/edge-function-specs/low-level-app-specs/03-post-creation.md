# Post Creation Implementation

**Endpoint:** `/app/posts/create`
**Complexity:** O(1)

## Interface

### Input
- `user_id`: string (required)
- `title`: string (required, max 200 chars)
- `content`: string (optional, max 2000 chars)
- `initial_belief`: number ∈ [0,1] (required)
- `meta_prediction`: number ∈ [0,1] (optional, defaults to initial_belief)

### Output
- `post_id`: string
- `belief_id`: string
- `post`: object with belief data

## Algorithm

1. **Validate required fields:**
   - Verify `user_id` is non-empty
   - Verify `title` is non-empty after trimming
   - Verify `initial_belief` is provided and ∈ [0,1]
   - Return error 422 if missing or invalid

2. **Validate content constraints:**
   - Verify title length ≤ 200 chars
   - Verify content length ≤ 2000 chars if provided
   - Verify meta_prediction ∈ [0,1] if provided
   - Return error 400 if invalid

3. **Verify user exists:**
   - Query `users` table by `user_id`
   - Retrieve `agent_id` for protocol calls
   - Return error 404 if not found

4. **BEGIN TRANSACTION**

5. **Create belief market via protocol:**
   - Call `/protocol/beliefs/create` with:
     - `agent_id` from user record
     - `initial_belief` value
   - Propagate any protocol errors
   - Extract `belief_id` from response

6. **Create post record:**
   - Generate `post_id` (UUID v4)
   - Insert record:
     - `user_id` = provided
     - `title` = trimmed value
     - `content` = trimmed value or empty string
     - `belief_id` = belief_id from step 5
     - `created_at` = current timestamp

7. **Update user statistics:**
   - Increment `beliefs_created` counter
   - Update user record

8. **COMMIT TRANSACTION**

9. **Return:** Post and belief identifiers with enriched post data

## Error Handling

### Input Validation
- Missing user_id, title, or initial_belief → 422
- Title exceeds 200 chars → 400
- Content exceeds 2000 chars → 400
- Invalid belief values → 400
- User not found → 404

### Protocol Integration
- Calls `/protocol/beliefs/create` for market creation
- Propagates protocol errors (insufficient stake, etc.)
- Links post to belief via `belief_id`

### Transaction Management
- Atomic creation of post + belief market
- Rollback both on any failure
- Return error 503 on database failure

## Database Operations
- **SELECT**: Verify user exists
- **CALL**: Protocol belief creation
- **INSERT**: Create post with belief
- **UPDATE**: Increment user statistics