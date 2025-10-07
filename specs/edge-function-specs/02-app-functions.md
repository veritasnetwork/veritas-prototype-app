# App Edge Functions

App-layer operations that orchestrate protocol calls with content management, user experience, and UI concerns.

## Authentication

**Current Implementation:** Privy-based auto-registration

All authentication flows through Privy:
1. User authenticates with Privy (email, Apple, wallet)
2. Privy issues JWT token
3. Frontend calls `/api/auth/status` with Privy JWT
4. Backend verifies JWT against Privy's JWKS endpoint
5. If user doesn't exist, auto-creates user + agent with $0 initial stake
6. Returns `has_access: true` with user data

**No Supabase Auth:** Supabase is used as database-only. All auth is Privy.

**Deprecated (for now):**
- `/app/users/create` - No longer needed (auto-registration on first login)
- `/app/auth/activate-invite` - Invite codes deprecated
- `/app/auth/waitlist` - Waitlists deprecated

## /app/post-creation

**Current Implementation:** `/supabase/functions/app-post-creation`

Creates a post with associated belief market. **All posts require beliefs** (no standalone posts).

**Request Parameters:**
- `user_id`: App user identifier
- `title`: Post title/question (required, max 200 chars)
- `content`: Post content providing context (optional, max 2000 chars)
- `belief_duration_epochs`: How many epochs the belief market runs (default: 10 = 48h)

**Response:**
- `post_id`: Created post identifier
- `belief_id`: Associated belief market identifier
- `post`: Full post object with belief data for UI

**Process:**
1. Get user's agent_id from users table
2. Call `/protocol/beliefs/create` with agent_id and belief parameters
3. Create post record with `belief_id` (NOT NULL)
4. Return combined post and belief data

**Notes:**
- No multimedia support (media_url/media_type removed)
- Default belief duration: 10 epochs (48 hours at 1 hour/epoch)
- Posts and beliefs CASCADE delete together

## /app/posts/submit-opinion

Submits user's opinion to an existing belief market.

**Request Parameters:**
- `user_id`: User submitting opinion
- `post_id`: Post with belief market
- `belief_value`: User's probability assessment (0-1)
- `meta_prediction`: User's prediction of average belief (0-1)

**Response:**
- `success`: Whether submission was accepted
- `submission_id`: Protocol submission identifier

**Process:**
1. Get user's agent_id and post's opinion_belief_id
2. Call `/protocol/beliefs/submit` with protocol parameters
3. Return success status

## /app/posts/get-feed

Retrieves posts for user's feed with belief aggregate data.

**Request Parameters:**
- `user_id`: Which user's feed
- `limit`: Number of posts to return
- `offset`: For pagination

**Response:**
- `posts`: Array of post objects with belief aggregate for opinion posts
- `total_count`: Total posts available

**Process:**
1. Query posts from app database with user data
2. For opinion posts, join with protocol beliefs table to get previous_aggregate
3. Return feed data optimized for UI display

## /app/tags/apply

Applies a tag to a post and creates belief market for relevance.

**Request Parameters:**
- `user_id`: User applying the tag
- `post_id`: Which post to tag
- `tag_name`: Tag to apply

**Response:**
- `tag_belief_id`: Belief market for tag relevance
- `success`: Whether tag was applied

**Process:**
1. Find or create tag in tags table
2. Get user's agent_id
3. Call `/protocol/beliefs/create` for tag relevance belief
4. Create post_tags record linking post, tag, and belief market
5. Return belief market details

## /app/tags/submit-relevance

Submit belief about tag relevance to a post.

**Request Parameters:**
- `user_id`: User submitting relevance opinion
- `post_id`: Which post
- `tag_id`: Which tag
- `belief_value`: Relevance probability (0-1)
- `meta_prediction`: Predicted average relevance (0-1)

**Response:**
- `success`: Whether submission was accepted

**Process:**
1. Get user's agent_id and tag_belief_id from post_tags
2. Call `/protocol/beliefs/submit` with protocol parameters
3. Return success status

## Dashboard Functions

### /app/dashboard/users-get-activity

Provides user-centric dashboard view with complete belief participation history and app context integration.

**Request Parameters:**
- `user_ids`: Optional array of user identifiers to filter
- `limit`: Number of users to return (default 20, max 50)
- `offset`: For pagination

**Response:**
- `users`: Array of user objects with complete activity data
- `total_count`: Total users matching criteria

**Process:**
1. Query users table with optional filtering and pagination
2. Call `/protocol-indexer/users/get-activity` with corresponding agent_ids
3. Enrich protocol data with post context for opinion beliefs
4. Format response for dashboard UI consumption
5. Return user-centric activity data with both protocol and app context

