# Trade Flow Architecture Audit

## Current State (As Implemented)

### 1. Trade Execution Flow

```
User clicks "Buy" → useBuyTokens.ts
  ↓
1. Prepare transaction via /api/trades/prepare
   - Gets serialized transaction from server
   - Transaction includes: swap + belief submission (if applicable)
   ↓
2. Sign transaction with wallet
   ↓
3. Send transaction to Solana
   ↓
4. Wait for confirmation
   ↓
5. Record trade via /api/trades/record
   - Inserts into `trades` table
   - Inserts into `implied_relevance_history` table
   - Updates `pool_deployments` table with new state
   - Updates `posts.total_volume`
   ↓
6. invalidatePoolData(postId)
   - Clears PoolDataService cache
   ↓
7. Call onSuccess() callback
   - Bubbles up through component tree
```

### 2. Data Update Flow (After Trade)

**Problem:** Multiple layers trying to refresh data independently

#### Layer 1: useBuyTokens (Hook Level)
- Line 310: `invalidatePoolData(postId)` - Clears PoolDataService cache
- Line 335: Calls `onSuccess()` callback

#### Layer 2: UnifiedSwapComponent (Trade UI)
- Receives `onTradeSuccess` prop
- Line 122-125: Calls parent's `onTradeSuccess()`
- Also calls `refreshBalances()` separately

#### Layer 3: TradingPanel (Container)
- Has its own `handleTradeSuccess` that:
  - Increments `refreshTrigger` state
  - Calls parent's `onTradeSuccess`
- Passes `refreshTrigger` to TradingChartCard

#### Layer 4: TradingChartCard (Chart Component)
- useEffect watches `refreshTrigger`
- When it changes:
  - Calls `refreshTradeHistory()` (for price chart)
  - Calls `refetchRelevance()` (for relevance chart)
  - Sets 1-second timeout to refetch again

#### Layer 5: Feed/Parent Components
- Have their own `handleTradeSuccess` that:
  - Calls `refreshTradeHistory()`
  - Fetches `/api/posts/{id}` to update post data
  - Updates post in feed list

### 3. Data Fetching Hooks

#### useTradeHistory (Price Data)
- **Auto-refresh:** Every 60 seconds (`refreshInterval: 60000`)
- **Manual refresh:** `refresh()` method via SWR `mutate()`
- **Fetches:** `/api/posts/{id}/trades?range={timeRange}`
- **Returns:** Price history, volume data, trade stats

#### useRelevanceHistory (Relevance Data)
- **Auto-refresh:** Every 60 seconds (`refreshInterval: 60000`)
- **Manual refresh:** `refetch()` method via SWR `mutate()`
- **Fetches:** `/api/posts/{id}/history?include=relevance`
- **Returns:** Actual BD relevance + implied relevance from trades

#### usePoolData (Pool State)
- **Service:** PoolDataService (singleton with cache)
- **Auto-refresh:** On cache invalidation
- **Fetches:** `/api/posts/{id}` (includes pool state)

### 4. Database Tables Updated On Trade

1. **trades** - Trade record
2. **implied_relevance_history** - New implied relevance point
3. **pool_deployments** - Pool state (supplies, prices, sqrt prices)
4. **posts** - `total_volume` incremented
5. **belief_submissions** - If initial trade with beliefs
6. **user_pool_balances** - Token holdings (via DB function)

## Problems Identified

### 1. Callback Hell
- onSuccess chains through 4+ layers
- Each layer adds its own refresh logic
- Hard to trace what triggers what

### 2. Redundant Refreshes
- `invalidatePoolData()` in useBuyTokens
- `refreshTradeHistory()` in multiple places
- `refetchRelevance()` with 1-second delayed retry
- Parent components fetching `/api/posts/{id}` again
- **Result:** Same data fetched 3-4 times after one trade

### 3. Mixed Concerns
- useBuyTokens (hook) calling service methods directly
- TradingPanel (container) managing chart refresh state
- Feed component duplicating refresh logic

### 4. Unclear Data Flow
- Is PoolDataService the source of truth?
- Or is it the SWR hooks?
- When does cache invalidation vs refetch happen?

### 5. Timing Issues
- 1-second setTimeout to "catch async DB writes"
- Race conditions between multiple refresh calls
- No guarantee of order

## Architecture Problems

### Problem A: No Single Source of Truth
- PoolDataService caches pool data
- usePoolData wraps it with SWR
- useTradeHistory has separate SWR cache
- useRelevanceHistory has separate SWR cache
- All can be out of sync

### Problem B: Callback Prop Drilling
```
useBuyTokens → UnifiedSwap → TradingPanel → Parent (Feed/PostDetailPage)
                ↓
         Also triggers chart refresh via refreshTrigger
```

### Problem C: Service Layer Confusion
- PoolDataService is a singleton service
- But also has subscription pattern
- Mixed with SWR's caching
- Unclear when to use which

## Recommended Architecture

### Option 1: Event-Driven (Cleanest)
```
Trade Completes
  ↓
Emit "trade_completed" event
  ↓
All interested components listen via EventEmitter
  - TradingChartCard: refetch charts
  - PoolMetricsCard: refetch pool data
  - Feed: update post in list
  - UserBalances: refetch balances
```

### Option 2: SWR-Only (Simplest)
```
Trade Completes
  ↓
Call mutate() on all relevant SWR keys:
  - mutate(`/api/posts/${postId}/trades`)
  - mutate(`/api/posts/${postId}/history`)
  - mutate(`/api/posts/${postId}`)
  - mutate(`/api/users/${userId}/balances`)
  ↓
SWR automatically refetches and updates all components
```

### Option 3: React Query (Most Robust)
- Replace SWR with React Query
- Use query invalidation after mutations
- Better DevTools and debugging
- Cleaner mutation/query separation

## Immediate Fixes Needed

1. **Remove redundant refreshes**
   - Pick ONE refresh mechanism per data type
   - Remove others

2. **Remove refreshTrigger pattern**
   - Use SWR's built-in `mutate()` instead
   - Or use React Context for global refresh

3. **Clean up callback chain**
   - useBuyTokens should handle ALL post-trade updates
   - Remove onSuccess callbacks from components

4. **Document data flow**
   - Which hook fetches what
   - Which API routes update what tables
   - Cache invalidation strategy

5. **Fix PoolDataService**
   - Either use it as source of truth OR remove it
   - Don't mix with SWR caching

## Recommendation

**Short-term (Now):**
- Remove `refreshTrigger` mechanism
- Use SWR `mutate()` in useBuyTokens after trade completes
- Remove all `onSuccess` callback props
- Let SWR auto-refresh handle updates

**Long-term (Next refactor):**
- Consider React Query migration
- Or implement proper event-driven architecture
- Consolidate PoolDataService vs SWR hooks

---

Generated: 2025-10-28


## Changes Implemented (2025-10-28)

### ✅ Removed RefreshTrigger Pattern
- Removed `refreshTrigger` state from `TradingPanel.tsx`
- Removed `refreshTrigger` prop from `TradingChartCard.tsx`
- Removed `refreshTrigger` useEffect with setTimeout delay from `TradingChartCard.tsx`
- Removed `refreshTrigger` state from `PostDetailContent.tsx`

### ✅ Centralized Data Refresh in useBuyTokens
Added SWR `mutate()` calls after trade recording:
```typescript
await Promise.all([
  mutate(`/api/posts/${postId}/trades?range=1H`),
  mutate(`/api/posts/${postId}/trades?range=24H`),
  mutate(`/api/posts/${postId}/trades?range=7D`),
  mutate(`/api/posts/${postId}/trades?range=ALL`),
  mutate(`/api/posts/${postId}/history`),      // Relevance data
  mutate(`/api/posts/${postId}`),              // Pool state
]);
```

### ✅ Removed Callback Chain Complexity
- Removed `handleTradeSuccess` from `PostDetailContent.tsx`
- Simplified `UnifiedSwapComponent` - no longer needs onTradeSuccess
- Kept `onTradeSuccess` in `TradingPanel` only for parent notification
- Simplified `Feed.tsx` handleTradeSuccess to only update feed list

### ✅ Updated Rebase Handler
- Changed `TradingChartCard` rebase success handler to use SWR mutate instead of calling `refetchRelevance()` and `refreshTradeHistory()`

### Result
- Single source of truth for data refresh (SWR mutate in useBuyTokens)
- No more redundant API calls
- No more callback chains through 4+ layers
- Charts auto-update via SWR's reactivity
- 60-second polling still in place for background updates

