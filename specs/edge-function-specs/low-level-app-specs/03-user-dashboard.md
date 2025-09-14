# User Dashboard Activity Implementation

## Get Dashboard User Activity

**Endpoint:** `/app/dashboard/users-get-activity`
**Complexity:** O(n*m) where n = users, m = avg beliefs per user

### Interface

#### Input
- `user_ids`: array[string] (optional, if empty returns all users)
- `limit`: integer (optional, default 20, max 50)
- `offset`: integer (optional, default 0)

#### Output
- `users`: array of user activity objects with app context
- `total_count`: integer (total users matching criteria)

### Data Structure

```typescript
interface UserDashboardActivity {
  user_id: string
  username: string
  display_name: string
  avatar_url: string | null
  agent_id: string
  total_stake: number
  active_belief_count: number
  belief_participations: Array<{
    submission_id: string
    belief_id: string
    belief_value: number
    meta_prediction: number
    stake_allocated: number
    is_active: boolean
    created_at: string
    updated_at: string
    belief_info: {
      creator_agent_id: string
      created_epoch: number
      expiration_epoch: number
      current_aggregate: number
      status: string
    }
    post_context?: {  // Only if belief has associated opinion post
      post_id: string
      title: string
      content_preview: string  // First 200 chars
      created_at: string
      post_type: 'opinion'
    } | null
  }>
}
```

### Algorithm

1. **Validate inputs:**
   - Verify limit ≤ 50, offset ≥ 0 (smaller limits than protocol due to enrichment)
   - Validate user_ids array if provided
   - Return error 422 if invalid

2. **Get users with agent mapping:**
   - Query users table with optional filtering
   - Select: id, username, display_name, avatar_url, agent_id, total_stake, beliefs_created, beliefs_participated
   - Order by created_at desc
   - Apply limit/offset

3. **Get protocol activity data:**
   - Extract agent_ids from users
   - Call `/protocol/users/get-activity` with agent_ids array
   - Handle protocol function errors gracefully

4. **Map protocol data to users:**
   - Create map: agent_id → protocol activity data
   - Match each user to their corresponding agent activity
   - Handle cases where agent data is missing

5. **Enrich with post context:**
   - For each belief participation:
     - Query posts table: `SELECT id, title, content, created_at FROM posts WHERE opinion_belief_id = ?`
     - If post found: add post_context with type 'opinion'
     - If no post: leave post_context as null (standalone protocol belief)
     - Truncate content to 200 chars for content_preview

6. **Format for dashboard consumption:**
   - Convert agent-centric data to user-centric structure
   - Apply UI-friendly formatting
   - Sort belief_participations by updated_at desc
   - Calculate additional metrics if needed

### Performance Optimizations

- **Single protocol call:** Batch all agent_ids into one protocol request
- **Batch post queries:** Use WHERE opinion_belief_id IN (...) for multiple beliefs
- **Selective enrichment:** Only query posts for beliefs that might have them
- **Response streaming:** Start sending data as soon as users are processed
- **Post content caching:** Cache post data for frequently accessed beliefs

### Post Context Integration Logic

```sql
-- Efficient post lookup query
SELECT
  p.id as post_id,
  p.title,
  SUBSTRING(p.content, 1, 200) as content_preview,
  p.created_at,
  p.opinion_belief_id
FROM posts p
WHERE p.opinion_belief_id IN (belief_ids_from_submissions)
```

**Mapping logic:**
- Create belief_id → post_context map
- Apply to each submission during formatting
- Null post_context indicates standalone protocol belief

### Error Handling

#### App Layer Errors
- User not found → Skip and continue processing
- Invalid user_id format → 422
- Missing avatar_url → Use null
- Post query failure → Continue without post_context

#### Protocol Layer Errors
- Protocol function unavailable → 503
- Protocol function timeout → 504
- Protocol function returns partial data → Continue with available data
- Agent data missing for user → Show user with empty submissions

#### Data Consistency
- User exists but agent missing → Include user with warning
- Agent exists but user missing → Skip (shouldn't happen)
- Belief exists but post deleted → Show belief without post_context

### Database Operations

**App database queries:**
- `users`: SELECT with filtering and pagination
- `posts`: SELECT by opinion_belief_id for context enrichment

**Protocol function calls:**
- `/protocol/users/get-activity`: Primary data source

### Response Enhancement

**Additional computed fields:**
- `participation_rate`: active_belief_count / total_system_beliefs
- `portfolio_diversity`: distribution metrics across belief types
- `recent_activity_count`: submissions in last 7 days

**Sorting options:**
- Most active (by belief_count)
- Most recent activity
- Highest stake
- Username alphabetical

### Caching Strategy

- **User profile data**: 5 minute cache
- **Post context data**: 15 minute cache (posts rarely change)
- **Protocol activity data**: 1 minute cache (more dynamic)

### Response Codes

- **200**: Success with complete data
- **206**: Partial success (some users missing data)
- **422**: Invalid input parameters
- **503**: Protocol function or database failure
- **504**: Request timeout

### Dashboard-Specific Features

- **User filtering by activity level**
- **Belief type categorization** (opinion vs protocol)
- **Portfolio value calculations**
- **Activity timeline generation**
- **User ranking and comparison metrics**