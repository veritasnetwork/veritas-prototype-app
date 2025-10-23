# Post Creation Implementation

**Endpoint:** `/app/posts/create`
**Complexity:** O(1)

## Interface

### Input
- `user_id`: string (required)
- `post_type`: string (required) - 'text', 'image', or 'video'
- `content_json`: TiptapDocument (required for text posts)
- `media_urls`: string[] (required for image/video posts)
- `caption`: string (optional, max 280 chars)
- `article_title`: string (optional, max 200 chars, for text posts)
- `cover_image_url`: string (optional, requires article_title)
- `initial_belief`: number ∈ [0,1] (optional - defaults to 0.5 neutral)
- `meta_belief`: number ∈ [0,1] (optional, only used if initial_belief provided)
- `belief_duration_hours`: number (required)
- `post_id`: UUID (required)
- `tx_signature`: string (required)
- `pool_deployment`: object (required)

### Output
- `post_id`: string
- `belief_id`: string
- `post`: object with belief data

## Algorithm

1. **Validate required fields:**
   - Verify `user_id`, `post_type`, `post_id`, and `tx_signature` are provided
   - Verify `post_type` is one of: 'text', 'image', 'video'
   - Verify `initial_belief` ∈ [0,1] if provided (optional)
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

5. **Create belief record (inline):**
   - Insert into `beliefs` table:
     - `id` = post_id (same ID for linkage)
     - `creator_agent_id` = agent_id
     - `created_epoch` = current epoch
     - `expiration_epoch` = calculated from duration
     - `previous_aggregate` = initial_belief ?? 0.5 (default to neutral)
     - `previous_disagreement_entropy` = 0.0

6. **Create post record:**
   - Generate `post_id` (UUID v4)
   - Insert record:
     - `user_id` = provided
     - `title` = trimmed value
     - `content` = trimmed value or empty string
     - `belief_id` = belief_id from step 5
     - `created_at` = current timestamp

7. **Submit initial belief (if provided):**
   - If `initial_belief` was provided:
     - Insert into `belief_submissions` table
     - Link to belief and agent
   - If not provided, skip this step (no initial submission)

8. **Store pool deployment info:**
   - Insert pool deployment record
   - Link to post and belief

9. **COMMIT TRANSACTION**

9. **Return:** Post and belief identifiers with enriched post data

## Error Handling

### Input Validation
- Missing required fields (user_id, post_type, post_id, tx_signature) → 422
- Invalid post_type → 400
- Caption exceeds 280 chars → 400
- Article title exceeds 200 chars → 400
- Cover image without title → 400
- Invalid belief values (if provided) → 400
- User not found → 404

### Belief Creation
- Creates belief inline (not via protocol endpoint)
- Defaults `previous_aggregate` to 0.5 if no initial belief provided
- Initial belief submission is optional
- Users can submit beliefs later via separate endpoint

### Transaction Management
- Atomic creation of post + belief market
- Rollback both on any failure
- Return error 503 on database failure

## Database Operations
- **SELECT**: Verify user exists
- **CALL**: Protocol belief creation
- **INSERT**: Create post with belief
- **UPDATE**: Increment user statistics