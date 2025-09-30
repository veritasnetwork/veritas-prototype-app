# Belief Submission Implementation

**Endpoint:** `/app/posts/submit-belief`
**Complexity:** O(1)

## Interface

### Input
- `user_id`: string (required)
- `post_id`: string (required)
- `belief_value`: number ∈ [0,1]
- `meta_prediction`: number ∈ [0,1]

### Output
- `submission_id`: string
- `success`: boolean

## Algorithm

1. **Validate required fields:**
   - Verify `user_id` is non-empty
   - Verify `post_id` is non-empty
   - Return error 422 if missing

2. **Validate probability constraints:**
   - Verify belief_value ∈ [0,1]
   - Verify meta_prediction ∈ [0,1]
   - Return error 400 if invalid

3. **Verify user exists:**
   - Query `users` table by `user_id`
   - Retrieve `agent_id` for submission
   - Return error 404 if not found

4. **Verify post has belief:**
   - Query `posts` table by `post_id`
   - Verify `belief_id` is not null
   - Return error 400 if belief_id missing

5. **Validate stake allocation:**
   - Call `/protocol/weights/validate-stake-allocation` with:
     - `agent_id` from user
     - `additional_beliefs` = 0 (check current)
   - Return error if insufficient stake

6. **BEGIN TRANSACTION**

7. **Check existing submission:**
   - Query `belief_submissions` by:
     - `belief_id` = post.belief_id
     - `agent_id` = user.agent_id
   - If exists, go to step 8A
   - If not exists, go to step 8B

8A. **Update existing submission:**
   - Update fields:
     - `belief` = belief_value
     - `meta_prediction` = meta_prediction
     - `updated_at` = current timestamp
   - Skip to step 9

8B. **Create new submission:**
   - Generate `submission_id` (UUID v4)
   - Insert record:
     - `belief_id` = post.belief_id
     - `agent_id` = user.agent_id
     - `belief` = belief_value
     - `meta_prediction` = meta_prediction
     - `created_at` = current timestamp
   - Agent belief count automatically calculated dynamically
   - Increment user's `beliefs_participated`

9. **COMMIT TRANSACTION**

10. **Return:** Submission identifier and success status

## Error Handling

### Input Validation
- Missing user_id or post_id → 422
- Invalid belief/meta values → 400
- User not found → 404
- Post not found → 404
- Not an opinion post → 400

### Stake Validation
- Calls `/protocol/weights/validate-stake-allocation`
- Propagates insufficient stake errors
- Ensures minimum stake per belief met

### Transaction Management
- Atomic submission creation/update
- Updates agent and user statistics
- Rollback all on any failure
- Return error 503 on database failure

## Database Operations
- **SELECT**: Verify user and post exist
- **SELECT**: Check for existing submission
- **INSERT/UPDATE**: Create or update submission
- **UPDATE**: Increment counters (new submissions only)