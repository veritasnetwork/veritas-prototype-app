# Post Creation Implementation

**Endpoint:** `/app/posts/create`
**Complexity:** O(1)

## Interface

### Input
- `user_id`: string (required)
- `title`: string (optional, max MAX_TITLE_LENGTH)
- `content`: string (optional, max MAX_CONTENT_LENGTH)
- `media_url`: string (optional, Supabase Storage URL)
- `media_type`: string (optional, must be in SUPPORTED_IMAGE_TYPES or SUPPORTED_VIDEO_TYPES)

**Note**: At least one of `title` or `content` must be provided

### Output
- `post_id`: string
- `post`: object

## Algorithm

1. **Validate required fields:**
   - Verify `user_id` is non-empty
   - Verify at least one of `title` or `content` is non-empty after trimming
   - Return error 422 if missing

2. **Validate content constraints:**
   - Verify title length ≤ MAX_TITLE_LENGTH if provided
   - Verify content length ≤ MAX_CONTENT_LENGTH if provided
   - If media_type provided, verify it's in SUPPORTED_IMAGE_TYPES or SUPPORTED_VIDEO_TYPES
   - Return error 400 if exceeded or invalid

3. **Verify user exists:**
   - Query `users` table by `user_id`
   - Return error 404 if not found

4. **BEGIN TRANSACTION**

5. **Create post record:**
   - Generate `post_id` (UUID v4)
   - Insert record:
     - `user_id` = provided
     - `title` = trimmed value or null
     - `content` = trimmed value
     - `is_opinion` = false
     - `opinion_belief_id` = null
     - `view_count` = 0
     - `created_at` = current timestamp

6. **COMMIT TRANSACTION**

7. **Return:** Post identifier with full record

## Error Handling

### Input Validation
- Missing user_id or content → 422
- Content exceeds limits → 400
- User not found → 404

### Transaction Management
- Single atomic insert
- Rollback on constraint violation
- Return error 503 on database failure

## Database Operations
- **SELECT**: Verify user exists
- **INSERT**: Create post record