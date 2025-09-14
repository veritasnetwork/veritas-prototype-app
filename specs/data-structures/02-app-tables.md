# Application Data Structures

App-specific tables that handle content, users, and UI concerns.

## users
Application users mapped to protocol agents.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique user ID |
| agent_id | agent reference | Corresponding protocol agent |
| auth_provider | text | Authentication provider (reserved for future auth, nullable) |
| auth_id | text | ID from auth provider (reserved for future auth, nullable) |
| username | text | Unique username for display |
| display_name | text | Full display name |
| bio | text | User biography |
| avatar_url | text | Profile picture URL |
| total_stake | decimal | Cached stake from protocol |
| beliefs_created | integer | Count of beliefs created |
| beliefs_participated | integer | Count of beliefs participated in |
| created_at | timestamp | Account creation time |

## posts
Content that may have associated belief markets.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique post ID |
| user_id | user reference | User who created the post |
| title | text | Post title (max MAX_TITLE_LENGTH chars, required for opinion posts) |
| content | text | Post content (max MAX_CONTENT_LENGTH chars, at least one of title/content required) |
| media_url | text | Optional URL to media file (image/video) |
| media_type | text | MIME type of media (if media_url present) |
| is_opinion | boolean | Whether this post has an associated belief market |
| opinion_belief_id | belief reference | Associated belief market (null if not opinion) |
| view_count | integer | Number of views |
| created_at | timestamp | Post creation time |


## tags
Belief-signal tags that can be applied to posts.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique tag ID |
| name | text | Tag name (unique) |
| description | text | Optional description of what this tag represents |
| created_at | timestamp | When tag was created |

## post_tags
Links posts to tags with belief markets for relevance signals.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique post-tag link ID |
| post_id | post reference | Which post |
| tag_id | tag reference | Which tag |
| tag_belief_id | belief reference | Protocol belief market for relevance to this tag |
| created_at | timestamp | When tag was applied to post |

**Constraints:**
- No duplicate tags per post (same tag can't be applied twice to same post)
- Each post-tag combination gets its own belief market

