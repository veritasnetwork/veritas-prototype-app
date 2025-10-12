# CompactPostCard Component Specification

## Purpose
A minimal, tweet-like post card for displaying posts in lists where space is limited (e.g., portfolio holdings, search results, related posts). Shows essential info at a glance without full content.

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ This is the post title if it exists                    $0.12 │
│ @username • 2h ago                                            │
│ 250 tokens • $30.50                                           │
└─────────────────────────────────────────────────────────────┘

OR (if no title):

┌─────────────────────────────────────────────────────────────┐
│ This is the first sentence of the content or up...    $0.12 │
│ @username • 2h ago                                            │
│ 250 tokens • $30.50                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Props

```typescript
interface CompactPostCardProps {
  post: {
    id: string;
    title?: string;
    content: string;
    author: {
      username: string;
      display_name?: string;
    };
    timestamp: string | Date;
    poolAddress: string;
    poolTokenSupply?: number;
    poolReserveBalance?: number;
    poolKQuadratic?: number;
  };
  // Optional: User's holdings for this post (if viewing as portfolio)
  holdings?: {
    token_balance: number;
    current_value_usdc: number; // USD value of holdings
  };
  // Optional: Click handler
  onClick?: () => void;
}
```

---

## Layout Structure

### Container
- **Style**: Eggshell background card (`var(--eggshell)`)
- **Border**: 1px solid `var(--eggshell-dark)`
- **Border Radius**: 8px (small, compact feel)
- **Padding**: 12px 16px (tight spacing)
- **Hover**: Lift effect (translateY(-1px) + subtle shadow)
- **Cursor**: Pointer (entire card is clickable)
- **Transition**: All 150ms ease-out

### Top Row - Title/Preview + Price
- **Layout**: Flex row, space-between
- **Left**: Title or content preview
  - **If title exists**: Show full title (1 line, ellipsis overflow)
    - Font: 16px medium
    - Color: `var(--text-primary)`
    - Max-width: 70% of card width
    - White-space: nowrap
    - Overflow: ellipsis
  - **If no title**: Show first sentence of content
    - Extract first sentence (split on `. `, `! `, `? `)
    - Max 60 characters, add `...` if truncated
    - Font: 16px regular
    - Color: `var(--text-primary)`
    - Italic style (to differentiate from title)
- **Right**: Current token price
  - Font: 14px medium
  - Color: `var(--text-secondary)`
  - Format: `$0.0081`
  - Align: Right

### Middle Row - Metadata
- **Layout**: Flex row, gap 8px
- **Items**: `@username • 2h ago`
  - Font: 13px regular
  - Color: `var(--text-secondary)`
  - Username: Clickable (stops propagation, navigates to profile)
  - Timestamp: Relative time format

### Bottom Row - Holdings (Conditional)
**Only show if `holdings` prop provided**

- **Layout**: Flex row, gap 12px
- **Items**:
  - **Token balance**: `250 tokens`
    - Font: 13px medium
    - Color: `var(--text-primary)`
  - **Separator**: `•`
    - Color: `var(--text-tertiary)`
  - **USD Value**: `$30.50`
    - Font: 13px medium
    - Color: `var(--success)` if positive value, `var(--text-primary)` otherwise

---

## Variants

### Default (No Holdings)
Used in search results, related posts, recent posts
```
┌─────────────────────────────────────────────────────────────┐
│ Understanding Bayesian Truth Serum in practice        $0.08 │
│ @alice • 3h ago                                               │
└─────────────────────────────────────────────────────────────┘
```

### With Holdings
Used in portfolio/holdings view
```
┌─────────────────────────────────────────────────────────────┐
│ Understanding Bayesian Truth Serum in practice        $0.08 │
│ @alice • 3h ago                                               │
│ 1,250 tokens • $100.00                                        │
└─────────────────────────────────────────────────────────────┘
```

### No Title (Content Preview)
```
┌─────────────────────────────────────────────────────────────┐
│ This is a post without a title so we show content...  $0.03 │
│ @bob • 1d ago                                                 │
│ 50 tokens • $1.50                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Interactive States

### Default
- Background: `var(--eggshell)`
- Border: `var(--eggshell-dark)`
- Shadow: `var(--shadow-sm)`

### Hover
- Transform: `translateY(-1px)`
- Shadow: `var(--shadow-md)`
- Border: Slightly darker

### Active (Clicked)
- Transform: `translateY(0)` (back to default)
- Shadow: `var(--shadow-sm)`

---

## Behavior

### Click Handling
- **Full card click**: Navigate to `/post/[id]`
- **Username click**: Stop propagation, navigate to `/profile/[username]`

### Truncation Logic
```typescript
function getPostPreview(post: { title?: string; content: string }): string {
  if (post.title) {
    return post.title; // Will be CSS-truncated with ellipsis
  }

  // Extract first sentence
  const firstSentence = post.content.split(/[.!?]\s/)[0];

  // Truncate to 60 chars
  if (firstSentence.length > 60) {
    return firstSentence.substring(0, 60) + '...';
  }

  return firstSentence + '...';
}
```

### Price Calculation
```typescript
function getCurrentPrice(pool: {
  poolTokenSupply?: number;
  poolReserveBalance?: number;
  poolKQuadratic?: number;
}): number {
  const supply = pool.poolTokenSupply || 0;
  const reserve = (pool.poolReserveBalance || 0) / 1_000_000; // micro-USDC to USDC
  const k = pool.poolKQuadratic || 1;

  if (supply === 0) return 0;

  return reserve / (k * Math.pow(supply, 2));
}
```

### Holdings Value Calculation
```typescript
function getHoldingsValue(
  tokenBalance: number,
  currentPrice: number
): number {
  return tokenBalance * currentPrice;
}
```

---

## Accessibility

- **Semantic HTML**: `<article>` wrapper
- **Click target**: Minimum 44px height for touch
- **Keyboard**: Tab-able, Enter to click
- **Focus**: Visible outline on keyboard focus
- **Screen reader**:
  - Title/content as heading
  - Holdings as "You own X tokens worth $Y"
  - Username as link "View @username's profile"

---

## Responsive Behavior

### Desktop (>768px)
- Full width within container
- All elements visible
- Hover effects active

### Mobile (<768px)
- Full width with 4px border-radius
- Price might wrap to second line if needed
- Tap to navigate (no hover state)

---

## Usage Examples

### In Holdings Tab (ProfilePage)
```tsx
<div className="flex flex-col gap-2">
  {holdings.map((holding) => (
    <CompactPostCard
      key={holding.post.id}
      post={holding.post}
      holdings={{
        token_balance: holding.token_balance,
        current_value_usdc: holding.token_balance * getCurrentPrice(holding.post)
      }}
      onClick={() => router.push(`/post/${holding.post.id}`)}
    />
  ))}
</div>
```

### In Search Results (Future)
```tsx
<div className="flex flex-col gap-2">
  {searchResults.map((post) => (
    <CompactPostCard
      key={post.id}
      post={post}
      onClick={() => router.push(`/post/${post.id}`)}
    />
  ))}
</div>
```

---

## Design Notes

1. **Compact**: Maximum info density, minimum vertical space (~60-80px per card)
2. **Scannable**: Title/content jumps out, metadata is secondary
3. **Consistent**: Same width as parent container, stacks nicely
4. **Fast**: No images, minimal layout shifts
5. **Clickable**: Clear hover state, entire card is hit target

---

## Comparison: CompactPostCard vs PostCard

| Feature | CompactPostCard | PostCard |
|---------|----------------|----------|
| Height | ~60-80px | ~250-400px |
| Content | Title or 1 sentence | Full content |
| Pool info | Price only | Full metrics, chart |
| Trading | None | Buy/sell interface |
| Belief | None | Submission form |
| Use case | Lists, portfolio | Feed, detail view |

---

## Implementation Notes

- **Component**: `<CompactPostCard />`
- **Location**: `src/components/feed/CompactPostCard.tsx`
- **Dependencies**:
  - `formatRelativeTime` from `@/utils/formatters`
  - `useRouter` from `next/navigation`
- **State**: Stateless (all data from props)
- **Performance**: Memoize with `React.memo` for list rendering

---

## Future Enhancements

1. **Badges**: Show "Trending" or "New" badge
2. **Sparkline**: Tiny price trend chart (5px tall)
3. **PnL indicator**: Green/red for profit/loss on holdings
4. **Skeleton**: Loading state for lists
5. **Drag to reorder**: In custom portfolios

---

**Last Updated**: October 2025
**Status**: Ready for implementation
**Priority**: HIGH (needed for ProfilePage holdings tab)
