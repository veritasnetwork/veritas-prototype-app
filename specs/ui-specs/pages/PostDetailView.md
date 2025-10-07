# Post Detail View Page Specification

## Purpose
Full-screen view of a single post with complete content, trading interface, historical charts, belief submission, and detailed metrics. This is the primary destination for deep engagement with content and speculation.

## Route
`/post/[id]` - Dynamic route using post UUID

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Navigation Header - Sticky]                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [←] Back to Feed                                    │   │
│  │                                                     │   │
│  │ [@] Username • 2h ago                              │   │
│  │                                                     │   │
│  │ Post Title (Large, Bold)                           │   │
│  │                                                     │   │
│  │ Full post content goes here with proper           │   │
│  │ line breaks, paragraphs, and formatting.          │   │
│  │ All content is shown (no truncation).             │   │
│  │                                                     │   │
│  │ ─────────────────────────────────────────────────  │   │
│  │                                                     │   │
│  │ [Tabs: Overview | Trading | Analytics]            │   │
│  │                                                     │   │
│  │ ┌─── OVERVIEW TAB ────────────────────────────┐   │   │
│  │ │                                              │   │   │
│  │ │ 📊 Belief Market Status                     │   │   │
│  │ │ ├─ Current Aggregate: 67%                   │   │   │
│  │ │ ├─ Delta Relevance: +12% ↑                  │   │   │
│  │ │ ├─ Certainty: 85%                           │   │   │
│  │ │ └─ Expires: 23h 14m (Epoch 42)              │   │   │
│  │ │                                              │   │   │
│  │ │ 💎 Pool Metrics                             │   │   │
│  │ │ ├─ Token Supply: 15,432                     │   │   │
│  │ │ ├─ Reserve: $12,483 USDC                    │   │   │
│  │ │ ├─ Current Price: $0.0081 USDC              │   │   │
│  │ │ └─ Your Holdings: 250 tokens ($2.03)        │   │   │
│  │ │                                              │   │   │
│  │ └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │ ┌─── TRADING TAB ─────────────────────────────┐   │   │
│  │ │                                              │   │   │
│  │ │ [Buy] [Sell]                                │   │   │
│  │ │                                              │   │   │
│  │ │ Amount:                                      │   │   │
│  │ │ ┌────────────────────────┐                  │   │   │
│  │ │ │ 100                    │ tokens           │   │   │
│  │ │ └────────────────────────┘                  │   │   │
│  │ │                                              │   │   │
│  │ │ You will pay: ~$0.82 USDC                   │   │   │
│  │ │ Price impact: 0.3%                          │   │   │
│  │ │ New price: $0.0083 USDC                     │   │   │
│  │ │                                              │   │   │
│  │ │ [Buy 100 Tokens →]                          │   │   │
│  │ │                                              │   │   │
│  │ └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │ ┌─── ANALYTICS TAB ───────────────────────────┐   │   │
│  │ │                                              │   │   │
│  │ │ Delta Relevance History                     │   │   │
│  │ │ ┌────────────────────────────────────────┐  │   │   │
│  │ │ │         ╱╲                             │  │   │   │
│  │ │ │      ╱╲╱  ╲      ╱╲                   │  │   │   │
│  │ │ │   ╱╲╱      ╲╱╲╱╲╱  ╲                 │  │   │   │
│  │ │ │──────────────────────────────────────  │  │   │   │
│  │ │ │   Epoch 35  37  39  41  43  45       │  │   │   │
│  │ │ └────────────────────────────────────────┘  │   │   │
│  │ │                                              │   │   │
│  │ │ Token Price History                         │   │   │
│  │ │ ┌────────────────────────────────────────┐  │   │   │
│  │ │ │                                ╱       │  │   │   │
│  │ │ │                           ╱╲╱╲╱       │  │   │   │
│  │ │ │   ──────────╱╲╱╲╱╲───────           │  │   │   │
│  │ │ │  ╱──────╱╲╱                          │  │   │   │
│  │ │ │   Epoch 35  37  39  41  43  45       │  │   │   │
│  │ │ └────────────────────────────────────────┘  │   │   │
│  │ │                                              │   │   │
│  │ │ Pool Stats                                  │   │   │
│  │ │ ├─ All-time High: $0.0125 (Epoch 38)       │   │   │
│  │ │ ├─ All-time Low: $0.0042 (Epoch 36)        │   │   │
│  │ │ ├─ Total Volume: $45,283                    │   │   │
│  │ │ ├─ Unique Holders: 127                      │   │   │
│  │ │ └─ Your Position: +23.5% ROI               │   │   │
│  │ │                                              │   │   │
│  │ └──────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Page Structure

### 1. Back Navigation
- **Position**: Top of content area, above post header
- **Element**: Link with left arrow icon
- **Text**: "Back to Feed" or "Back"
- **Action**: Navigate to previous page (or `/feed` if direct link)
- **Style**:
  - Color: `var(--text-secondary)`
  - Hover: `var(--text-primary)`
  - Icon: 16px left arrow
  - Font: 14px medium

### 2. Post Header Section
Same as PostCard header but with more prominence:
- **Avatar**: 40px (larger than feed)
- **Username**: 16px medium, clickable to profile
- **Timestamp**: Full date on hover ("2 hours ago" → "Oct 7, 2025 2:30 PM")
- **Padding**: 32px all sides (larger breathing room)

### 3. Post Content Section
- **Title**:
  - Font: Bold, 32px (headline size)
  - Color: `var(--text-primary)`
  - Line-height: 1.2
  - Margin-bottom: 24px
  - **No truncation** - full title shown

- **Body**:
  - Font: Regular, 18px (body-large for readability)
  - Color: `var(--text-primary)`
  - Line-height: 1.7 (increased for long-form)
  - Max-width: 680px (optimal reading width)
  - Margin-bottom: 32px
  - **Full content** - no truncation
  - Preserve line breaks and paragraphs
  - Render links as clickable (future)

### 4. Tab Navigation
- **Position**: Below content, above tab panels
- **Tabs**: Overview | Trading | Analytics
- **Style**:
  - Container: Border-bottom 1px solid `var(--border)`
  - Tab buttons:
    - Padding: 16px 24px
    - Font: 16px medium
    - Color: `var(--text-secondary)` (inactive)
    - Active color: `var(--text-primary)`
    - Active indicator: 2px bottom border `var(--accent-primary)`
    - Hover: Background `var(--bg-hover)`
  - Layout: Horizontal flex, gap 8px
  - Sticky position when scrolling (future enhancement)

---

## Tab 1: Overview

### Belief Market Status Card
**Card style**: Eggshell background, 24px padding, 12px radius

**Metrics displayed**:

1. **Current Aggregate** (from `beliefs.previous_aggregate`)
   - Format: "67%" (large, 24px bold)
   - Label: "Current Aggregate Belief"
   - Subtext: "Based on Bayesian Truth Serum scoring"
   - Color: Gradient based on value (low=red, high=green)

2. **Delta Relevance** (from `beliefs.delta_relevance`)
   - Format: "+12% ↑" or "-5% ↓" (20px bold)
   - Label: "Change in Relevance"
   - Subtext: "From previous epoch"
   - Color: Green if positive, red if negative, gray if 0
   - Icon: Up/down arrow

3. **Certainty** (from `beliefs.certainty`)
   - Format: "85%" (20px medium)
   - Label: "Certainty Score"
   - Subtext: "Confidence in aggregate measurement"
   - Color: Blue if high (>70%), yellow if medium (40-70%), gray if low (<40%)

4. **Expiration** (calculated from `beliefs.expiration_epoch`)
   - Format: "23h 14m" or "2d 5h" (20px medium)
   - Label: "Time Remaining"
   - Subtext: "Expires at Epoch 42 (Oct 9, 4:30 PM)"
   - Color: `var(--warning)` if <24h, `var(--text-secondary)` otherwise
   - Show "Expired" in red if past expiration

### Pool Metrics Card
**Card style**: Eggshell background, 24px padding, 12px radius, margin-top 16px

**Metrics displayed**:

1. **Token Supply** (from `pool_deployments.token_supply`)
   - Format: "15,432" (number with commas)
   - Label: "Total Token Supply"
   - Subtext: "Tokens minted to date"

2. **Reserve Balance** (from `pool_deployments.reserve`)
   - Format: "$12,483 USDC" (micro-USDC converted to USDC)
   - Label: "Pool Reserve"
   - Subtext: "USDC backing token value"

3. **Current Price** (calculated from bonding curve)
   - Formula: `price = reserve / (k_quadratic * supply^2)`
   - Format: "$0.0081 USDC" (4 decimal places)
   - Label: "Current Token Price"
   - Subtext: "Per token on bonding curve"

4. **Your Holdings** (requires wallet connection + balance query)
   - Format: "250 tokens ($2.03)" (token count + USD value)
   - Label: "Your Position"
   - Subtext: "Connected wallet balance"
   - Show "Connect wallet" if not connected
   - Show "0 tokens" if connected but no balance

---

## Tab 2: Trading

### Buy/Sell Toggle
- **Style**: Segmented control
- **Options**: [Buy] [Sell]
- **Active state**: `var(--accent-dark)` background, white text
- **Inactive state**: `var(--bg-hover)` background, secondary text
- **Layout**: Equal width buttons, 48px height, 8px radius

### Amount Input
- **Label**: "Amount" (14px medium)
- **Input**:
  - Type: Number
  - Placeholder: "100"
  - Suffix: "tokens" (inline, non-editable)
  - Style: Standard input field (white bg, border)
  - Validation: Must be > 0, integer only
  - Max: Available tokens (for sell), calculated max (for buy based on wallet balance)

### Price Preview Section
**Auto-updates on amount change**

Display (for BUY):
- **You will pay**: "~$0.82 USDC" (calculated cost with slippage)
  - Uses bonding curve integral: `cost = k * (new_supply^2 - old_supply^2) / 2`
  - Add 0.5% slippage buffer
  - Color: `var(--text-primary)`, 18px medium

- **Price impact**: "0.3%" (percentage change in price after trade)
  - Formula: `((new_price - old_price) / old_price) * 100`
  - Color: Yellow if >5%, red if >10%, gray if <5%
  - Warning icon if >5%

- **New price**: "$0.0083 USDC" (price after trade executes)
  - Calculated from new supply and reserve
  - Color: `var(--text-secondary)`, 16px

Display (for SELL):
- **You will receive**: "~$0.78 USDC" (proceeds after selling)
- **Price impact**: Same calculation as buy
- **New price**: Updated price after sale

### Action Button
- **Text**: "Buy [amount] Tokens →" or "Sell [amount] Tokens →"
- **Style**: Primary button (dark blue, full width)
- **Height**: 56px
- **Disabled states**:
  - No wallet connected: "Connect Wallet"
  - Insufficient USDC (buy): "Insufficient USDC Balance"
  - Insufficient tokens (sell): "Insufficient Token Balance"
  - Invalid amount: "Enter valid amount"
  - No amount: "Enter amount"

### Transaction Flow
1. Click buy/sell button
2. Show confirmation modal:
   - "Confirm Buy" / "Confirm Sell"
   - Amount summary
   - Cost/proceeds
   - Slippage warning
   - [Cancel] [Confirm]
3. Trigger Solana transaction via Privy wallet
4. Show loading state with transaction status
5. On success:
   - Show success toast: "✅ Bought 100 tokens for $0.82"
   - Refresh pool data
   - Refresh user holdings
   - Reset input
6. On error:
   - Show error toast with message
   - Keep input state for retry

---

## Tab 3: Analytics

### Chart 1: Delta Relevance History

**Purpose**: Show how post's relative relevance has changed over time

**Data source**: Historical `beliefs.delta_relevance` values per epoch
- Requires new table: `belief_history` with columns:
  - `belief_id`, `epoch`, `delta_relevance`, `certainty`, `aggregate`, `recorded_at`
  - Populated by epoch processing function after each epoch

**Chart type**: Line chart
- **X-axis**: Epoch numbers (35, 36, 37, ...)
- **Y-axis**: Delta relevance percentage (-100% to +100%)
- **Line color**: Green when positive, red when negative
- **Zero line**: Dotted horizontal line at 0%
- **Data points**: Show dot on hover with tooltip
- **Tooltip**: "Epoch 38: +12.5% delta relevance"
- **Height**: 240px
- **Margin**: 24px bottom

**Empty state**: "No historical data yet" (if < 2 epochs)

### Chart 2: Token Price History

**Purpose**: Show how token price has evolved

**Data source**: Calculated from historical pool state
- Uses `belief_history` table with `token_supply` and `reserve` snapshots
- Calculate price per epoch: `price = reserve / (k_quadratic * supply^2)`

**Chart type**: Line chart
- **X-axis**: Epoch numbers
- **Y-axis**: Price in USDC ($0.00 - $0.02)
- **Line color**: `var(--accent-primary)` (light blue)
- **Fill**: Gradient from line to x-axis (subtle)
- **Data points**: Show dot on hover with tooltip
- **Tooltip**: "Epoch 38: $0.0095 USDC"
- **Height**: 240px
- **Margin**: 24px bottom

**Empty state**: "No price history yet"

### Pool Statistics Section

**Card style**: Eggshell background, grid layout (2 columns)

**Stats displayed**:

1. **All-time High**
   - Format: "$0.0125 (Epoch 38)"
   - Shows highest price ever reached
   - Color: Green

2. **All-time Low**
   - Format: "$0.0042 (Epoch 36)"
   - Shows lowest price recorded
   - Color: Red

3. **Total Volume**
   - Format: "$45,283"
   - Sum of all buy/sell transactions
   - Requires transaction history tracking

4. **Unique Holders**
   - Format: "127"
   - Count of unique addresses with balance > 0
   - Requires on-chain query or indexer

5. **Your Position** (if wallet connected)
   - Format: "+23.5% ROI" or "-8.2% ROI"
   - Calculation: `((current_value - cost_basis) / cost_basis) * 100`
   - Requires tracking user's cost basis
   - Color: Green if positive, red if negative

6. **Your Average Entry**
   - Format: "$0.0067 USDC"
   - Average price user paid across all purchases
   - Only show if user has holdings

---

## States

### Loading (Initial)
- Show skeleton for:
  - Post header (avatar, username, timestamp)
  - Post content (title, body)
  - Tab navigation
  - Tab panel content
- Pulse animation
- No spinner (content-aware loading)

### Loaded
- All content rendered
- Default to Overview tab
- Charts render with animation (fade + slide)

### Error (Post Not Found)
```
┌─────────────────────────────────────┐
│                                     │
│         [❌ Error Icon]             │
│                                     │
│     Post Not Found                  │
│     This post may have been deleted │
│                                     │
│     [← Back to Feed]                │
│                                     │
└─────────────────────────────────────┘
```

### Error (Failed to Load)
- Show error banner at top: "Failed to load post. [Retry]"
- Keep navigation functional
- Allow retry

### Expired Belief
- Override tab to show "Belief Market Expired"
- Disable belief submission
- Show final results in Overview
- Trading still works (pool independent of belief)

### No Wallet Connected (Trading Tab)
- Disable amount input
- Show "Connect Wallet" button instead of trade button
- Show message: "Connect your wallet to trade tokens"

---

## Responsive Behavior

### Desktop (>768px)
- Max-width: 840px (wider than feed for charts)
- Side padding: 32px
- Chart height: 240px
- Two-column grid for pool stats

### Mobile (<768px)
- Full-width with 16px padding
- Chart height: 180px
- Single-column grid for stats
- Tabs scroll horizontally if needed
- Trading interface full-width

---

## Data Requirements

### API Endpoint: `GET /api/posts/[id]`

**Request**: None (id from URL)

**Response**:
```typescript
{
  post: {
    id: string;
    user_id: string;
    title: string;
    content: string;
    created_at: string;
    users: {
      username: string;
      display_name: string;
      avatar_url?: string;
    };
  };
  belief: {
    id: string;
    previous_aggregate: number; // 0-1
    delta_relevance: number; // -1 to 1
    certainty: number; // 0-1
    expiration_epoch: number;
    status: 'active' | 'expired';
  };
  pool: {
    pool_address: string;
    token_mint_address: string;
    usdc_vault_address: string;
    token_supply: string; // bigint as string
    reserve: string; // bigint as string (micro-USDC)
    k_quadratic: number;
    current_price: string; // calculated USDC price
    last_synced_at: string;
  };
  user_holdings?: {
    token_balance: string;
    cost_basis: string; // avg price paid
    total_invested: string; // total USDC spent
  };
}
```

### API Endpoint: `GET /api/posts/[id]/history`

**Request**: None

**Response**:
```typescript
{
  epochs: Array<{
    epoch: number;
    delta_relevance: number;
    certainty: number;
    aggregate: number;
    token_supply: string;
    reserve: string;
    price: string;
    recorded_at: string;
  }>;
}
```

### New Database Requirements

**Table: `belief_history`**
```sql
CREATE TABLE belief_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_id UUID NOT NULL REFERENCES beliefs(id) ON DELETE CASCADE,
  epoch INTEGER NOT NULL,
  aggregate NUMERIC NOT NULL, -- 0-1
  delta_relevance NUMERIC NOT NULL, -- -1 to 1
  certainty NUMERIC NOT NULL, -- 0-1
  disagreement_entropy NUMERIC,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(belief_id, epoch)
);

CREATE INDEX idx_belief_history_belief_epoch ON belief_history(belief_id, epoch DESC);
```

**Table: `pool_history`** (or combine with belief_history)
```sql
CREATE TABLE pool_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address),
  epoch INTEGER NOT NULL,
  token_supply NUMERIC NOT NULL,
  reserve NUMERIC NOT NULL,
  price NUMERIC NOT NULL, -- calculated at snapshot time
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_address, epoch)
);

CREATE INDEX idx_pool_history_pool_epoch ON pool_history(pool_address, epoch DESC);
```

**Table: `user_token_holdings`** (for tracking cost basis)
```sql
CREATE TABLE user_token_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  pool_address TEXT NOT NULL REFERENCES pool_deployments(pool_address),
  token_balance NUMERIC NOT NULL DEFAULT 0,
  total_invested NUMERIC NOT NULL DEFAULT 0, -- cumulative USDC spent
  total_sold NUMERIC NOT NULL DEFAULT 0, -- cumulative USDC received
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pool_address)
);

CREATE INDEX idx_user_holdings_user ON user_token_holdings(user_id);
```

---

## Accessibility

- **Semantic HTML**: `<main>` wrapper, `<article>` for post
- **Heading hierarchy**: h1 for title, h2 for sections, h3 for subsections
- **Tab navigation**:
  - `role="tablist"` on container
  - `role="tab"` on buttons
  - `role="tabpanel"` on panels
  - `aria-selected` on active tab
  - Keyboard navigation (arrow keys)
- **Charts**: Provide data table alternative for screen readers
- **Focus management**: Focus first interactive element on tab change
- **Color contrast**: All text meets WCAG AA (4.5:1)

---

## Performance Optimizations

1. **Lazy load charts**: Only render Analytics tab charts when tab active
2. **Debounce trading input**: Calculate price preview 300ms after input stops
3. **Cache pool data**: Cache for 5 seconds to avoid re-fetching on tab switch
4. **Prefetch history**: Load history data in background while user views Overview
5. **Image optimization**: Lazy load user avatar
6. **Code splitting**: Split chart library into separate chunk

---

## Implementation Notes

- **Component**: `<PostDetailView id={params.id} />`
- **Location**: `src/components/post/PostDetailView.tsx`
- **Page**: `app/post/[id]/page.tsx`
- **Hooks**:
  - `usePost(id)` - Fetch post data
  - `usePoolData(poolAddress)` - Real-time pool sync
  - `useBeliefHistory(beliefId)` - Historical belief data
  - `useTradingInterface()` - Buy/sell logic
- **Chart Library**: Recharts or Chart.js (lightweight)
- **State Management**: React Query for caching + optimistic updates

---

## Edge Cases

1. **Post deleted**: Show 404 state with back button
2. **Belief not yet created**: Show "Belief market pending"
3. **Pool not deployed**: Show "Pool deployment in progress"
4. **Historical data missing**: Show "Insufficient data" in charts
5. **Wallet disconnected mid-trade**: Cancel transaction, show reconnect prompt
6. **Stale pool data**: Show "Syncing..." indicator, auto-refresh every 10s
7. **Chart data gaps**: Interpolate missing epochs or show gaps clearly
8. **Very high token supply**: Handle large numbers gracefully (scientific notation if >1M)
9. **Price too small**: Show more decimal places ($0.00000123) if needed
10. **User has no holdings**: Hide "Your Position" stats gracefully

---

## Future Enhancements

1. **Comments/Discussion**: Add comment thread below tabs
2. **Share button**: Share post link with preview
3. **Bookmark**: Save post for later
4. **Related posts**: Show similar posts based on belief market
5. **Trade history**: User's personal trade log for this pool
6. **Pool leaderboard**: Top holders by token count
7. **Real-time updates**: WebSocket for live price updates
8. **Advanced charts**: Volume bars, candlestick view
9. **Export data**: Download CSV of historical data
10. **Notifications**: Alert user when delta relevance changes significantly

---

**Last Updated**: October 7, 2025
**Status**: Ready for implementation
**Priority**: HIGH
**Dependencies**: Need to implement `belief_history` and `pool_history` tables
