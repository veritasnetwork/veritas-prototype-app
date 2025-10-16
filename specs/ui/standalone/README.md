# Standalone Components

These components are designed for reuse across the app. All accept data via props and manage their own internal state.

---

## Design Principles

All standalone components must:
- ✅ Accept all required data via props (no tight coupling)
- ✅ Manage their own internal state
- ✅ Handle their own loading and error states
- ✅ Have fully documented TypeScript prop interfaces
- ✅ Work at multiple sizes (responsive)
- ✅ Be independently testable

---

## Existing Components

### PoolMetricsCard

**Status:** ✅ Implemented
**File:** `src/components/post/PostDetailPanel/PoolMetricsCard.tsx`
**Used In:** Feed.tsx (right panel when post selected)

#### Description
Compact horizontal strip displaying pool metrics with dividers between sections.

#### Props
```typescript
interface PoolMetricsCardProps {
  currentPrice: number;          // Token price in USDC
  marketCap: number;             // Total market cap (price × supply)
  totalSupply: number;           // Total token supply (display units)
  reserveBalance: number;        // USDC reserve balance (display units)
  priceChangePercent24h?: number; // 24h price change percentage
  totalVolume?: number;          // 24h trading volume (USDC)
}
```

#### Features
- Displays: Price, 24h change%, Market Cap, Supply, Reserve, Volume
- Compact number formatting (1.23k, 2.45m)
- Color-coded 24h change (green for positive, red for negative)
- Responsive horizontal scroll on mobile

#### Usage
```tsx
<PoolMetricsCard
  currentPrice={poolData.currentPrice}
  marketCap={poolData.marketCap}
  totalSupply={poolData.totalSupply}
  reserveBalance={poolData.reserveBalance}
  priceChangePercent24h={stats?.priceChangePercent24h}
  totalVolume={stats?.totalVolume}
/>
```

#### API Dependencies
- Parent must provide data (no direct API calls)
- Typically paired with `useTradeHistory` for stats

---

### UnifiedSwapComponent

**Status:** ✅ Implemented
**File:** `src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx`
**Used In:** Feed.tsx (right panel when post selected)

#### Description
Compact trading interface with buy/sell mode toggle for bonding curve token trading.

#### Props
```typescript
interface UnifiedSwapComponentProps {
  poolAddress: string;           // Solana pool address
  postId: string;                // Post UUID
  currentPrice: number;          // Current token price
  totalSupply: number;           // Total supply (display units)
  reserveBalance: number;        // Reserve (display units)
  reserveBalanceRaw: number | string; // Raw reserve (atomic units)
  kQuadratic: number;            // Bonding curve parameter
  onTradeSuccess?: () => void;   // Callback after successful trade
}
```

#### Features
- ✅ Buy/sell mode toggle
- ✅ Amount input with validation
- ✅ Balance display (USDC & tokens)
- ✅ MAX button (fills available balance)
- ✅ Real-time bonding curve calculations
- ✅ Transaction preview modal
- ✅ Minimum received (0.5% slippage protection)
- ✅ Transaction execution via useBuyTokens/useSellTokens hooks

#### Design Decisions
- **No rate display:** Rate is implicit in the conversion amounts shown
- **No price impact warning:** Keeps UI clean; conversion shows the actual deal
- **Fixed slippage:** 0.5% hardcoded (no user adjustment needed for simplicity)

#### Usage
```tsx
<UnifiedSwapComponent
  poolAddress={selectedPost.poolAddress}
  postId={selectedPost.id}
  currentPrice={poolData.currentPrice}
  totalSupply={poolData.totalSupply}
  reserveBalance={poolData.reserveBalance}
  reserveBalanceRaw={selectedPost.poolReserveBalance}
  kQuadratic={selectedPost.poolKQuadratic || 1}
  onTradeSuccess={handleTradeSuccess}
/>
```

#### API Dependencies
- Solana RPC (direct) - Fetch wallet balances
- POST `/api/trades/record` - Record trade after execution

---

### TradingChartCard

**Status:** ✅ Implemented
**File:** `src/components/post/PostDetailPanel/TradingChartCard.tsx`
**Used In:** Feed.tsx (right panel when post selected)

#### Description
Price and volume chart card with time range selector using lightweight-charts library.

#### Props
```typescript
interface TradingChartCardProps {
  postId: string;  // Post UUID for fetching trade data
}
```

#### Features
- Time range selector (1H, 24H, 7D, ALL)
- Price line chart (blue line)
- Volume histogram bars (green for buys, red for sells)
- Auto-refresh every 30 seconds via SWR
- Loading skeleton
- Empty state ("No trades yet")
- Responsive chart sizing

#### Usage
```tsx
<TradingChartCard postId={selectedPost.id} />
```

#### API Dependencies
- `GET /api/posts/[postId]/trades?range={timeRange}` (via useTradeHistory hook)
- Returns `{ priceData, volumeData, stats }`

#### Technical Details
- Uses `lightweight-charts` library
- Chart height: 400px
- Handles duplicate timestamps by adding millisecond offsets
- Cleans up chart instance on unmount

---

### BeliefScoreCard

**Status:** ✅ Implemented (Not Currently Used)
**File:** `src/components/post/PostDetailPanel/BeliefScoreCard.tsx`
**Used In:** None (belief data not yet available from protocol)

#### Description
Simple card displaying community belief score with participant and stake information.

#### Props
```typescript
interface BeliefScoreCardProps {
  yesPercentage: number;      // Percentage who believe it's true
  totalParticipants: number;  // Number of participants
  totalStake: number;         // Total USDC staked
}
```

#### Features
- Shows belief percentage prominently
- Displays participant count and total stake
- Simple horizontal layout

#### Status
Blocked on protocol integration. Waiting for belief aggregation data from Veritas Protocol epoch processing.

#### Usage (when data available)
```tsx
<BeliefScoreCard
  yesPercentage={75}
  totalParticipants={42}
  totalStake={1250.50}
/>
```

---

### PostDetailContent

**Status:** ✅ Implemented (Basic)
**File:** `src/components/post/PostDetailPanel/PostDetailContent.tsx`
**Used In:** Feed.tsx (commented out), can be used in modal overlays

#### Description
Full post content display component with close button. Shows post metadata, content, and media.

#### Props
```typescript
interface PostDetailContentProps {
  postId: string;  // Post UUID to fetch
}
```

#### Features
- Fetches post data from `/api/posts/[id]`
- Displays post title, author, timestamp
- Renders Tiptap rich text content
- Shows media (images/videos) if present
- Close button (calls PanelProvider.closePanel)
- Loading spinner
- Error state with retry option

#### NOT Integrated
- ❌ PoolMetricsCard
- ❌ UnifiedSwapComponent
- ❌ TradingChartCard

**Note:** Feed.tsx shows these trading components in a separate right panel, NOT inside PostDetailContent.

#### Usage
```tsx
<PostDetailContent postId={selectedPostId} />
```

#### API Dependencies
- `GET /api/posts/[id]` - Fetches post with author and pool data

---

## Component Architecture

### Current Implementation (Feed.tsx)

Feed uses a **two-column split-panel design**:

```
┌─────────────────────────────────────────────────────────┐
│                        Feed                              │
├──────────────────────────┬──────────────────────────────┤
│  Posts Column (left)     │  Detail Panel (right)        │
│                          │  (shown when post selected)  │
│  ┌────────────────────┐  │                              │
│  │ PostCard           │  │  ┌────────────────────────┐  │
│  └────────────────────┘  │  │ TradingChartCard       │  │
│  ┌────────────────────┐  │  └────────────────────────┘  │
│  │ PostCard (selected)│  │  ┌────────────────────────┐  │
│  └────────────────────┘  │  │ PoolMetricsCard        │  │
│  ┌────────────────────┐  │  └────────────────────────┘  │
│  │ PostCard           │  │  ┌────────────────────────┐  │
│  └────────────────────┘  │  │ UnifiedSwapComponent   │  │
│                          │  └────────────────────────┘  │
└──────────────────────────┴──────────────────────────────┘
```

**Key Points:**
- Left column: Scrollable feed of posts (680px width)
- Right column: Trading interface appears when post is selected
- Desktop only (mobile shows posts full-width)
- Components are siblings, not nested

### Alternative: PostDetailPanel (Not Primary Pattern)

```
PostDetailPanel (overlay modal - currently unused)
└─ PostDetailContent
   └─ Just shows post content, no trading components
```

This overlay pattern exists but is **not the primary implementation**. Feed's split-panel is preferred.

---

## Component Reusability Matrix

| Component | Type | Currently Used | Potential Future Use |
|-----------|------|----------------|---------------------|
| **PoolMetricsCard** | Standalone | Feed (right panel) | Profile, Leaderboard, Analytics, Mobile quick view |
| **UnifiedSwapComponent** | Standalone | Feed (right panel) | Quick Trade Modal, Mobile Trading Sheet, Dashboard |
| **TradingChartCard** | Standalone | Feed (right panel) | Analytics Page, Portfolio View, Post History |
| **BeliefScoreCard** | Standalone | Not used | Protocol Dashboard, Epoch Review, Post Detail |
| **PostDetailContent** | Standalone | Not used in Feed | Overlay Modal, Fullscreen View, Shareable Links |

---

## Creating New Standalone Components

When creating a new standalone component:

1. **Design with reusability in mind**
   - All data via props, no parent coupling
   - Optional variants via props (compact, minimal, etc.)

2. **Document thoroughly**
   - Props interface with JSDoc comments
   - Usage examples in multiple contexts
   - API dependencies clearly listed

3. **Add to this file**
   - Component description
   - Props interface
   - Features and limitations
   - Usage examples

4. **Consider responsive behavior**
   - Mobile, tablet, desktop breakpoints
   - Horizontal scroll or stack layout

---

**Last Updated:** October 14, 2025
