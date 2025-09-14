# Dashboard Edge Functions

Dashboard-specific operations for protocol monitoring and debugging. Note that belief submission indexing has been moved to the **Protocol Indexer** category.

## Moved Functions

### /dashboard/beliefs/get-submissions → /protocol-indexer/beliefs/get-submissions
This function has been moved to the Protocol Indexer category as it provides read-only access to protocol data without dashboard-specific logic.

## /dashboard/posts/get-feed

Retrieves posts for dashboard with detailed belief submission data.

**Request Parameters:**
- `user_id`: Which user's perspective (for future personalization)
- `limit`: Number of posts to return
- `offset`: For pagination

**Response:**
- `posts`: Array of post objects with embedded belief and submission data
- `total_count`: Total posts available

**Process:**
1. Query posts from app database with user data (same as app-post-get-feed)
2. For opinion posts, enrich with belief aggregate data from protocol
3. For opinion posts, call `/protocol-indexer/beliefs/get-submissions` to get detailed submission data
4. Return enriched feed data optimized for dashboard monitoring