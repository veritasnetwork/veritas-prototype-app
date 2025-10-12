# Profile Page Component Specification

## Purpose
Display user profile with stats, stake information, and recent activity.

## Visual Design

### Layout
```
┌────────────────────────────────────────────────────┐
│  [← Back]                                          │
│                                                    │
│         ┌──────┐                                   │
│         │Avatar│                                   │
│         └──────┘                                   │
│                                                    │
│         Display Name                               │
│         @username                                  │
│         Sol1abc...xyz (wallet)                     │
│                                                    │
│  ┌─────────────────┬──────────────────────────┐   │
│  │ Stake           │ Posts                    │   │
│  │ $1,234          │ 12                       │   │
│  └─────────────────┴──────────────────────────┘   │
│                                                    │
│  Recent Activity                                   │
│  ─────────────────────────────────────────────────│
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ Post Card (compact)                         │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │ Post Card (compact)                         │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Container
- **Max-width**: 680px
- **Padding**: 24px horizontal, 32px vertical
- **Margin**: 0 auto
- **Background**: `var(--bg-primary)`

## Components

### Back Navigation
- **Button**: "← Back"
  - Font: Medium, 14px
  - Color: `var(--text-secondary)`
  - Hover: `var(--text-primary)`
  - Icon: Left arrow (16px)
  - Margin-bottom: 24px
  - Click: `router.back()` or navigate to `/feed`

### Profile Header
- **Avatar**:
  - Size: 96x96px (desktop), 80px (mobile)
  - Border-radius: 9999px
  - Border: 3px solid `var(--accent-primary)`
  - Margin: 0 auto 16px (centered)
  - Generated from username if no avatar URL
- **Display Name**:
  - Font: Bold, 28px
  - Color: `var(--text-primary)`
  - Text-align: center
  - Margin-bottom: 4px
- **Username**:
  - Font: Medium, 16px
  - Color: `var(--text-secondary)`
  - Text-align: center
  - Format: "@username"
  - Margin-bottom: 8px
- **Wallet Address**:
  - Font: Mono, 14px
  - Color: `var(--text-tertiary)`
  - Text-align: center
  - Format: "Sol1abc...xyz" (truncated)
  - Copy button on hover
  - Margin-bottom: 24px

### Stats Grid
- **Layout**: 2-column grid, gap 16px
- **Card**:
  - Background: `var(--bg-elevated)`
  - Border: 1px solid `var(--border)`
  - Border-radius: 12px
  - Padding: 20px
  - Text-align: center
- **Label**:
  - Font: Medium, 14px
  - Color: `var(--text-secondary)`
  - Margin-bottom: 8px
- **Value**:
  - Font: Bold, 32px
  - Color: `var(--text-primary)`
  - Formatted: "$1,234" for stake, "12" for posts

### Tab Navigation (NEW)
- **Position**: Below stats grid
- **Tabs**: Posts | Holdings
- **Style**:
  - Container: Border-bottom 1px solid `var(--border)`
  - Tab buttons:
    - Padding: 12px 20px
    - Font: 15px medium
    - Color: `var(--text-secondary)` (inactive)
    - Active color: `var(--text-primary)`
    - Active indicator: 2px bottom border `var(--accent-primary)`
    - Hover: Background `var(--bg-hover)`
  - Layout: Horizontal flex, gap 4px
  - Margin-bottom: 24px

### Tab 1: Posts (Default)
Shows user's created posts in reverse chronological order.

- **Posts List**:
  - Display: Flex column
  - Gap: 12px
  - Rendered as `<PostCard>` components (full cards, same as feed)
  - Limit: 10 most recent

**Empty State** - When user has no posts:
```
┌─────────────────────────────────────┐
│                                     │
│     No posts yet                    │
│     Create your first post!         │
│                                     │
│     [Create Post Button]            │
│                                     │
└─────────────────────────────────────┘
```

### Tab 2: Holdings (NEW)
Shows posts where the user holds tokens, sorted by USD value (highest first).

- **Holdings List**:
  - Display: Flex column
  - Gap: 8px (tighter than posts)
  - Rendered as `<CompactPostCard>` components
  - Each card shows:
    - Post title (or content preview if no title)
    - Token balance
    - Current USD value
    - Current token price
  - Sorted by: `token_balance * current_price` descending
  - Empty state: "You don't own any tokens yet"

**Example**:
```
┌─────────────────────────────────────────────────────────────┐
│ Understanding BTS and belief markets               $0.0081  │
│ @alice • 3h ago                                              │
│ 1,250 tokens • $10.13                                        │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ The future of decentralized curation              $0.0042  │
│ @bob • 1d ago                                                │
│ 500 tokens • $2.10                                           │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ This post has no title so we show the first...    $0.0015  │
│ @charlie • 2d ago                                            │
│ 100 tokens • $0.15                                           │
└─────────────────────────────────────────────────────────────┘
```

**Empty State** - When user holds no tokens:
```
┌─────────────────────────────────────┐
│                                     │
│     No holdings yet                 │
│     Buy tokens to support posts!    │
│                                     │
│     [Browse Feed]                   │
│                                     │
└─────────────────────────────────────┘
```

**Data Requirements**:
- Query `user_pool_balances` table for user's holdings
- Filter: `token_balance > 0`
- Join with `posts` and `pool_deployments` tables
- Calculate current price from pool state
- Calculate USD value: `token_balance * current_price`

## States

### Loading
- Skeleton placeholders:
  - Circular skeleton for avatar (pulse animation)
  - Rectangle skeletons for name, username, wallet
  - Skeleton stat cards
  - Skeleton post cards

### Loaded
- Display all data
- Interactive elements enabled

### Error
- Show error message
- Retry button
- No stats displayed

### Own Profile vs Other User
- **Own Profile**:
  - Show "Edit Profile" button (future)
  - Show private stats (if applicable)
  - Full wallet address visible
- **Other User**:
  - No edit button
  - Public stats only
  - Truncated wallet

## Data Requirements

```typescript
interface ProfileData {
  user: {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    solana_address?: string;
  };
  stats: {
    total_stake: number;
    total_posts: number;
  };
  recent_posts: PostCardData[];
}
```

### API Endpoints

#### GET /api/users/{username}/profile
Returns user profile data with stats and recent posts.

```typescript
Response: {
  user: { id, username, display_name, avatar_url, solana_address },
  stats: { total_stake, total_posts },
  recent_posts: Post[]
}
```

#### GET /api/users/{username}/holdings (NEW)
Returns user's token holdings with post data.

```typescript
Response: {
  holdings: Array<{
    post: {
      id: string;
      title?: string;
      content: string;
      user_id: string;
      created_at: string;
      author: {
        username: string;
        display_name: string;
      };
    };
    pool: {
      pool_address: string;
      token_supply: number;
      reserve: number;
      k_quadratic: number;
      current_price: number; // calculated
    };
    balance: {
      token_balance: number;
      current_value_usdc: number; // calculated: token_balance * current_price
      total_usdc_spent: number;
      total_bought: number;
    };
  }>
}
```

**Query**:
```sql
SELECT
  upb.*,
  p.id, p.title, p.content, p.user_id, p.created_at,
  u.username, u.display_name,
  pd.pool_address, pd.token_supply, pd.reserve, pd.k_quadratic
FROM user_pool_balances upb
JOIN posts p ON upb.post_id = p.id
JOIN users u ON p.user_id = u.id
JOIN pool_deployments pd ON upb.pool_address = pd.pool_address
WHERE upb.user_id = $user_id
  AND upb.token_balance > 0
ORDER BY (upb.token_balance * (pd.reserve / (pd.k_quadratic * POWER(pd.token_supply, 2)))) DESC
```

## Interactions

### Back Button
- Click: Navigate to previous page or `/feed`

### Copy Wallet Address
- Click wallet address to copy
- Show toast: "Address copied!"
- Visual feedback: Brief highlight

### Stat Cards
- Hover: Slight lift effect
- Click: Navigate to detailed view (future)

### Posts
- Click: Navigate to full post page
- Same as PostCard interactions

## Responsive Behavior

### Desktop (>768px)
- Centered layout (680px max-width)
- Larger avatar (96px)
- 2-column stats grid
- Spacious padding (24px)

### Mobile (<768px)
- Full-width with 16px padding
- Smaller avatar (80px)
- 2-column stats grid (stacked on very small screens)
- Compact spacing

## Accessibility
- **Semantic**: `<main>` wrapper
- **Headings**: Proper heading hierarchy (h1 for name, h2 for sections)
- **ARIA**:
  - Avatar: `alt` text with username
  - Wallet: `aria-label="Copy wallet address"`
  - Stats: `aria-label="User has X posts and Y stake"`
- **Keyboard**: All interactive elements keyboard accessible
- **Focus**: Clear focus indicators

## Performance
- **Lazy Load**: Load recent posts on demand
- **Image Optimization**: Avatar images optimized
- **Skeleton**: Show content-aware skeleton during load

## Implementation Notes
- Component: `<ProfilePage username={username} />`
- Location: `src/components/profile/ProfilePage.tsx`
- Page: `app/profile/[username]/page.tsx`
- Hooks:
  - `useProfile(username)` - Fetch profile data
  - `useAuth()` - Determine if own profile
- Utility:
  - `truncateAddress(address)` - "Sol1abc...xyz"
  - `formatCurrency(amount)` - "$1,234"

## Edge Cases
- **User Not Found**: Show 404 page
- **No Wallet**: Show "No wallet connected"
- **Zero Stats**: Show "0" instead of hiding
- **Long Username**: Truncate with ellipsis
- **No Avatar**: Use generated placeholder
- **Many Posts**: Implement pagination (Load More button)
