# Application Data Structures

App-specific tables that handle content, users, and UI concerns.

## users
Application users mapped to protocol agents.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique user ID |
| agent_id | uuid | NOT NULL, FOREIGN KEY → agents(id) CASCADE | Corresponding protocol agent |
| auth_provider | text | | Authentication provider (always "privy") |
| auth_id | text | | Privy user ID from JWT authentication |
| username | text | NOT NULL, UNIQUE, CHECK length 2-50 | Unique username for display |
| display_name | text | NOT NULL | Full display name |
| bio | text | | User biography |
| avatar_url | text | | Profile picture URL |
| beliefs_created | integer | NOT NULL, DEFAULT 0 | Count of beliefs created |
| beliefs_participated | integer | NOT NULL, DEFAULT 0 | Count of beliefs participated in |
| created_at | timestamptz | DEFAULT now() | Account creation time |
| updated_at | timestamptz | DEFAULT now() | Last update timestamp |

**Indexes:**
- `users_pkey` (PRIMARY KEY on id)
- `users_username_key` (UNIQUE on username)
- `users_auth_credentials_unique` (UNIQUE on auth_provider, auth_id)
- `idx_users_agent_id` (on agent_id)
- `idx_users_username` (on username)
- `idx_users_auth_credentials` (on auth_provider, auth_id WHERE both NOT NULL)

**Check Constraints:**
- `users_username_length` - char_length(username) >= 2 AND char_length(username) <= 50

**Referenced By:**
- custodian_withdrawals.requested_by_user_id
- posts.user_id
- trades.user_id
- user_pool_balances.user_id

**Authentication:**
- All authentication is handled by Privy (https://privy.io)
- Users are auto-registered on first login via `/api/auth/status`
- No Supabase Auth is used (Supabase is database-only)
- **Invite codes and waitlists are deprecated** (for now)

## posts
All posts must have associated belief markets. Supports rich text, images, and videos.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | uuid | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique post ID |
| user_id | uuid | NOT NULL, FOREIGN KEY → users(id) CASCADE | User who created the post |
| belief_id | uuid | NOT NULL, FOREIGN KEY → beliefs(id) CASCADE | Associated belief market |
| created_at | timestamptz | DEFAULT now() | Post creation time |
| post_type | text | | Post type (currently unused) |
| content_json | jsonb | | Rich text content in JSON format (Tiptap) |
| media_urls | text[] | | Array of media URLs (images/videos) |
| caption | text | CHECK length <= 280 | Short caption for media posts |
| content_text | text | | Plain text extracted from content_json (for search) |
| article_title | text | CHECK length 1-200 | Article title (required if cover_image_url set) |
| cover_image_url | text | | Cover image URL for article posts |
| total_volume_usdc | numeric(20,6) | DEFAULT 0 | Total trading volume (micro-USDC) |
| image_display_mode | text | DEFAULT 'contain', CHECK | Image display: 'contain' or 'cover' |

**Indexes:**
- `posts_pkey` (PRIMARY KEY on id)
- `idx_posts_user_id` (on user_id)
- `idx_posts_belief_id` (on belief_id)
- `idx_posts_created_at` (on created_at DESC)
- `idx_posts_created_at_desc` (on created_at DESC)
- `idx_posts_user_created` (on user_id, created_at DESC)
- `idx_posts_belief_created` (on belief_id, created_at DESC WHERE belief_id IS NOT NULL)
- `idx_posts_type` (on post_type)
- `idx_posts_total_volume` (on total_volume_usdc DESC)
- `idx_posts_content_text_search` (GIN on to_tsvector('english', COALESCE(content_text, '')))
- `idx_posts_article_title_search` (GIN on to_tsvector('english', COALESCE(article_title, '')))

**Check Constraints:**
- `posts_caption_length_check` - caption IS NULL OR char_length(caption) <= 280
- `posts_article_title_length` - article_title IS NULL OR (char_length >= 1 AND char_length <= 200)
- `posts_cover_requires_title` - cover_image_url IS NULL OR article_title IS NOT NULL
- `posts_image_display_mode_check` - image_display_mode IN ('contain', 'cover')

**Referenced By:**
- belief_relevance_history.post_id
- pool_deployments.post_id
- settlements.post_id
- trades.post_id
- user_pool_balances.post_id

**Notes:**
- All posts require a belief_id (no standalone posts)
- Rich text content stored as JSON in content_json (Tiptap format)
- Supports multimedia: images and videos via media_urls array
- Full-text search enabled on content_text and article_title
- total_volume_usdc updated via database trigger on trades

## Storage Buckets

### profile-photos
Supabase Storage bucket for user profile photos.

| Property | Value |
|----------|-------|
| Bucket ID | `profile-photos` |
| Public Access | Yes (read-only) |
| Upload Policy | Authenticated users only |
| File Types | Images (JPEG, PNG, WebP, etc.) |
| Max File Size | Configured in Supabase project settings |

**Policies:**
- **Upload**: Authenticated users can upload profile photos
- **Update**: Authenticated users can update their profile photos
- **Delete**: Authenticated users can delete their profile photos
- **Read**: Public can view all profile photos (for display in feeds, profiles, etc.)

**Relationship to users table:**
- `users.avatar_url` stores the full Supabase Storage URL
- Format: `https://{project}.supabase.co/storage/v1/object/public/profile-photos/{filename}`

**Upload API:**
- Route: `/api/media/upload-profile-photo`
- Handles file validation, upload to storage, and updates `users.avatar_url`

### media
Supabase Storage bucket for post media (images and videos).

| Property | Value |
|----------|-------|
| Bucket ID | `media` |
| Public Access | Yes (read-only) |
| Upload Policy | Authenticated users only |
| File Types | Images (JPEG, PNG, WebP) and Videos (MP4, WebM) |
| Max File Size | Configured in Supabase project settings |

**Policies:**
- **Upload**: Authenticated users can upload media files
- **Update**: Users can update their own media
- **Delete**: Users can delete their own media
- **Read**: Public can view all media (for display in feeds, posts, etc.)

**Relationship to posts table:**
- `posts.media_urls` stores array of Supabase Storage URLs
- `posts.cover_image_url` stores cover image URL for articles
- Format: `https://{project}.supabase.co/storage/v1/object/public/media/{filename}`

**Upload API:**
- Route: `/api/media/upload`
- Handles file validation, upload to storage, returns signed URL

---

**Last Updated:** October 25, 2025
**Status:** Current schema after all migrations applied
