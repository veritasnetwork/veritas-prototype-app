# Posts Simplification Refactor
*Date: January 18, 2025*

## Overview
Major refactor to simplify the post system by removing post types, multimedia support, and standardizing all posts to have beliefs attached.

## Key Changes

### 1. Database Schema
- **Renamed**: `opinion_belief_id` → `belief_id` in posts table
- **Removed**: `media_urls` column from posts table
- **Removed**: `type` column from posts table (no more post types)
- **Updated**: Default belief duration from 5 epochs (24h) to 10 epochs (48h)
- **Migration**: `20250118_refactor_posts_beliefs_only.sql`

### 2. Backend/API
- **Renamed**: Edge function `app-post-creation-with-opinion` → `app-post-creation`
- **Updated**: All edge functions to use `belief_id` instead of `opinion_belief_id`
- **Removed**: Media/multimedia handling from all endpoints
- **Changed**: Default duration from 5 to 10 epochs in post creation
- **Simplified**: All posts now require beliefs (no conditional logic)

### 3. Frontend
- **Types**:
  - Removed `PostType` enum
  - Renamed `OpinionData` → `BeliefData`
  - Renamed `OpinionHistoryPoint` → `BeliefHistoryPoint`
  - Made `belief` required in `Post` interface

- **Components**:
  - Renamed `OpinionIndicator` → `BeliefIndicator`
  - Renamed `OpinionSubmission` → `BeliefSubmission`
  - Updated all "opinion" text to "post" or "belief"

- **Services**:
  - Removed type-based branching logic
  - All posts now include belief data
  - Removed thumbnail/media extraction

### 4. Constants
- Removed `POST_TYPES` enum
- Added `DEFAULT_DURATION_EPOCHS: 10`
- Renamed `OPINION_*` → `BELIEF_*` constants

## Impact

### Before
- Multiple post types (text, image, video, longform, opinion)
- Only "opinion" posts had beliefs attached
- Support for media URLs and thumbnails
- 24h default duration for beliefs
- Complex conditional logic throughout codebase

### After
- Single post type (all posts have beliefs)
- No multimedia support (text only)
- 48h default duration for beliefs
- Simplified, cleaner codebase
- Consistent naming (belief instead of opinion)

## Benefits
1. **Simplicity**: Removed unnecessary complexity
2. **Consistency**: All posts work the same way
3. **Maintainability**: Less conditional logic to maintain
4. **Focus**: Clear focus on belief markets as core feature
5. **Performance**: Smaller payload sizes without media URLs

## Migration Guide
For existing code that depends on the old structure:
- Replace `opinion_belief_id` with `belief_id`
- Remove any `media_urls` handling
- Remove post type checks
- Update duration expectations from 5 to 10 epochs
- Update component imports from Opinion* to Belief*

## Testing
All core functionality has been preserved:
- Post creation with beliefs ✅
- Belief submission ✅
- Feed display ✅
- Dashboard functionality ✅

## Future Considerations
- Tag system (Phase 5) will work with all posts
- No need to differentiate post types in future features
- Cleaner API for mobile apps or third-party integrations