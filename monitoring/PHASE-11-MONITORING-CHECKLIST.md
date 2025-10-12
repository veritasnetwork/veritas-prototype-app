# Phase 11: Monitoring & Validation Checklist

**Status**: ✅ Ready for Testing
**Environment**: Development (Local)
**Date**: 2025-10-09

---

## Current Database State

### Schema Status
- ✅ **Old schema columns removed** (`title`, `content` dropped in Phase 6)
- ✅ **New schema columns added**:
  - `post_type` (text)
  - `content_json` (jsonb)
  - `media_urls` (text[])
  - `caption` (text, max 280 chars)
  - `content_text` (text, for search)

### Indexes
- ✅ `idx_posts_type` on `post_type`
- ✅ `idx_posts_content_text_search` (GIN) for full-text search
- ✅ Existing indexes maintained

### Constraints
- ✅ `posts_caption_length_check`: Caption max 280 characters

### Current Data
- **Total Posts**: 0
- **Posts with new schema**: 0
- **Posts pending migration**: 0

---

## Success Criteria (Development Environment)

### Post Creation
- [ ] Create at least 3 rich text posts
- [ ] Create at least 2 image posts with captions
- [ ] Create at least 2 video posts with captions
- [ ] Post creation success rate >95%

### Media Upload
- [ ] Successfully upload images (JPEG, PNG, GIF, WebP)
- [ ] Successfully upload videos (MP4, MOV, WebM)
- [ ] Image upload success rate >90%
- [ ] Video upload success rate >85%
- [ ] Files stored in Supabase Storage `veritas-media` bucket

### Display & Rendering
- [ ] Rich text posts render with formatting
- [ ] Image posts display with captions
- [ ] Video posts display with captions and controls
- [ ] Feed loads in <2s
- [ ] No broken images/videos

### Data Integrity
- [ ] All posts have `post_type` populated
- [ ] Text posts have `content_json` and `content_text`
- [ ] Image/video posts have `media_urls`
- [ ] Caption length constraint enforced (max 280 chars)
- [ ] No null/undefined errors in console

### Error Handling
- [ ] Graceful handling of upload failures
- [ ] Validation errors show user-friendly messages
- [ ] File size limits enforced (10MB images, 100MB videos)
- [ ] File type validation working
- [ ] No 500 errors in API routes

---

## Testing Scenarios

### 1. Rich Text Post Creation
**Steps**:
1. Open CreatePostModal
2. Select "Article" post type
3. Use Tiptap editor to add formatted text:
   - Bold text
   - Italic text
   - Bullet list
   - Numbered list
   - Blockquote
4. Set belief sliders
5. Submit post

**Expected**:
- Post created with `post_type='text'`
- `content_json` contains Tiptap JSON document
- `content_text` has plain text extracted
- Post displays correctly in feed

### 2. Image Post Creation
**Steps**:
1. Open CreatePostModal
2. Select "Image" post type
3. Upload image file (drag-and-drop or click)
4. Add caption (optional)
5. Set belief sliders
6. Submit post

**Expected**:
- Image uploaded to Supabase Storage
- Post created with `post_type='image'`
- `media_urls` array contains public URL
- `caption` stored if provided
- Image displays in feed with caption

### 3. Video Post Creation
**Steps**:
1. Open CreatePostModal
2. Select "Video" post type
3. Upload video file
4. Add caption (optional)
5. Set belief sliders
6. Submit post

**Expected**:
- Video uploaded to Supabase Storage
- Post created with `post_type='video'`
- `media_urls` array contains public URL
- `caption` stored if provided
- Video displays in feed with controls

### 4. Edge Cases

#### Caption Length Validation
- Try caption with 281 characters → Should show error
- Try caption with exactly 280 characters → Should succeed

#### File Type Validation
- Try uploading .txt file as image → Should show error
- Try uploading .mp3 file as video → Should show error

#### File Size Validation
- Try uploading 11MB image → Should show error
- Try uploading 101MB video → Should show error

#### Network Errors
- Simulate upload failure → Should show error message
- Retry upload → Should work

#### Empty Content
- Try submitting text post without content → Should show error
- Try submitting image post without file → Should show error

---

## Monitoring Queries

Run these queries from `monitoring/rich-media-metrics.sql`:

### Query 1: Total Posts by Type
```sql
SELECT
  post_type,
  COUNT(*) as total_posts,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM posts
GROUP BY post_type
ORDER BY total_posts DESC;
```

### Query 2: Posts with Complete Data
```sql
SELECT
  post_type,
  COUNT(*) as total,
  COUNT(CASE WHEN post_type = 'text' AND content_json IS NOT NULL THEN 1 END) as text_with_json,
  COUNT(CASE WHEN post_type IN ('image', 'video') AND media_urls IS NOT NULL THEN 1 END) as media_with_urls,
  COUNT(content_text) as with_extracted_text
FROM posts
WHERE post_type IS NOT NULL
GROUP BY post_type;
```

### Query 3: Media Upload Success
```sql
SELECT
  post_type,
  COUNT(*) as total,
  COUNT(media_urls) as with_media,
  ROUND(100.0 * COUNT(media_urls) / NULLIF(COUNT(*), 0), 2) as media_percentage
FROM posts
WHERE post_type IN ('image', 'video')
GROUP BY post_type;
```

### Query 4: Recent Activity
```sql
SELECT
  id,
  post_type,
  CASE
    WHEN post_type = 'text' THEN LEFT(content_text, 50)
    WHEN post_type IN ('image', 'video') THEN LEFT(caption, 50)
    ELSE NULL
  END as preview,
  created_at
FROM posts
ORDER BY created_at DESC
LIMIT 10;
```

---

## Metrics Dashboard (To Monitor)

### Post Creation Metrics
- **Total Posts**: Current = 0, Target = 7+
- **Text Posts**: Current = 0, Target = 3+
- **Image Posts**: Current = 0, Target = 2+
- **Video Posts**: Current = 0, Target = 2+

### Upload Success Rates
- **Image Uploads**: Target >90%
- **Video Uploads**: Target >85%

### Performance Metrics
- **Feed Load Time**: Target <2s
- **Post Creation Time**: Target <5s
- **Upload Time**:
  - Images: <3s
  - Videos: <10s

### Error Rates
- **Post Creation Errors**: Target <5%
- **Upload Errors**: Target <10%
- **Display Errors**: Target 0%

---

## Validation Commands

### Check Posts Table
```bash
docker exec supabase_db_veritas-prototype-app psql -U postgres -d postgres -c "\d posts"
```

### Count Posts by Type
```bash
docker exec supabase_db_veritas-prototype-app psql -U postgres -d postgres -c "SELECT post_type, COUNT(*) FROM posts GROUP BY post_type;"
```

### Check Storage Bucket
```bash
# Via Supabase Studio: http://localhost:54323
# Navigate to Storage > veritas-media
```

### View Recent Posts
```bash
docker exec supabase_db_veritas-prototype-app psql -U postgres -d postgres -c "SELECT id, post_type, created_at FROM posts ORDER BY created_at DESC LIMIT 5;"
```

---

## Next Steps

After completing testing and validation:

1. **If all tests pass**:
   - ✅ Mark Phase 11 as complete
   - ✅ Document any issues found and resolved
   - ✅ Prepare for Phase 12 (if applicable in production)

2. **If issues found**:
   - ⚠️ Document issues in detail
   - ⚠️ Fix issues and re-test
   - ⚠️ Update code/schema as needed

3. **For Production Rollout** (future):
   - Monitor metrics for 2-4 weeks
   - Ensure >95% success rates
   - Gather user feedback
   - Proceed to Phase 12 cleanup only after stable

---

## Notes

- Development environment is ready for testing
- All old schema columns already removed (Phase 6)
- Feature flags enabled in `.env.local`
- Dev server running at http://localhost:3001
- Supabase Studio available at http://localhost:54323

**Ready to start testing!** 🚀
