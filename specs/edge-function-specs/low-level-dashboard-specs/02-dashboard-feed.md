# Dashboard Posts Feed - Low Level Specification

## /dashboard/posts/get-feed

### Request Schema
```typescript
interface DashboardFeedRequest {
  user_id: string // For future personalization, currently ignored
  limit?: number // Default 20, max 100
  offset?: number // Default 0
}
```

### Response Schema
```typescript
interface DashboardFeedResponse {
  posts: Array<{
    id: string
    user_id: string
    title: string
    content: string
    media_urls: string[]
    opinion_belief_id: string | null
    created_at: string
    user: {
      username: string
      display_name: string
    }
    belief?: {
      belief_id: string
      previous_aggregate: number
      expiration_epoch: number
      status: string
      creator_agent_id: string
    }
    submissions?: Array<{
      submission_id: string
      user: {
        id: string
        username: string
        display_name: string
      }
      agent_id: string
      belief: number
      meta_prediction: number
      epoch: number
      is_active: boolean
      stake_allocated: number
      created_at: string
      updated_at: string
    }>
  }>
  total_count: number
}
```

### Algorithm

#### 1. Validate Input
- Validate `user_id` is provided
- Set defaults: `limit = 20`, `offset = 0`
- Enforce `limit <= 100`

#### 2. Fetch Posts (Same as app-post-get-feed)
- Query `posts` table with pagination
- Join with `users` table for author info
- Order by `created_at` DESC

#### 3. Enrich with Belief Data
For posts with `opinion_belief_id`:
- Query `beliefs` table for belief metadata
- Attach belief info to post

#### 4. Enrich with Submission Data
For posts with belief data:
- Call `/dashboard/beliefs/get-submissions` with `belief_id`
- Extract submissions array from response
- Attach submissions to post object

#### 5. Format Response
- Structure according to response schema
- Include total count for pagination
- Return 200 with data

### Performance Considerations
- Batch belief queries where possible
- Cache stake calculations for repeated agent_ids
- Consider pagination limits for large submission sets

### Error Handling
- **422**: Missing user_id or invalid pagination params
- **503**: Database error or downstream function failure
- **Partial Success**: If submissions fail to load, return posts without submissions data