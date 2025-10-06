# Post Card Component Specification

## Purpose
Display individual posts in the feed with belief market metrics, user info, and interactive states.

## Visual Design

### Layout
```
┌──────────────────────────────────────────────────────┐
│  [@] Username • 2h ago                               │
│                                                      │
│  Post Title (Bold, 20px)                            │
│                                                      │
│  Content preview text goes here, showing the first  │
│  few lines of the post content. Longer content      │
│  will be truncated with...                          │
│                                                      │
│  ───────────────────────────────────────────────    │
│  📊 67% belief  •  🔥 $12.4K stake  •  ⏱ 23h left  │
└──────────────────────────────────────────────────────┘
```

### Dimensions
- **Width**: 100% (max 680px in feed container)
- **Padding**: 24px
- **Border-radius**: 12px (`var(--radius-md)`)
- **Gap**: 16px between sections

### Styling
- **Background**: `var(--bg-elevated)` (#1a1a1a)
- **Border**: 1px solid `var(--border)` (#2a2a2a)
- **Hover State**:
  - `transform: translateY(-2px)`
  - `box-shadow: var(--shadow-md)`
  - `border-color: var(--border-elevated)`
  - Cursor: pointer
- **Transition**: All 200ms ease-out

## Components

### Header Section
- **Avatar**: 32x32px, rounded-full, margin-right 12px
- **Username**:
  - Font: Medium, 14px
  - Color: `var(--text-primary)`
  - Format: `@username`
- **Timestamp**:
  - Font: Regular, 14px
  - Color: `var(--text-secondary)`
  - Format: "2h ago", "3d ago", etc.
  - Separator: " • " between username and time

### Content Section
- **Title**:
  - Font: Bold, 20px
  - Color: `var(--text-primary)`
  - Line-height: 1.3
  - Margin-bottom: 12px
  - Max lines: 2 (truncate with ellipsis)
- **Body**:
  - Font: Regular, 16px
  - Color: `var(--text-secondary)`
  - Line-height: 1.6
  - Max lines: 3 (truncate with ellipsis)
  - Character limit: ~200 chars for preview

### Metrics Bar (Footer)
- **Separator**: Horizontal line above metrics
  - Color: `var(--border)`
  - Margin: 16px vertical
- **Layout**: Flex row, gap 16px
- **Metrics**:
  1. **Belief Percentage**:
     - Icon: 📊 (or chart icon)
     - Text: "67% belief"
     - Color: Gradient based on confidence (future)
  2. **Stake**:
     - Icon: 🔥 (or dollar icon)
     - Text: "$12.4K stake"
     - Color: `var(--accent-primary)` if high, secondary if low
  3. **Time Remaining**:
     - Icon: ⏱ (or clock icon)
     - Text: "23h left" or "Expired"
     - Color: `var(--warning)` if <24h, secondary otherwise

- **Metric Style**:
  - Font: Medium, 14px
  - Display: Inline-flex, align-items center
  - Gap: 6px between icon and text

## States

### Default
- Clean card appearance with all metrics visible

### Hover
- Lift effect with shadow
- Slightly brighter border
- Show "View Details →" indicator (future)

### Loading (Skeleton)
- Pulsing placeholder boxes
- Same dimensions as content
- Animation: pulse 1.5s ease-in-out infinite

### No Belief Data
- Hide belief percentage and time
- Show only stake if available

## Responsive Behavior

### Desktop (>768px)
- Full metrics bar with all indicators
- 3-line content preview

### Mobile (<768px)
- Condensed metrics (icons only with tooltips)
- 2-line content preview
- Smaller padding (16px)

## Accessibility
- **Semantic**: `<article>` element
- **Clickable**: Entire card is clickable (not just title)
- **Keyboard**: Tab to focus, Enter to open
- **Focus**: Clear focus ring
- **Screen Reader**:
  - Title as heading (h3)
  - Metrics as descriptive text
  - "Published by {username} {time} ago"

## Interactions
- **Click Anywhere**: Navigate to `/post/{id}` (full post view)
- **Hover**: Lift and shadow effect
- **Touch**: Brief scale-down on press (mobile)

## Data Requirements
```typescript
interface PostCardData {
  id: string;
  user: {
    username: string;
    avatar_url?: string;
  };
  title: string;
  content: string;
  created_at: string;
  belief?: {
    aggregate: number; // 0-100
    total_stake: number;
    expires_at_epoch: number;
  };
}
```

## Implementation Notes
- Component: `<PostCard post={post} />`
- Location: `src/components/feed/PostCard.tsx`
- Used in: Feed component (list of posts)
- Utilities needed:
  - `formatTimeAgo(date)` - "2h ago"
  - `formatCurrency(amount)` - "$12.4K"
  - `formatTimeRemaining(epoch)` - "23h left"

## Edge Cases
- **No content**: Show title only with minimum height
- **Very long title**: Truncate to 2 lines with ellipsis
- **No belief**: Card shows, but metrics bar has fewer items
- **Expired belief**: Show "Expired" in red with icon
- **Missing avatar**: Use generated avatar or default placeholder
