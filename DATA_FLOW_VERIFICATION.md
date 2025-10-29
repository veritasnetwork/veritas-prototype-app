# Data Flow Verification: Recording & Updates

## Question: Is all data still recorded and updated after trades with 60s polling?

**Answer: YES ✅** - Here's the complete verification:

---

## 1. Data Recording (Server-Side)

### useBuyTokens → `/api/trades/record`
**Recording happens at:** `src/hooks/useBuyTokens.ts:263-307`

The `/api/trades/record` route calls `record_trade_atomic` database function which:
1. ✅ Inserts into `trades` table
2. ✅ Updates `user_pool_balances` (token holdings)
3. ✅ Updates `posts.total_volume`
4. ✅ Inserts into `implied_relevance_history`
5. ✅ Updates `pool_deployments` (pool state)
6. ✅ Creates/updates `belief_submissions` (if applicable)

**Verified at:** `app/api/trades/record/route.ts:253` (RPC call)
**Database function:** `record_trade_atomic` (Postgres function with transaction safety)

### useSellTokens → `/api/trades/record`
**Recording happens at:** `src/hooks/useSellTokens.ts:238-275`

Uses same `/api/trades/record` endpoint → same database writes as above ✅

### useRebasePool → `/api/settlements/record`
**Recording happens at:** `src/hooks/useRebasePool.ts:120-139`

Records settlement to `settlements` table ✅

---

## 2. Data Updates (Client-Side)

### Immediate Updates After Trade (SWR mutate)

#### useBuyTokens
**Location:** `src/hooks/useBuyTokens.ts:315-322`
```typescript
await Promise.all([
  mutate(`/api/posts/${postId}/trades?range=1H`),
  mutate(`/api/posts/${postId}/trades?range=24H`),
  mutate(`/api/posts/${postId}/trades?range=7D`),
  mutate(`/api/posts/${postId}/trades?range=ALL`),
  mutate(`/api/posts/${postId}/history`),      // Relevance chart
  mutate(`/api/posts/${postId}`),              // Pool state
]);
```

#### useSellTokens
**Location:** `src/hooks/useSellTokens.ts:283-290`
```typescript
await Promise.all([
  mutate(`/api/posts/${postId}/trades?range=1H`),
  mutate(`/api/posts/${postId}/trades?range=24H`),
  mutate(`/api/posts/${postId}/trades?range=7D`),
  mutate(`/api/posts/${postId}/trades?range=ALL`),
  mutate(`/api/posts/${postId}/history`),
  mutate(`/api/posts/${postId}`),
]);
```

#### useRebasePool
**Location:** `src/hooks/useRebasePool.ts:145-153`
```typescript
await Promise.all([
  mutate(`/api/posts/${postId}/trades?range=1H`),
  mutate(`/api/posts/${postId}/trades?range=24H`),
  mutate(`/api/posts/${postId}/trades?range=7D`),
  mutate(`/api/posts/${postId}/trades?range=ALL`),
  mutate(`/api/posts/${postId}/history`),
  mutate(`/api/posts/${postId}`),
  mutate(`/api/posts/${postId}/rebase-status`),
]);
```

**Result:** All components using these SWR hooks will immediately re-render with fresh data ✅

### Background Polling (60-second refresh)

#### useTradeHistory (Price Chart Data)
**Location:** `src/hooks/api/useTradeHistory.ts:60`
```typescript
refreshInterval: 60000, // Refresh every 60 seconds
```

#### useRelevanceHistory (Relevance Chart Data)
**Location:** `src/hooks/api/useRelevanceHistory.ts:85`
```typescript
refreshInterval: 60000, // Refresh every 60 seconds
```

**Result:** Even if immediate refresh fails, data will be fresh within 60 seconds ✅

---

## 3. What Components Automatically Update?

### Components Using SWR Hooks (Auto-Update)

1. **TradingChartCard**
   - Uses: `useTradeHistory()` → price chart
   - Uses: `useRelevanceHistory()` → relevance chart
   - Updates: Immediately after trade + every 60s

2. **PoolMetricsCard**
   - Uses: `usePoolData()` via PoolDataService
   - Updates: Immediately via `invalidatePoolData()` + SWR mutate

3. **Feed Component**
   - Uses: `useTradeHistory()` for stats
   - Updates: Immediately + every 60s
   - Also: Manual fetch in `handleTradeSuccess` to update feed list

4. **UnifiedSwapComponent**
   - Receives fresh pool data from parent
   - Parent uses `usePoolData()` which updates immediately

---

## 4. Data Flow Timeline

```
User clicks "Buy/Sell"
  ↓
1. Transaction sent to Solana
  ↓
2. Transaction confirmed
  ↓
3. useBuyTokens/useSellTokens calls /api/trades/record
  ↓
4. Database writes complete:
   - trades table
   - user_pool_balances
   - posts.total_volume
   - implied_relevance_history
   - pool_deployments
  ↓
5. invalidatePoolData(postId) clears service cache
  ↓
6. SWR mutate() called for all relevant endpoints
  ↓
7. ALL components using those hooks re-fetch
  ↓
8. UI updates with fresh data
  ↓
[60 seconds later]
  ↓
9. SWR auto-refresh fetches again (background polling)
```

---

## 5. Verification Checklist

✅ **Data Recording**
- [x] Buy trades recorded to database
- [x] Sell trades recorded to database
- [x] Settlements recorded to database
- [x] Balances updated atomically
- [x] Pool state updated
- [x] Implied relevance tracked

✅ **Immediate Updates (via SWR mutate)**
- [x] Price charts refresh
- [x] Relevance charts refresh
- [x] Pool metrics refresh
- [x] Feed data refreshes

✅ **Background Polling**
- [x] useTradeHistory polls every 60s
- [x] useRelevanceHistory polls every 60s

✅ **All Trading Hooks Updated**
- [x] useBuyTokens.ts
- [x] useSellTokens.ts
- [x] useRebasePool.ts

---

## 6. What If Something Fails?

### If immediate SWR mutate fails:
- Background 60s polling will catch it ✅

### If recording fails:
- Transaction still succeeded on-chain
- Event indexer will pick it up later ✅
- Non-critical error, doesn't fail trade

### If network request fails:
- SWR has retry logic ✅
- Next poll in 60s will get fresh data ✅

---

## Summary

**YES**, all data is:
1. ✅ **Recorded to database** via `/api/trades/record` and `/api/settlements/record`
2. ✅ **Updated immediately** via SWR `mutate()` calls after trades/settlements
3. ✅ **Polled every 60 seconds** as a safety net

The architecture is now **clean, reliable, and redundant** (in a good way).

---

Generated: 2025-10-28
