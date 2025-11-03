# Media Aspect Ratio Refactor

## Goals
1. Remove "Fit"/"Full Image" toggle from post creation UI
2. Auto-detect media aspect ratios and display at native ratio
3. Maintain consistent feed width, variable height
4. Auto-add black bars only for extreme aspect ratios (>16:9 or >9:16)

## Detection Logic
```typescript
function getMediaDisplayMode(width: number, height: number) {
  const aspectRatio = width / height;
  if (aspectRatio > 16/9) return 'letterbox';
  if (aspectRatio < 9/16) return 'pillarbox';
  return 'native';
}
```

## Implementation Steps

### 1. Investigate Current Implementation
- Find media display components in `src/components/post/`
- Check `posts` table schema for aspect ratio fields
- Locate "Fit"/"Full Image" toggle in CreatePostModal
- Check API endpoints for media metadata

### 2. Add Aspect Ratio Storage (if needed)
- Add `media_width`, `media_height`, `aspect_ratio` columns to `posts` table if missing
- Update TypeScript types

### 3. Create Dimension Extraction Utility
```typescript
// src/lib/utils/media.ts
export async function getMediaDimensions(file: File): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
}> {
  // Implementation for images and videos
}

export function getMediaDisplayMode(aspectRatio: number): 'native' | 'letterbox' | 'pillarbox' {
  if (aspectRatio > 16/9) return 'letterbox';
  if (aspectRatio < 9/16) return 'pillarbox';
  return 'native';
}
```

### 4. Update Upload Flow
- Extract dimensions in CreatePostModal when media selected
- Store dimensions in API on post creation
- Handle missing dimensions with 16:9 fallback

### 5. Create MediaContainer Component
```typescript
// src/components/post/MediaContainer.tsx
interface MediaContainerProps {
  aspectRatio: number;
  children: React.ReactNode;
  className?: string;
}

export function MediaContainer({ aspectRatio, children, className }: MediaContainerProps) {
  const displayMode = getMediaDisplayMode(aspectRatio);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const maxHeight = isMobile ? '85vh' : '90vh';

  return (
    <div
      className={`media-container ${displayMode} ${className}`}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
}
```

**Styles:**
```css
.media-container {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-container.letterbox,
.media-container.pillarbox {
  background: black;
}

.media-container.native img,
.media-container.native video {
  width: 100%;
  height: auto;
}

.media-container.letterbox img,
.media-container.letterbox video,
.media-container.pillarbox img,
.media-container.pillarbox video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
```

### 6. Update PostCard to Use MediaContainer
- Replace existing media rendering with MediaContainer
- Pass aspect ratio from post data
- Fallback to calculating on the fly if missing

### 7. Remove Toggle from CreatePostModal
- Delete "Fit"/"Full Image" button group
- Remove related state variables
- Use MediaContainer for preview

### 8. Mobile Optimization
- Use 85vh max-height on mobile
- Ensure no conflicts with pull-to-refresh
- Test on iOS Safari

### 9. Handle Existing Posts
- Calculate aspect ratio on render if missing from DB
- Default to 16:9 if calculation fails

### 10. Testing
- Test 16:9, 9:16, 1:1, 4:3, 3:4 aspect ratios
- Test ultra-wide (>16:9) and ultra-tall (>9:16) for letterbox/pillarbox
- Test on desktop and mobile
- Test mixed aspect ratios in feed
