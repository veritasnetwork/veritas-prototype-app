# Feed Loading - Low Level Specification

## Algorithm

### 1. Initialize State
- `posts`: empty array, `loading`: true, `error`: null
- Trigger fetch on component mount

### 2. Fetch Data
- POST to `http://127.0.0.1:54321/functions/v1/app-post-get-feed`
- Headers: Authorization Bearer token, Content-Type JSON
- Body: `{user_id: 'default-user', limit: 50, offset: 0}`
- Validate response has `posts` array and `total_count` number

### 3. Transform Data
For each post:
- Extract: `id`, `title`, `content`, `created_at`, `user.display_name || user.username`
- Classify as opinion if `opinion_belief_id` exists
- Calculate opinion percentage: `Math.round(belief.previous_aggregate * 100)`
- Apply fallbacks: 'Unknown' for missing author, 'Untitled' for missing title

### 4. Update State
- Success: Set `posts` array, `loading` false, `error` null
- Error: Set `error` message, `loading` false, keep existing posts

### 5. Render
- **Loading**: Show skeleton with 3 placeholder cards
- **Error**: Show error message with refresh button
- **Success**: Render posts with OpinionIndicator (orange circle, right-aligned) for opinion posts only

## Error Handling
- Network errors: Display retry option
- Malformed data: Skip invalid posts, continue with valid ones
- Missing fields: Apply fallback values, continue rendering