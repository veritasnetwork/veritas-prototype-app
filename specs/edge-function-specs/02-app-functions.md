# App Edge Functions

App-layer operations that orchestrate protocol calls with content management, user experience, and UI concerns.

## /app/users/create

Creates a new user and associated protocol agent.

**Request Parameters:**
- `username`: Unique username for display
- `display_name`: Optional full display name (defaults to username)
- `auth_provider`: Optional authentication provider (e.g., "google", "github")
- `auth_id`: Optional ID from auth provider

**Response:**
- `user_id`: Created user identifier
- `agent_id`: Associated protocol agent identifier
- `user`: Full user object

**Process:**
1. Validate username uniqueness
2. Create protocol agent with initial stake from system_config
3. Create user record with agent_id reference
4. Return user data with agent_id

## /app/posts/create

Creates a regular post without belief market.

**Request Parameters:**
- `user_id`: App user identifier
- `title`: Optional post title
- `content`: Post content
- `media_url`: Optional media attachment
- `media_type`: MIME type if media present

**Response:**
- `post_id`: Created post identifier
- `post`: Full post object for UI display

**Process:**
1. Validate user exists
2. Create post record in app database
3. Return post data for UI

## /app/posts/create-with-opinion

Creates a post and associated belief market for opinion.

**Request Parameters:**
- `user_id`: App user identifier
- `title`: Optional post title
- `content`: Post content
- `media_url`: Optional media attachment
- `media_type`: MIME type if media present
- `initial_belief`: Creator's initial probability (0-1)
- `belief_duration_epochs`: How many epochs the belief market runs

**Response:**
- `post_id`: Created post identifier
- `belief_id`: Associated belief market identifier
- `post`: Full post object with belief data for UI

**Process:**
1. Get user's agent_id from users table
2. Call `/protocol/beliefs/create` with agent_id and belief parameters
3. Create post record with `is_opinion = true` and `opinion_belief_id`
4. Return combined post and belief data

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

Retrieves posts for user's feed with belief market data.

**Request Parameters:**
- `user_id`: Which user's feed
- `limit`: Number of posts to return
- `offset`: For pagination

**Response:**
- `posts`: Array of post objects with embedded belief data
- `total_count`: Total posts available

**Process:**
1. Query posts from app database
2. For opinion posts, enrich with belief market data from protocol
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

