# Feed View Component Specification

## Purpose
Main scrollable feed displaying posts with infinite scroll, loading states, and create post FAB.

## Visual Design

### Layout
```
┌─────────────────────────────────────────────────┐
│ [Navigation Header - Sticky]                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Post Card 1                               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Post Card 2                               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ Post Card 3                               │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│                              [+ FAB] ───────────┼─┐
└─────────────────────────────────────────────────┘ │
                                                    │
                          Floating Action Button ───┘
```

### Container
- **Max-width**: 680px
- **Padding**: 24px horizontal (desktop), 16px (mobile)
- **Margin**: 0 auto (centered)
- **Background**: `var(--bg-primary)`
- **Min-height**: 100vh

### Post Grid
- **Display**: Flex column
- **Gap**: 16px between cards
- **Padding-top**: 24px (below sticky header)
- **Padding-bottom**: 100px (space for FAB)

## Components

### Post Cards
- Rendered via `<PostCard>` component
- Stagger animation on initial load (100ms delay per card)
- Fade-in on infinite scroll load

### Empty State
When no posts exist:
```
┌─────────────────────────────────────┐
│                                     │
│         [📭 Empty Icon]             │
│                                     │
│     No posts yet                    │
│     Be the first to share!          │
│                                     │
│     [Create Post Button]            │
│                                     │
└─────────────────────────────────────┘
```
- **Center**: Vertically and horizontally
- **Icon**: Large (48px), muted color
- **Text**: Title (20px bold) + Subtitle (16px secondary)
- **CTA**: Prominent create button

### Loading State (Initial)
- **Skeleton Cards**: 3-5 skeleton post cards
- **Animation**: Pulse effect
- **No spinner**: Use content-aware loading

### Loading State (Infinite Scroll)
- **Indicator**: Small spinner at bottom
- **Size**: 24px
- **Color**: `var(--text-secondary)`
- **Padding**: 40px vertical

### Error State
```
┌─────────────────────────────────────┐
│                                     │
│         [⚠️ Error Icon]             │
│                                     │
│     Failed to load posts            │
│     Please try again                │
│                                     │
│     [Retry Button]                  │
│                                     │
└─────────────────────────────────────┘
```

### Floating Action Button (FAB)
- **Position**: Fixed, bottom-right
- **Coordinates**:
  - Right: 24px (desktop), 16px (mobile)
  - Bottom: 24px (desktop), 16px (mobile)
- **Size**: 64x64px
- **Shape**: Circular (border-radius: 9999px)
- **Background**: `var(--accent-primary)` (#1db954)
- **Icon**: Plus (+) icon, 24px, white
- **Shadow**: `var(--shadow-lg)`
- **Hover**:
  - `transform: scale(1.05)`
  - `box-shadow: var(--shadow-xl)`
  - Background: `var(--accent-hover)`
- **Active**: `transform: scale(0.95)`
- **Z-index**: `var(--z-sticky)` (1100)

## Interactions

### Initial Load
1. Show skeleton cards (3-5)
2. Fetch posts from API
3. Stagger-animate cards in (fade + slide)
4. Remove skeleton cards

### Infinite Scroll
1. Detect scroll near bottom (threshold: 200px)
2. Show loading indicator
3. Fetch next page
4. Append new posts with fade-in
5. Remove loading indicator

### Pull to Refresh (Mobile)
1. User pulls down from top
2. Show refresh indicator
3. Fetch latest posts
4. Prepend new posts
5. Scroll to top smoothly

### FAB Click
1. Open create post modal (full-screen on mobile)
2. Disable scroll on body
3. Focus on title input

### Post Click
1. Navigate to `/post/{id}`
2. Smooth transition

## Data Flow

### Initial Fetch
```typescript
// GET /api/posts/feed
{
  limit: 20,
  offset: 0
}
```

### Infinite Scroll
```typescript
// GET /api/posts/feed
{
  limit: 20,
  offset: currentPosts.length
}
```

### Response Format
```typescript
{
  posts: PostCardData[];
  total: number;
  hasMore: boolean;
}
```

## States

### Empty (`posts.length === 0 && !loading`)
- Show empty state with CTA

### Loading (`loading && posts.length === 0`)
- Show skeleton cards

### Loaded (`!loading && posts.length > 0`)
- Show post cards

### Error (`error && posts.length === 0`)
- Show error state with retry button

### Loading More (`loading && posts.length > 0`)
- Show posts + loading indicator at bottom

## Responsive Behavior

### Desktop (>768px)
- Max-width container (680px)
- 24px padding
- Larger FAB (64px)
- Show 20 posts initially

### Mobile (<768px)
- Full-width with 16px padding
- Smaller FAB (56px)
- Show 10 posts initially
- Pull to refresh enabled

## Accessibility
- **Semantic**: `<main>` wrapper
- **Heading**: Screen-reader heading "Feed"
- **FAB**:
  - `aria-label="Create new post"`
  - Keyboard accessible (Tab + Enter)
- **Focus Management**: Trap focus in modal when FAB clicked
- **Scroll Restoration**: Maintain scroll position on back navigation

## Performance Optimizations
- **Virtualization**: Consider react-window for >100 posts
- **Image Lazy Loading**: Load post images only when in viewport
- **Debounce Scroll**: Debounce infinite scroll trigger (200ms)
- **Optimistic Updates**: When creating post, prepend immediately

## Implementation Notes
- Component: `<Feed />`
- Location: `src/components/feed/Feed.tsx`
- Page: `app/feed/page.tsx`
- Hooks:
  - `usePosts()` - Fetch and manage posts
  - `useInfiniteScroll()` - Handle infinite scroll
- Modal: `<CreatePostModal>` - Triggered by FAB

## Edge Cases
- **Slow Network**: Show extended loading state, avoid timeout
- **No Internet**: Show offline banner + cached posts
- **Stale Data**: Implement background refresh every 60s
- **Race Conditions**: Cancel in-flight requests on new fetch
- **Duplicate Posts**: De-duplicate by ID before rendering
