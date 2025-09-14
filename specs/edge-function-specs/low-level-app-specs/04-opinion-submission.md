# Opinion Submission Implementation

**Endpoint:** `/app/posts/submit-opinion`
**Complexity:** O(1)

## Interface

### Input
- `user_id`: string (required)
- `post_id`: string (required)
- `belief_value`: number ∈ [0,1]
- `meta_prediction`: number ∈ [0,1]
- `is_active`: boolean (optional, default true)

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

4. **Verify post is opinion:**
   - Query `posts` table by `post_id`
   - Verify `is_opinion` = true
   - Verify `opinion_belief_id` is not null
   - Return error 400 if not opinion post

5. **Validate stake allocation:**
   - Call `/protocol/weights/validate-stake-allocation` with:
     - `agent_id` from user
     - `additional_beliefs` = 0 (check current)
   - Return error if insufficient stake

6. **BEGIN TRANSACTION**

7. **Get current epoch:**
   - Query `system_config` for "current_epoch" key
   - Default to 0 if not set

8. **Check existing submission:**
   - Query `belief_submissions` by:
     - `belief_id` = post.opinion_belief_id
     - `agent_id` = user.agent_id
   - If exists, go to step 9A
   - If not exists, go to step 9B

9A. **Update existing submission:**
   - Update fields:
     - `belief` = belief_value
     - `meta_prediction` = meta_prediction
     - `is_active` = is_active
     - `updated_at` = current timestamp
   - Skip to step 10

9B. **Create new submission:**
   - Generate `submission_id` (UUID v4)
   - Insert record:
     - `belief_id` = post.opinion_belief_id
     - `agent_id` = user.agent_id
     - `epoch` = current_epoch
     - `belief` = belief_value
     - `meta_prediction` = meta_prediction
     - `is_active` = is_active
     - `created_at` = current timestamp
   - Increment agent's `active_belief_count`
   - Increment user's `beliefs_participated`

10. **COMMIT TRANSACTION**

11. **Return:** Submission identifier and success status

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