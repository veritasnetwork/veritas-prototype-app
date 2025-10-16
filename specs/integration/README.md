# Integration Guide

Documentation of how UI components integrate with API endpoints and each other.

---

## Component → API Mapping

### Feed.tsx (Primary Implementation)

**File:** `src/components/feed/Feed.tsx`

#### Data Flow

```
User clicks PostCard
    ↓
handlePostClick(postId)
    ↓
Load cached post from feed data
    ↓
Background fetch: GET /api/posts/[id]
    ↓
Display right panel with three components:
    ├─ TradingChartCard
    ├─ PoolMetricsCard
    └─ UnifiedSwapComponent
```

#### Component Integration Details

**TradingChartCard** (lines 191-193)
- **Props:** `postId={selectedPostId}`
- **API:** `GET /api/posts/[id]/trades?range={timeRange}` (via useTradeHistory)
- **Renders:** Price line chart + volume histogram
- **Refresh:** Auto-refresh every 30s via SWR

**PoolMetricsCard** (lines 196-205)
- **Props:** Pool data from parent + stats from tradeHistory
- **Data Source:** Parent calculates from `selectedPost.poolTokenSupply`, etc.
- **Stats From:** `tradeHistory.stats` (priceChange24h, totalVolume)
- **API:** None directly (uses parent's data + stats from TradingChartCard)

**UnifiedSwapComponent** (lines 208-221)
- **Props:** Pool data from parent + callbacks
- **API:**
  - Solana RPC (direct) - Fetch wallet balances via useSwapBalances
  - `POST /api/trades/record` - Record trade after execution
- **Hooks:** `useBuyTokens`, `useSellTokens`, `useSwapBalances`
- **Callback:** `onTradeSuccess={() => handleTradeSuccess()}`

#### State Management

```typescript
// Selected post state
const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
const [selectedPost, setSelectedPost] = useState<Post | null>(null);

// Pool data calculation
const poolData = selectedPost?.poolTokenSupply !== undefined
  ? formatPoolData(selectedPost.poolTokenSupply, selectedPost.poolReserveBalance, selectedPost.poolKQuadratic)
  : null;

// Trade history for stats
const { data: tradeHistory, refresh: refreshTradeHistory } = useTradeHistory(selectedPostId || undefined, '24H');
```

---

## Data Flow: Trading

Complete flow from user input to database record:

```
1. User enters amount in UnifiedSwapComponent
        ↓
2. Calculate tokens using bonding curve
   - calculateBuyAmount() or calculateSellAmount()
   - Display estimated output amount
        ↓
3. Show preview modal
   - Input amount
   - Output amount
   - Minimum received (with 0.5% slippage)
        ↓
4. User confirms
        ↓
5. useBuyTokens / useSellTokens hook
   - Build Solana transaction
   - Sign with Privy wallet
        ↓
6. Submit transaction to Solana blockchain
        ↓
7. Wait for confirmation
        ↓
8. POST /api/trades/record
   - Record trade details in database
   - Save: amounts, supply/reserve after, tx signature
        ↓
9. Trigger callbacks
   - refreshBalances() in useSwapBalances
   - onTradeSuccess() passed from parent
        ↓
10. Parent (Feed.tsx) refreshes
    - Fetch updated post data: GET /api/posts/[id]
    - Refresh trade history for chart
    - Update UI with new balances
```

---

## Data Flow: Post Detail View

```
User clicks PostCard in feed
    ↓
Feed.handlePostClick(postId)
    ↓
Set selectedPostId + use cached post data
    ↓
Background: fetch(`/api/posts/${postId}`)
    ↓
API Route: /api/posts/[id]
    ├─ Fetch from database
    ├─ Auto-sync pool if >10s stale
    │  └─ Query Solana chain
    │     └─ Update pool_deployments table
    ├─ Transform to PostAPIResponse
    └─ Validate with Zod schema
    ↓
Update selectedPost state
    ↓
Right panel renders with fresh data
    ├─ TradingChartCard fetches trades
    ├─ PoolMetricsCard displays metrics
    └─ UnifiedSwapComponent fetches balances
```

---

## Type Transformations

### Database → API Response

**Location:** `app/api/posts/[id]/route.ts` (lines 164-199)

**Transformations:**
- `snake_case` → `camelCase` (mostly)
- `created_at` (string) → `createdAt` (string)
- `user_id` (uuid) → `authorId` (uuid)
- Nested `users` relation → `author` object
- Pool data: `token_supply` (string) → `poolTokenSupply` (number)
- Parse strings to numbers for pool data

**Validation:**
- `PostAPIResponseSchema.parse(transformedPost)`
- Dev mode: logs warning, returns data anyway
- Prod mode: returns 500 error on validation failure

### API Response → Frontend Type

**Location:** `src/services/posts.service.ts` (lines 94-141)

**Transformations:**
- API response → `Post` type (from `@/types/post.types`)
- Adds computed fields: `relevanceScore`, `signals`
- Transforms ISO strings → `Date` objects
- Adds default values for missing fields
- Formats belief data (aggregate percentage)

### Frontend Type → Display

**Location:** Components (PoolMetricsCard, UnifiedSwapComponent, etc.)

**Transformations:**
- Atomic units → Display units (÷ 1,000,000)
- Micro-USDC → Dollars (÷ 1,000,000)
- Number formatting (k/m suffixes)
- Price precision (4-6 decimals)
- Date formatting (relative time)

---

## Component Reusability

### Current Usage Matrix

| Component | Standalone | Currently Used In | Potential Future Use |
|-----------|-----------|-------------------|----------------------|
| **PoolMetricsCard** | ✅ Yes | Feed (right panel) | Profile page, Leaderboard, Analytics dashboard, Mobile quick view |
| **UnifiedSwapComponent** | ✅ Yes | Feed (right panel) | Quick Trade Modal, Mobile Trading Sheet, Dashboard widget |
| **TradingChartCard** | ✅ Yes | Feed (right panel) | Analytics Page, Portfolio View, Post History, Embedded charts |
| **BeliefScoreCard** | ✅ Yes | Not used | Protocol Dashboard, Epoch Review page, Post Detail (when data available) |
| **PostDetailContent** | ✅ Yes | Not used in Feed | Overlay Modal, Fullscreen View, Shareable post links |

### Component Dependencies

```
Feed.tsx
├─ usePosts() → GET /functions/v1/app-post-get-feed
├─ handlePostClick() → Set selectedPostId
│
└─ When post selected:
   ├─ GET /api/posts/[id] (background refresh)
   │
   ├─ TradingChartCard
   │  └─ useTradeHistory()
   │     └─ GET /api/posts/[id]/trades
   │
   ├─ PoolMetricsCard
   │  ├─ Props from parent (pool data)
   │  └─ Props from tradeHistory.stats
   │
   └─ UnifiedSwapComponent
      ├─ useSwapBalances() → Solana RPC (direct)
      ├─ useBuyTokens() / useSellTokens()
      │  └─ POST /api/trades/record
      └─ onTradeSuccess() → Refresh parent + balances
```

---

## API Response Schemas

All API responses are validated using Zod schemas from `src/types/api.ts`:

### Posts API

**GET /api/posts/[id]**
- Schema: `PostAPIResponseSchema`
- Validation: Yes (as of Phase 1)
- Type: `PostAPIResponse`

**GET /api/posts/[id]/trades**
- Schema: `TradeHistoryResponseSchema`
- Validation: Yes (as of Phase 1)
- Type: `TradeHistoryResponse`

**GET /api/posts/[id]/history**
- Schema: Not yet defined
- Validation: No
- Type: Implicit

### Trades API

**POST /api/trades/record**
- Request Schema: `TradeRecordRequestSchema`
- Response: `{ success: true }`
- Validation: Request body (partial)

---

## Hooks Usage

### Data Fetching Hooks

**usePosts()** - `src/hooks/api/usePosts.ts`
- Fetches feed posts from edge function
- Used by: Feed.tsx
- API: `POST /functions/v1/app-post-get-feed`
- Returns: `{ posts, loading, error, refetch }`

**useTradeHistory()** - `src/hooks/api/useTradeHistory.ts`
- Fetches trade history for charting
- Used by: TradingChartCard
- API: `GET /api/posts/[id]/trades?range={timeRange}`
- Returns: `{ data, isLoading, error, refresh }`
- Features: SWR caching, auto-refresh every 30s, Zod validation

**useSwapBalances()** - `src/hooks/useSwapBalances.ts`
- Fetches user's USDC and token balances from Solana
- Used by: UnifiedSwapComponent
- API: Solana RPC (direct connection)
- Returns: `{ usdcBalance, shareBalance, loading, refresh }`

### Transaction Hooks

**useBuyTokens()** - `src/hooks/useBuyTokens.ts`
- Builds and executes buy transaction
- Used by: UnifiedSwapComponent
- Flow: Build tx → Sign → Submit to Solana → Record in DB
- Returns: `{ buyTokens, loading }`

**useSellTokens()** - `src/hooks/useSellTokens.ts`
- Builds and executes sell transaction
- Used by: UnifiedSwapComponent
- Flow: Build tx → Sign → Submit to Solana → Record in DB
- Returns: `{ sellTokens, loading }`

---

## Error Handling Patterns

### API Errors

All API routes return errors in standard format:
```json
{
  "error": "Human-readable message",
  "details": "Optional additional details",
  "code": "ERROR_CODE"
}
```

### Component Error States

**Feed.tsx:**
- Loading: Full-screen spinner with animated dots
- Error: Centered error card with "Refresh Page" button

**TradingChartCard:**
- Loading: Skeleton placeholder
- Error: Empty state with message
- No data: "No trades yet" message

**UnifiedSwapComponent:**
- Validation: Red border + inline message
- Transaction error: Toast notification (via useBuyTokens/useSellTokens)
- Balance loading: "..." placeholder

---

## Performance Considerations

### Caching Strategy

**SWR Configuration:**
- `revalidateOnFocus: false` - Don't refetch on window focus
- `refreshInterval: 30000` - Auto-refresh every 30s (trade history)
- `dedupingInterval: 1000` - Dedupe requests within 1s
- `keepPreviousData: true` - Show stale data while revalidating

**Pool Data Sync:**
- API route auto-syncs if >10s stale
- Reduces unnecessary Solana RPC calls
- Updates database for other consumers

### Data Flow Optimization

**Feed.tsx optimizations:**
1. Use cached post from feed immediately (instant UI update)
2. Background refresh for latest data (stale-while-revalidate)
3. Only refresh changed post in feed list (avoid full refetch)

**Component independence:**
- Each component fetches its own data
- No prop drilling through multiple levels
- Easy to add/remove components without breaking others

---

## Future Enhancements

### Planned Integrations

1. **Real-time Updates**
   - WebSocket connection for live price updates
   - Push notifications for trade executions
   - Live belief score updates during epochs

2. **Optimistic Updates**
   - Update UI before API confirms
   - Rollback on error
   - Faster perceived performance

3. **Infinite Scroll**
   - Paginated feed loading
   - Cursor-based pagination
   - Virtual scrolling for large lists

4. **Advanced Caching**
   - Service worker for offline support
   - IndexedDB for persistent cache
   - Prefetch next page of posts

---

**Last Updated:** October 14, 2025
