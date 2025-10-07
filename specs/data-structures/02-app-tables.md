# Application Data Structures

App-specific tables that handle content, users, and UI concerns.

## users
Application users mapped to protocol agents.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique user ID |
| agent_id | agent reference | Corresponding protocol agent |
| auth_provider | text | Authentication provider (always "privy") |
| auth_id | text | Privy user ID from JWT authentication |
| username | text | Unique username for display |
| display_name | text | Full display name |
| bio | text | User biography |
| avatar_url | text | Profile picture URL |
| total_stake | decimal | Cached stake from protocol |
| beliefs_created | integer | Count of beliefs created |
| beliefs_participated | integer | Count of beliefs participated in |
| created_at | timestamp | Account creation time |

**Authentication:**
- All authentication is handled by Privy (https://privy.io)
- Users are auto-registered on first login via `/api/auth/status`
- No Supabase Auth is used (Supabase is database-only)
- **Invite codes and waitlists are deprecated** (for now)

## posts
All posts must have associated belief markets. No multimedia support.

| Field | Type | Description |
|-------|------|-------------|
| id | unique identifier | Unique post ID |
| user_id | user reference | User who created the post |
| title | text | Post title/question (required, max 200 chars) |
| content | text | Post content providing context (optional, max 2000 chars) |
| belief_id | belief reference | Associated belief market (NOT NULL, CASCADE delete) |
| created_at | timestamp | Post creation time |

**Notes:**
- All posts require a belief_id (no standalone posts)
- No multimedia support (media_url/media_type removed)
- Default belief duration is 10 epochs (48h at 1 hour per epoch)

