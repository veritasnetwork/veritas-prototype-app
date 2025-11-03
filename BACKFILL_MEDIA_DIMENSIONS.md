# Backfill Media Dimensions for Production

This guide explains how to backfill aspect ratio data for existing media posts in production.

## Why This Is Needed

The new aspect ratio system requires `media_width`, `media_height`, and `aspect_ratio` fields. Existing posts don't have these values, so they'll fall back to 16:9 (which works, but isn't optimal).

## Option 1: Simple SQL Update (Fastest)

If you're okay with all existing posts using a default aspect ratio:

```sql
-- Set all existing image/video posts without aspect_ratio to 16:9 default
UPDATE posts
SET
  media_width = 1920,
  media_height = 1080,
  aspect_ratio = 1.7778
WHERE
  post_type IN ('image', 'video')
  AND media_urls IS NOT NULL
  AND aspect_ratio IS NULL;
```

**Pros:** Instant, no code execution needed
**Cons:** Not accurate to actual media dimensions

## Option 2: Automated Backfill Script (Recommended)

Run the backfill script to fetch actual dimensions from each media file:

### Prerequisites

```bash
npm install --save-dev image-size @types/image-size
```

### Local Test (against local Supabase)

```bash
# Make sure local Supabase is running
npx supabase start

# Run the script
npx tsx scripts/backfill-media-dimensions.ts
```

### Production Run

```bash
# Set production environment variables
export NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Run the script
npx tsx scripts/backfill-media-dimensions.ts
```

**Important Notes:**
- The script only handles images currently (videos are skipped)
- Processes ~10 posts per second to avoid rate limits
- Safe to run multiple times (idempotent)
- Can be stopped and resumed (only processes posts without aspect_ratio)

### Expected Output

```
🔍 Fetching posts with media but no aspect ratio...

Found 42 posts to process

[1/42] Processing post abc123...
  ✅ Updated: 1920x1080 (1.78)
[2/42] Processing post def456...
  ✅ Updated: 1080x1920 (0.56)
...

📊 Summary:
  ✅ Success: 40
  ⚠️  Skipped: 1
  ❌ Errors: 1
  📝 Total: 42
```

## Option 3: Gradual Client-Side Update

If you prefer not to run a migration script, the system will automatically extract dimensions on the frontend when posts are viewed:

1. User views a post without aspect_ratio
2. Browser calculates dimensions from loaded media
3. Next time the media is uploaded/edited, dimensions are saved

**Pros:** No manual intervention needed
**Cons:** Slower, requires client-side calculation each time

## Recommended Approach

For production with existing posts:

1. **Apply database migration first:**
   ```bash
   # Apply the migration that adds the new columns
   npx supabase db push
   ```

2. **Choose backfill strategy:**
   - If you have < 100 posts: Run Option 2 (backfill script)
   - If you have 100-1000 posts: Run Option 1 (SQL default) then gradually improve with Option 3
   - If you have > 1000 posts: Run Option 1 (SQL default) and skip backfill

## Troubleshooting

**"Missing environment variables"**
- Make sure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Service role key is found in Supabase Dashboard → Settings → API

**"Failed to extract dimensions"**
- Check that media URLs are publicly accessible
- Verify CORS settings allow fetching from your domain
- Some media types may not be supported (e.g., GIFs, certain video codecs)

**"Rate limit errors"**
- The script includes 100ms delays between requests
- If needed, increase delay in the script (line 119)
- Run during off-peak hours

## Rollback

If something goes wrong, you can clear the backfilled data:

```sql
UPDATE posts
SET
  media_width = NULL,
  media_height = NULL,
  aspect_ratio = NULL
WHERE aspect_ratio IS NOT NULL;
```

Posts will fall back to 16:9 default behavior.
