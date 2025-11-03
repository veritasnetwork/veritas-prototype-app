# Media Aspect Ratio Refactor - Planning Document

## Overview
Refactor media display to use automatic aspect-ratio detection instead of forced containers with manual "Fit" vs "Full Image" toggles. This creates a cleaner, more modern feed experience that respects content's natural proportions.

## Goals
1. Remove manual "Fit"/"Full Image" toggle from post creation UI
2. Auto-detect media aspect ratios and display optimally
3. Maintain consistent feed width while allowing variable height
4. Add automatic black bars only for extreme aspect ratios
5. Create clean, Pinterest/Instagram-like feed aesthetic

## Current Behavior
- All media forced into standard aspect ratio container (likely 16:9 or similar)
- User manually chooses "Fit" (cropped/zoomed) or "Full Image" (black bars)
- Same display logic on mobile and desktop
- No differentiation between vertical/horizontal content

## New Behavior

### Normal Range (1.78:1 to 0.56:1)
- **16:9 landscape** → Display at native 16:9 (shorter card)
- **4:3 standard** → Display at native 4:3
- **1:1 square** → Display at native 1:1
- **3:4 portrait** → Display at native 3:4
- **9:16 vertical** → Display at native 9:16 (taller card)

### Extreme Cases
- **Ultra-wide (>16:9)**: Letterbox with black bars top/bottom
- **Ultra-tall (>9:16)**: Pillarbox with black bars left/right
- Container max constraints prevent viewport-breaking sizes

## Technical Approach

### Detection Logic
```typescript
function getMediaDisplayMode(width: number, height: number) {
  const aspectRatio = width / height;

  if (aspectRatio > 16/9) {
    return 'letterbox'; // Ultra-wide
  } else if (aspectRatio < 9/16) {
    return 'pillarbox'; // Ultra-tall
  } else {
    return 'native'; // Normal range
  }
}
```

### CSS Strategy
```css
/* Feed container maintains consistent width */
.post-media-container {
  width: 100%;
  max-height: 90vh; /* Safety constraint */
  background: black; /* For extreme cases */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Native display for normal aspect ratios */
.post-media-container.native img,
.post-media-container.native video {
  width: 100%;
  height: auto;
  object-fit: cover;
}

/* Contain with black bars for extremes */
.post-media-container.letterbox img,
.post-media-container.letterbox video,
.post-media-container.pillarbox img,
.post-media-container.pillarbox video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
```

## Implementation Checklist

### 1. Post Creation UI Cleanup
**Files to modify:**
- `src/components/post/CreatePostModal.tsx` - Remove fit/full toggle UI
- Remove any related state management for the toggle

**Changes:**
- Delete the "Fit"/"Full Image" button group
- Remove `mediaDisplayMode` or similar state
- Simplify media preview to always show natural aspect

### 2. Media Display Components
**Files to modify:**
- Find main media display component (likely in `src/components/post/`)
- Could be `PostCard.tsx`, `MediaDisplay.tsx`, or similar

**Changes:**
- Add aspect ratio detection on media load
- Apply CSS classes based on detection (`native`, `letterbox`, `pillarbox`)
- Remove any forced aspect-ratio containers

### 3. Database Schema (if needed)
**Check:**
- Do we store `mediaDisplayMode` in `posts` table?
- If yes, we can ignore it (backward compatible) or migrate/remove

### 4. Styles Update
**Files to modify:**
- Component-level styles or global CSS
- TailwindCSS classes if used

**Changes:**
- Add container styles for three display modes
- Set max-height constraints
- Ensure proper centering and black bar rendering

### 5. Testing Scenarios
- [ ] 16:9 landscape video (YouTube-like)
- [ ] 9:16 portrait video (TikTok/Reels-like)
- [ ] 1:1 square image (Instagram-like)
- [ ] 21:9 ultra-wide panorama (should letterbox)
- [ ] Screenshot of full webpage (ultra-tall, should pillarbox)
- [ ] Mixed aspect ratios in feed (should align width, vary height)
- [ ] Mobile vs desktop rendering
- [ ] Multiple media in carousel (if applicable)

## Edge Cases & Solutions

### Edge Case 1: Ultra-wide Panoramas
**Problem:** 21:9 or wider creates tiny horizontal strips
**Solution:** Letterbox with max-height constraint and black bars

### Edge Case 2: Super Tall Screenshots
**Problem:** 9:21 or taller dominates viewport
**Solution:** Pillarbox or max-height: 90vh cap

### Edge Case 3: Carousel Posts
**Problem:** Different aspect ratios cause jarring height changes when swiping
**Solution:** Either normalize all to first image's ratio OR ensure smooth transitions

### Edge Case 4: Loading States
**Problem:** Don't know aspect ratio until media loads
**Solution:** Use skeleton/placeholder, detect on `onLoad` event

### Edge Case 5: Existing Posts
**Problem:** Old posts may have stored `mediaDisplayMode` preference
**Solution:** Ignore old preference, always use new auto-detection

## Files to Investigate

1. **Post Creation:**
   - `src/components/post/CreatePostModal.tsx`
   - Any media upload/preview components

2. **Post Display:**
   - `src/components/post/PostCard.tsx`
   - `src/components/post/PostMedia.tsx` (if exists)
   - `src/components/feed/` (any feed-related media rendering)

3. **Database:**
   - `/supabase/migrations/` - Check if `posts` table has `media_display_mode` or similar
   - `src/types/` - TypeScript interfaces for Post type

4. **Styles:**
   - Component CSS modules
   - Global TailwindCSS config
   - Any media-specific style files

## Success Criteria

✅ No more "Fit"/"Full Image" toggle in post creation UI
✅ Feed has consistent width alignment for all posts
✅ Card heights vary naturally based on media aspect ratio
✅ Vertical content (9:16) displays tall without black bars
✅ Horizontal content (16:9) displays wide without cropping
✅ Extreme aspect ratios (>16:9 or >9:16) auto-add black bars
✅ Works smoothly on both mobile and desktop
✅ No layout breaks or viewport-dominating media
✅ Existing posts render correctly with new logic

## Rollout Plan

1. **Phase 1: Investigation** - Find all relevant files and understand current implementation
2. **Phase 2: Display Logic** - Implement new aspect ratio detection and CSS
3. **Phase 3: UI Cleanup** - Remove toggle from CreatePostModal
4. **Phase 4: Testing** - Test with various aspect ratios and viewports
5. **Phase 5: Refinement** - Adjust max-height/constraints based on testing

---

**Created:** 2025-11-03
**Status:** Planning
