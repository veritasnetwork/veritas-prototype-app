# Post Detail Panel Specification

## Overview
A slide-out panel that displays post details and trading interface when a user clicks a post card. Unlike the previous full-page design, this panel overlays or shifts the feed, keeping users in their browsing context.

## Behavior

### Desktop (≥1024px)
- **Feed slides right**: Feed container shifts right by 480px
- **Panel slides in from right**: 480px wide panel appears on the right side
- **Feed remains visible**: User can still see feed on the left
- **Click outside or [X]**: Closes panel, feed slides back to center
- **Background overlay**: 30% dark overlay on feed area

### Mobile (<1024px)
- **Card expansion**: Clicked PostCard expands to full-height detail card
- **Pushes other cards down**: Other cards remain visible below
- **Close button**: [X] at top-right collapses back to card
- **Scroll to top**: Auto-scrolls expanded card to top of viewport
- **Alternative**: Full-screen modal overlay (simpler implementation)

## Panel Structure

```
┌─────────────────────────────────────────────┐
│ [X] Close                                   │
├─────────────────────────────────────────────┤
│                                             │
│ [@] Username • 2h ago                      │
│                                             │
│ Post Title (Bold, 20px)                    │
│                                             │
│ Full post content with line breaks...      │
│                                             │
│ ─────────────────────────────────────────  │
│                                             │
│ 📊 Pool Metrics                            │
│ ├─ Reserve: $2,483 USDC                   │
│ ├─ Token Supply: 15,432                    │
│ ├─ Current Price: $0.0081                  │
│ └─ Your Holdings: 0 tokens                 │
│                                             │
│ ─────────────────────────────────────────  │
│                                             │
│ 🔄 Swap Tokens                             │
│                                             │
│ You Pay:                                    │
│ ┌─────────────────────────────────────┐    │
│ │ 1.0              [USDC ▼]          │    │
│ └─────────────────────────────────────┘    │
│                                             │
│              [⇅]                           │
│                                             │
│ You Receive:                                │
│ ┌─────────────────────────────────────┐    │
│ │ ~123.45          [TOKEN ▼]         │    │
│ └─────────────────────────────────────┘    │
│                                             │
│ Rate: 1 USDC = 123.45 tokens               │
│ Price impact: 0.3%                          │
│                                             │
│ [Swap →]                                    │
│                                             │
└─────────────────────────────────────────────┘
```

## Components

### 1. Header Section
- **Close button**: Top-right X icon
- **Author info**: Avatar + username + timestamp
- **Post content**: Title + body (full, no truncation)
- **Spacing**: 24px padding all sides

### 2. Pool Metrics Section
- **Card style**: Gray background, 16px padding, 8px radius
- **Metrics**:
  - Reserve balance (USDC)
  - Token supply
  - Current price per token
  - User's holdings (if wallet connected)
- **Layout**: Vertical list with icons

### 3. Swap Component
The core trading interface - see SwapComponent.md spec

**Key features**:
- Dual input fields (You Pay / You Receive)
- Token dropdown (USDC ⇄ TOKEN)
- Swap direction button (⇅)
- Real-time price calculation
- Price impact warning
- Slippage tolerance settings (advanced)
- Swap button with states

## States

### Loading
- Skeleton for header
- Skeleton for metrics
- Skeleton for swap interface

### Loaded
- All data rendered
- Swap component interactive

### No Wallet
- Show "Connect Wallet" button in swap section
- Disable swap inputs

### Error
- Show error banner: "Failed to load post data. [Retry]"
- Keep close button functional

## Animations

### Desktop Open
```
1. Feed container: translate-x 480px (300ms ease-out)
2. Overlay: fade in opacity 0→0.3 (200ms)
3. Panel: slide in from right, translate-x 480px→0 (300ms ease-out)
```

### Desktop Close
```
1. Panel: slide out to right, translate-x 0→480px (250ms ease-in)
2. Overlay: fade out opacity 0.3→0 (200ms)
3. Feed container: translate-x 0 (250ms ease-in)
```

### Mobile Expand
```
1. Card: expand height auto (300ms ease-out)
2. Scroll: smooth scroll to card top (200ms)
```

### Mobile Collapse
```
1. Card: collapse to original height (250ms ease-in)
```

## Implementation Notes

### Components Structure
```
<PostDetailPanel>
  ├─ <PostHeader />
  ├─ <PostContent />
  ├─ <PoolMetrics />
  └─ <SwapComponent />
</PostDetailPanel>
```

### State Management
```typescript
// In Feed/Explore component
const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

// Opens panel
const handlePostClick = (postId: string) => {
  setSelectedPostId(postId);
};

// Closes panel
const handleClosePanel = () => {
  setSelectedPostId(null);
};
```

### Routing
- **No URL change**: Stays on `/feed` or `/explore`
- **Optional**: Add hash param `#post/[id]` for sharing
- **Back button**: Close panel if open

### Data Fetching
```typescript
// Fetch full post data when panel opens
const { data: postDetail } = usePost(selectedPostId, {
  enabled: !!selectedPostId
});
```

## Responsive Breakpoints

### Desktop (≥1024px)
- Panel width: 480px
- Feed shift: 480px
- Max panel height: 100vh (scrollable)

### Tablet (768px - 1023px)
- Full-screen modal overlay (simpler)
- Panel width: 90vw, max 600px
- Centered on screen

### Mobile (<768px)
- Full-screen modal overlay
- Panel width: 100vw
- Full viewport height

## Accessibility

- **Trap focus**: Focus stays within panel when open
- **ESC key**: Closes panel
- **Aria labels**: `aria-modal="true"`, `role="dialog"`
- **Focus management**: Focus close button on open

## Files to Create/Modify

### Create:
1. `src/components/post/PostDetailPanel.tsx` - Main panel component
2. `src/components/post/SwapComponent.tsx` - Swap interface (see SwapComponent.md)
3. `specs/ui-specs/components/SwapComponent.md` - Swap component spec

### Modify:
1. `src/components/feed/Feed.tsx` - Add panel state + shift animation
2. `src/components/explore/Explore.tsx` - Add panel state + shift animation
3. `src/components/feed/PostCard/PostCard.tsx` - Make clickable, trigger panel open
4. `src/components/feed/PostCard/CompactPostCard.tsx` - Make clickable, trigger panel open

## Design Decisions

### Why Not Full Page?
- **Faster**: No route navigation, instant open/close
- **Context preserved**: User stays in their feed/explore location
- **Better UX**: Similar to Twitter/X, Discord, Slack
- **Simpler**: No need for complex back navigation logic

### Why Swap vs Buy/Sell Tabs?
- **Unified interface**: Single mental model for trading
- **Clearer**: "Pay X, Get Y" is more intuitive than separate forms
- **Familiar**: Matches Uniswap/DEX patterns users know
- **Flexible**: Easy to add advanced features (slippage, deadline)

### Why Panel Width 480px?
- **Enough space**: Comfortable for swap interface
- **Leaves feed visible**: User can still see context
- **Standard**: Common panel width (Discord = 424px, Twitter = 600px)

---

**Status**: ⚠️ New Design - Spec Complete
**Created**: January 2025
**Replaces**: PostDetailView.md full-page design
**Priority**: HIGH
**Dependencies**: SwapComponent.md spec
