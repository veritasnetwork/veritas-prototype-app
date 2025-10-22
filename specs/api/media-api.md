# Media API

## Overview
Endpoints for uploading and managing media files (images, videos, profile photos) to Supabase Storage.

## Context
- **Layer:** App
- **Auth:** Required (all endpoints)
- **Dependencies:** Supabase Storage, file validation utilities
- **Used By:** CreatePostModal, ImageUpload, VideoUpload, EditProfileModal

---

## Endpoints

### POST `/api/media/upload-image`

Upload image for post content.

**Auth:** Required (Privy JWT)

**Request:** `multipart/form-data`
```typescript
{
  file: File  // Image file (JPEG, PNG, GIF, WebP)
}
```

**Response (200):**
```typescript
{
  url: string,              // Public URL to uploaded image
  path: string,             // Storage path
  size: number,             // File size in bytes
  content_type: string      // MIME type
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | No file provided | `{error: "No file provided"}` |
| 400 | Invalid file type | `{error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP"}` |
| 400 | File too large | `{error: "File too large. Max 10MB"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 500 | Upload failed | `{error: "Failed to upload image"}` |

**Implementation:** `app/api/media/upload-image/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse multipart form data
3. Validate file exists
4. Validate file type (JPEG, PNG, GIF, WebP)
5. Validate file size <= 10MB
6. Generate unique filename: `images/{user_id}/{timestamp}_{uuid}.{ext}`
7. Upload to Supabase Storage bucket `post-images`
8. Get public URL
9. Return URL + metadata

**Validation Rules:**
- **File Type:** `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **Max Size:** 10MB (10,485,760 bytes)
- **Filename:** Sanitized, unique

**Edge Cases:**
- Duplicate filename → UUID prevents collision
- Upload interruption → Retry on client
- Corrupted file → Rejected at validation
- Storage quota exceeded → 507 Insufficient Storage

**Storage Path:**
```
post-images/
  {user_id}/
    {timestamp}_{uuid}.jpg
    {timestamp}_{uuid}.png
```

---

### POST `/api/media/upload-video`

Upload video for post content.

**Auth:** Required (Privy JWT)

**Request:** `multipart/form-data`
```typescript
{
  file: File  // Video file (MP4, WebM, MOV)
}
```

**Response (200):**
```typescript
{
  url: string,
  path: string,
  size: number,
  content_type: string,
  duration?: number         // Video duration in seconds (if available)
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | No file provided | `{error: "No file provided"}` |
| 400 | Invalid file type | `{error: "Invalid file type. Allowed: MP4, WebM, MOV"}` |
| 400 | File too large | `{error: "File too large. Max 100MB"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 500 | Upload failed | `{error: "Failed to upload video"}` |

**Implementation:** `app/api/media/upload-video/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse multipart form data
3. Validate file exists
4. Validate file type (MP4, WebM, MOV)
5. Validate file size <= 100MB
6. Generate unique filename: `videos/{user_id}/{timestamp}_{uuid}.{ext}`
7. Upload to Supabase Storage bucket `post-videos`
8. Get public URL
9. Return URL + metadata

**Validation Rules:**
- **File Type:** `video/mp4`, `video/webm`, `video/quicktime`
- **Max Size:** 100MB (104,857,600 bytes)
- **Filename:** Sanitized, unique

**Edge Cases:**
- Large file upload → Use chunked upload if supported
- Unsupported codec → Accept file, let player handle compatibility
- No video metadata → Skip duration field

**Storage Path:**
```
post-videos/
  {user_id}/
    {timestamp}_{uuid}.mp4
    {timestamp}_{uuid}.webm
```

---

### POST `/api/media/upload-profile-photo`

Upload profile photo/avatar.

**Auth:** Required (Privy JWT)

**Request:** `multipart/form-data`
```typescript
{
  file: File  // Image file (JPEG, PNG, WebP)
}
```

**Response (200):**
```typescript
{
  url: string,
  path: string,
  size: number,
  content_type: string
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | No file provided | `{error: "No file provided"}` |
| 400 | Invalid file type | `{error: "Invalid file type. Allowed: JPEG, PNG, WebP"}` |
| 400 | File too large | `{error: "File too large. Max 5MB"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 500 | Upload failed | `{error: "Failed to upload profile photo"}` |

**Implementation:** `app/api/media/upload-profile-photo/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse multipart form data
3. Validate file exists
4. Validate file type (JPEG, PNG, WebP)
5. Validate file size <= 5MB
6. Generate filename: `profile-photos/{user_id}/avatar_{timestamp}.{ext}`
7. Delete old avatar if exists (optional cleanup)
8. Upload to Supabase Storage bucket `profile-photos`
9. Get public URL
10. UPDATE users SET avatar_url = new_url
11. Return URL + metadata

**Validation Rules:**
- **File Type:** `image/jpeg`, `image/png`, `image/webp` (no GIF for profiles)
- **Max Size:** 5MB (5,242,880 bytes)
- **Filename:** Overwrites previous avatar

**Edge Cases:**
- First avatar → No previous file to delete
- Upload fails → Don't delete old avatar
- Update users table fails → Rollback upload (best effort)

**Storage Path:**
```
profile-photos/
  {user_id}/
    avatar_latest.jpg      // Always overwrites
```

---

### DELETE `/api/media/delete`

Delete media file from storage.

**Auth:** Required (Privy JWT)

**Request:**
```typescript
{
  path: string  // Storage path to delete (e.g., "post-images/user123/...")
}
```

**Response (200):**
```typescript
{
  success: boolean,
  path: string
}
```

**Errors:**
| Code | Condition | Response |
|------|-----------|----------|
| 400 | Missing path | `{error: "Path required"}` |
| 401 | No auth token | `{error: "Unauthorized"}` |
| 403 | Not owner | `{error: "Cannot delete another user's files"}` |
| 404 | File not found | `{error: "File not found"}` |
| 500 | Delete failed | `{error: "Failed to delete file"}` |

**Implementation:** `app/api/media/delete/route.ts`

**Flow:**
1. Validate auth token → Extract user_id
2. Parse request body
3. Extract user_id from path (e.g., `post-images/{user_id}/...`)
4. Verify requesting user owns the file
5. Delete from Supabase Storage
6. Return success

**Validation Rules:**
- `path`: Must start with allowed bucket prefix
- Ownership: Path must contain requesting user's user_id

**Edge Cases:**
- File already deleted → 404 (or return success)
- File in use by post → Don't prevent deletion (post will show broken image)
- Path traversal attempt → Reject with 403

**Security:**
- Only allow deletion of own files
- Validate path format to prevent directory traversal
- Check bucket whitelist (post-images, post-videos, profile-photos)

---

## Data Structures

### Storage Buckets (Supabase)
```
Bucket: post-images
  Path: {user_id}/{timestamp}_{uuid}.{ext}
  Max Size: 10MB
  Public: true

Bucket: post-videos
  Path: {user_id}/{timestamp}_{uuid}.{ext}
  Max Size: 100MB
  Public: true

Bucket: profile-photos
  Path: {user_id}/avatar_{timestamp}.{ext}
  Max Size: 5MB
  Public: true
```

### File Validation Config
```typescript
const FILE_LIMITS = {
  image: {
    maxSize: 10 * 1024 * 1024,  // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  },
  video: {
    maxSize: 100 * 1024 * 1024,  // 100MB
    allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime']
  },
  profilePhoto: {
    maxSize: 5 * 1024 * 1024,   // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
};
```

---

## Security Considerations

### Access Control
- All uploads require authentication
- Users can only delete their own files
- Path validation prevents directory traversal

### File Validation
- MIME type checked server-side
- File size enforced before upload
- Filename sanitization prevents injection

### Storage Policies (Supabase)
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id IN ('post-images', 'post-videos', 'profile-photos'));

-- Allow users to delete own files
CREATE POLICY "Users can delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('post-images', 'post-videos', 'profile-photos') AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## Testing

### Critical Paths
1. POST upload-image valid → returns URL
2. POST upload-image too large → 400
3. POST upload-image wrong type → 400
4. POST upload-video valid → returns URL
5. POST upload-profile-photo → updates user avatar
6. DELETE media own file → success
7. DELETE media other user → 403

### Test Implementation
- **Test Spec:** `specs/test-specs/api/media-api.test.md`
- **Test Code:** `tests/api/media.test.ts`

### Validation
- File size limits enforced
- File types validated correctly
- Uploaded files accessible via public URL
- Delete requires ownership
- No path traversal vulnerabilities

---

## References
- Code: `app/api/media/upload-image/route.ts`, `app/api/media/delete/route.ts`
- Components: `src/components/post/ImageUpload.tsx`, `src/components/post/VideoUpload.tsx`
- Storage: Supabase Storage documentation
- Related: `specs/api/posts-api.md`
