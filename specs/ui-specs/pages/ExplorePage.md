# Explore Page Specification

## Overview
The Explore page provides a grid-based visual browsing experience for discovering content posts. Unlike the Feed (vertical timeline), Explore emphasizes visual discovery through a responsive grid layout with compact post cards.

## Route
- **Path**: `/explore`
- **Component**: `src/components/explore/Explore.tsx`
- **Page**: `app/explore/page.tsx`

## Purpose
- Visual content discovery and browsing
- Grid-based layout optimized for scanning many posts quickly
- Complementary to Feed's detailed, chronological view
- Future: Can add sorting/filtering (hot, trending, new)

## Layout

### Responsive Grid
```
Desktop (≥1024px):  4 columns
Tablet (≥768px):    2 columns
Mobile (<768px):    1 column
```

### Structure
```
┌─────────────────────────────────────────────┐
│  Sidebar (desktop only)                     │
├─────────────────────────────────────────────┤
│  Main Content Area                          │
│  ┌──────────────────────────────────────┐   │
│  │  Grid of Compact Post Cards          │   │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │   │
│  │  │    │ │    │ │    │ │    │        │   │
│  │  └────┘ └────┘ └────┘ └────┘        │   │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐        │   │
│  │  │    │ │    │ │    │ │    │        │   │
│  │  └────┘ └────┘ └────┘ └────┘        │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## Data Source
- **API**: Reuses existing `app-post-get-feed` edge function
- **Hook**: `usePosts()` from `src/hooks/api/usePosts.ts`
- **Same data as Feed** - only presentation differs

## Components Used

### Main Component
- `Explore.tsx` - Container with grid layout
- Reuses: `Sidebar`, `NavigationHeader`, `MobileNav`

### Post Display
- `CompactPostCard.tsx` - Grid-optimized card
- Smaller, more visual-focused than Feed's PostCard
- Click-through to post detail page

## Features

### Current (MVP)
- ✅ Grid layout of all posts
- ✅ Compact post cards with images
- ✅ Pool reserve display
- ✅ Click to navigate to post detail
- ✅ Loading states
- ✅ Error states
- ✅ Responsive design

### Future Enhancements
- 🔮 Sorting options (hot/trending/new/top)
- 🔮 Filtering by pool size range
- 🔮 Search within explore
- 🔮 Infinite scroll pagination
- 🔮 Visual hover effects / previews

## Behavior

### Loading State
- Show skeleton grid with placeholder cards
- Match final grid column count

### Error State
- Display error message with retry button
- Same error UI as Feed

### Empty State
- Show "No posts yet" message
- Encourage creating first post

### Card Interaction
- Hover: Subtle scale up + shadow
- Click: Navigate to `/post/[id]`
- No inline trading (different from Feed)

## Styling

### Colors (from design-system.md)
- Background: `#0f0f0f` (bg-[#0f0f0f])
- Cards: `#1a1a1a` with `#2a2a2a` border
- Text: White primary, gray-300 secondary
- Accent: Blue-400 for links

### Grid Gaps
- `gap-6` between cards (24px)
- Consistent padding around grid container

### Animations
- Fade-in on mount (stagger by index)
- Hover transitions on cards

## Authentication
- **Protected route** - requires authentication
- Same auth flow as Feed page
- Redirect to `/` if not authenticated

## Mobile Considerations
- Single column on mobile (<768px)
- Bottom navigation bar (MobileNav)
- Top header (NavigationHeader) on mobile
- Cards expand to full width with margins

## Related Specs
- `CompactPostCard.md` - Grid card component
- `FeedView.md` - Comparison with timeline view
- `design-system.md` - Colors and typography

## Implementation Notes
- Use CSS Grid for layout (not Flexbox)
- Maintain same authentication pattern as Feed
- Reuse `usePosts()` hook - no new API needed
- Keep it simple for MVP - sorting can come later

---

**Status**: ✅ Spec Complete
**Created**: January 2025
**Last Updated**: January 2025
