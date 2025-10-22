# Pool Sync Service

## Overview
Centralized service for syncing pool state from Solana blockchain to Supabase database. Provides multiple sync strategies (blocking, non-blocking, retry) with proper error handling and timeout management.

## Context
- **Layer:** Infrastructure / Services
- **Location:** `src/services/pool-sync.service.ts`
- **Used By:** Trade recording, pool deployment, admin operations, UI refresh
- **Dependencies:** Supabase Edge Function (`sync-pool-state`)
- **Status:** Implemented

---

## High-Level Design

### Flow
1. Caller requests pool sync (after trade, deployment, or manual refresh)
2. Service calls Supabase Edge Function `sync-pool-state`
3. Edge function fetches pool state from Solana
4. Edge function updates `pool_deployments` table
5. Service returns success/failure result
6. Caller handles result based on sync strategy

### State Changes
- **pool_deployments:** Updated with latest on-chain state
  - `token_supply`, `reserve`, `sqrt_price_long_x96`, `sqrt_price_short_x96`
  - `price_long`, `price_short`, `last_synced_at`

### Key Decisions
- **Centralized logic:** All pool syncs go through this service (no direct edge function calls)
- **Multiple strategies:** Blocking (retry), non-blocking (fire-and-forget), batch
- **Timeout handling:** Default 10s timeout prevents hanging
- **Error propagation:** Configurable throw vs return error
- **Exponential backoff:** Retry with increasing delays (1s, 2s, 4s)

---

## Implementation

### PoolSyncService Class

**Static class** (no instance creation needed)

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for edge function auth |

---

## Methods

### syncPool

**Signature:**
```typescript
static async syncPool(
  poolAddress: string,
  options: { throwOnError?: boolean; timeout?: number } = {}
): Promise<PoolSyncResult>
```

**Options:**
- `throwOnError`: If true, throw on error. If false, return error in result. Default: `false`
- `timeout`: Request timeout in milliseconds. Default: `10000` (10 seconds)

**Returns:**
```typescript
interface PoolSyncResult {
  success: boolean;
  poolAddress: string;
  error?: string;
}
```

**Flow:**

1. **Validate configuration:**
   - Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` exist
   - If missing:
     - Log error: "[PoolSyncService] Configuration error"
     - If `throwOnError` → throw Error
     - Else → return `{ success: false, poolAddress, error }`

2. **Create abort controller:**
   - `new AbortController()`
   - Set timeout: `setTimeout(() => controller.abort(), timeout)`

3. **Call edge function:**
   - POST to `{SUPABASE_URL}/functions/v1/sync-pool-state`
   - Headers:
     - `Content-Type: application/json`
     - `Authorization: Bearer {SERVICE_KEY}`
   - Body: `{ pool_address: poolAddress }`
   - Signal: `controller.signal` (for timeout)

4. **Clear timeout:**
   - `clearTimeout(timeoutId)`

5. **Check response:**
   - If `!response.ok`:
     - Read error text
     - Throw Error: "Sync failed ({status}): {errorText}"
   - If ok:
     - Parse JSON result
     - Log success: "[PoolSyncService] Pool synced successfully: {address}"

6. **Return success:**
   - `{ success: true, poolAddress }`

**Error Handling:**
- Timeout → AbortError thrown, caught below
- Network error → Error thrown, caught below
- Edge function error → Error thrown, caught below
- Catch block:
  - Extract error message
  - Log error: "[PoolSyncService] Sync error: {poolAddress, error}"
  - If `throwOnError` → re-throw
  - Else → return `{ success: false, poolAddress, error }`

---

### syncAfterTrade

**Signature:**
```typescript
static async syncAfterTrade(poolAddress: string): Promise<void>
```

**Purpose:** Non-blocking sync after trade execution (fire-and-forget)

**Flow:**

1. **Call syncPool:**
   - `throwOnError = false`
   - Don't await (fire and forget)

2. **Catch errors:**
   - Log warning: "[PoolSyncService] Background sync failed (non-critical)"
   - Don't throw (trade already succeeded)

3. **Return immediately:**
   - Method returns void
   - Sync happens in background

**Usage:**
```typescript
// After recording trade
await recordTrade(trade);

// Sync in background (don't wait)
PoolSyncService.syncAfterTrade(poolAddress);

// Continue immediately
return { success: true };
```

**Rationale:**
- Trade already recorded in DB
- Pool state sync is nice-to-have, not critical
- Don't block user on sync failure
- UI can refresh pool state separately if needed

---

### syncAfterDeployment

**Signature:**
```typescript
static async syncAfterDeployment(
  poolAddress: string,
  maxRetries: number = 3
): Promise<PoolSyncResult>
```

**Purpose:** Blocking sync with retry after pool/market deployment (critical for UX)

**Flow:**

1. **Initialize retry loop:**
   - `lastError: string | undefined`
   - Loop from `attempt = 1` to `maxRetries`

2. **For each attempt:**
   a. Log: "[PoolSyncService] Sync attempt {attempt}/{maxRetries} for {address}"
   b. Call `syncPool(poolAddress, { throwOnError: false })`
   c. If `result.success` → return result immediately (exit loop)
   d. Store `lastError = result.error`
   e. If not last attempt:
      - Calculate delay: `min(1000 * 2^(attempt-1), 5000)` ms
      - Exponential backoff: 1s, 2s, 4s (capped at 5s)
      - Wait: `await new Promise(resolve => setTimeout(resolve, delay))`

3. **If all retries failed:**
   - Return: `{ success: false, poolAddress, error: "Failed after {maxRetries} attempts: {lastError}" }`

**Backoff Schedule:**
- Attempt 1: immediate
- Attempt 2: wait 1s (2^0 * 1000ms)
- Attempt 3: wait 2s (2^1 * 1000ms)
- Attempt 4: wait 4s (2^2 * 1000ms)
- Max wait: 5s

**Usage:**
```typescript
// After deploying market
const txSignature = await deployMarket(...);

// Sync with retry (block until success or all retries fail)
const result = await PoolSyncService.syncAfterDeployment(poolAddress, 3);

if (result.success) {
  return { poolAddress, txSignature };
} else {
  // Still return success (deployment succeeded, sync just failed)
  console.warn('Pool deployed but sync failed:', result.error);
  return { poolAddress, txSignature, syncWarning: result.error };
}
```

**Rationale:**
- Initial pool state critical for UI display
- User expects to see pool immediately after deployment
- Retry handles transient network/RPC issues
- Even if sync fails, deployment succeeded (return with warning)

---

### syncMultiplePools

**Signature:**
```typescript
static async syncMultiplePools(
  poolAddresses: string[],
  options: { throwOnError?: boolean } = {}
): Promise<PoolSyncResult[]>
```

**Purpose:** Sync multiple pools in parallel

**Flow:**

1. **Map addresses to promises:**
   - `promises = poolAddresses.map(address => this.syncPool(address, options))`

2. **Execute in parallel:**
   - `return Promise.all(promises)`

3. **Return array of results:**
   - Each result: `{ success, poolAddress, error? }`
   - Results returned in same order as input addresses

**Usage:**
```typescript
// Sync all pools for a user
const poolAddresses = userPools.map(p => p.pool_address);
const results = await PoolSyncService.syncMultiplePools(poolAddresses);

const successful = results.filter(r => r.success).length;
console.log(`Synced ${successful}/${results.length} pools`);
```

**Error Handling:**
- If `throwOnError = true`: First failure throws, aborts remaining syncs
- If `throwOnError = false`: All syncs attempted, errors in results

---

### syncAllPools

**Signature:**
```typescript
static async syncAllPools(): Promise<{ success: boolean; error?: string }>
```

**Purpose:** Admin operation to sync ALL pools in database

**Flow:**

1. **Validate configuration:**
   - Check credentials exist
   - If missing → return `{ success: false, error: 'Missing Supabase configuration' }`

2. **Call edge function with empty body:**
   - POST to `{SUPABASE_URL}/functions/v1/sync-pool-state`
   - Headers: Same as syncPool
   - Body: `{}` (empty body signals sync all)

3. **Check response:**
   - If `!response.ok`:
     - Read error text
     - Throw Error: "Sync all failed ({status}): {errorText}"
   - If ok:
     - Parse JSON result
     - Log: "[PoolSyncService] All pools synced: {result}"

4. **Return success:**
   - `{ success: true }`

**Error Handling:**
- Catch all errors
- Log: "[PoolSyncService] Sync all error: {error}"
- Return: `{ success: false, error: errorMessage }`

**Usage:**
```typescript
// Admin panel or CLI
const result = await PoolSyncService.syncAllPools();

if (result.success) {
  console.log('All pools synced successfully');
} else {
  console.error('Sync all failed:', result.error);
}
```

**Performance:**
- Edge function handles pagination and rate limiting
- Syncs all pools in `pool_deployments` table
- Can take several minutes for large datasets

---

## Sync Strategies

### When to Use Each Method

| Scenario | Method | Rationale |
|----------|--------|-----------|
| After user trade | `syncAfterTrade()` | Non-blocking, UI can show optimistic state |
| After pool deployment | `syncAfterDeployment()` | Critical for UX, retry ensures reliability |
| After market deployment | `syncAfterDeployment()` | Critical for UX, retry ensures reliability |
| User clicks "Refresh" | `syncPool()` with `throwOnError: false` | Show error to user if fails |
| Batch admin sync | `syncMultiplePools()` or `syncAllPools()` | Parallel for efficiency |
| Settlement processing | `syncPool()` with `throwOnError: true` | Critical path, need to know if fails |

---

## Error Handling

### Error Types

| Error | Cause | Handling |
|-------|-------|----------|
| "Missing Supabase configuration" | Env vars not set | Return error or throw based on options |
| "Sync failed (500): ..." | Edge function error | Return error or throw based on options |
| AbortError | Timeout (>10s) | Return error or throw based on options |
| Network error | No internet / DNS | Return error or throw based on options |

### Error Messages

**Configuration Error:**
```
[PoolSyncService] Configuration error: Missing Supabase configuration
```

**Sync Error:**
```
[PoolSyncService] Sync error: { poolAddress: "ABC123...", error: "Sync failed (500): Pool not found" }
```

**Background Sync Warning:**
```
[PoolSyncService] Background sync failed (non-critical): Sync failed (504): Gateway timeout
```

**Success:**
```
[PoolSyncService] Pool synced successfully: ABC123...
```

---

## Integration with Edge Function

### Edge Function: `sync-pool-state`

**Location:** `supabase/functions/sync-pool-state/index.ts`

**Input (POST body):**
```typescript
{
  pool_address?: string  // If omitted, syncs all pools
}
```

**Flow:**
1. If `pool_address` provided → sync single pool
2. If omitted → sync all pools in `pool_deployments` table
3. For each pool:
   - Fetch account data from Solana
   - Parse pool state
   - Update `pool_deployments` table
4. Return success or error

**Output:**
```typescript
{
  success: boolean;
  poolsSynced?: number;  // For sync all
  error?: string;
}
```

**Error Handling:**
- Pool not found on-chain → return error
- RPC failure → return error
- Database update failure → return error
- All errors include descriptive messages

---

## Performance Considerations

### Timeouts

**Default timeout:** 10 seconds
- Prevents hanging on slow RPC nodes
- Allows time for Solana RPC call + DB update
- Can be increased for batch operations

**Recommended timeouts:**
- Single pool: 10s (default)
- Multiple pools: 30s
- Sync all: 300s (5 minutes)

### Rate Limiting

**Solana RPC:**
- Free tier: ~100 req/s
- Service pool sync counts as 1 RPC call per pool
- Batch operations may hit rate limits

**Edge Function:**
- Supabase free tier: 500,000 invocations/month
- Each sync = 1 invocation
- No built-in rate limiting in service (rely on edge function)

### Optimization

**Caching:**
- No caching (state changes frequently)
- UI can cache for 5-10s to reduce sync frequency

**Batching:**
- Use `syncMultiplePools()` instead of multiple `syncPool()` calls
- Parallel execution with `Promise.all()`

**Retry strategy:**
- Only retry critical operations (deployments)
- Non-critical syncs (after trade) → no retry

---

## Monitoring & Logging

### Log Levels

**Info (console.log):**
- "Pool synced successfully: {address}"
- "All pools synced: {result}"
- "Sync attempt {N}/{M} for {address}"

**Warning (console.warn):**
- "Background sync failed (non-critical): {error}"

**Error (console.error):**
- "Configuration error: {error}"
- "Sync error: {details}"
- "Sync all error: {error}"

### Metrics to Track

- **Sync success rate:** % of successful syncs
- **Sync latency:** Time from request to completion
- **Retry rate:** % of syncs requiring retry
- **Timeout rate:** % of syncs hitting timeout
- **Error types:** Count by error message

### Alerts

**High Priority:**
- Sync success rate < 90%
- All retries failing for deployments
- Configuration errors (env vars missing)

**Medium Priority:**
- Sync latency > 15s (may indicate RPC issues)
- Timeout rate > 10%

---

## Edge Cases

| Condition | Handling |
|-----------|----------|
| Pool not yet on-chain | Edge function returns error, service returns `{ success: false, error }` |
| Pool closed/archived | Edge function updates state correctly (including closed status) |
| RPC node down | Timeout after 10s, retry if using `syncAfterDeployment()` |
| Concurrent syncs for same pool | Edge function handles with database locking |
| Sync during settlement | No conflict, settlement updates different fields |
| Invalid pool address | Edge function validates, returns error |
| Supabase credentials wrong | Return error immediately (no network call) |

---

## Testing

### Critical Paths

1. **Successful sync:**
   - Call `syncPool()` with valid address
   - Verify: `{ success: true }`
   - Check DB: pool state updated

2. **Sync with retry:**
   - Call `syncAfterDeployment()` with flaky RPC
   - First attempt fails, second succeeds
   - Verify: Returns success after retry

3. **Timeout:**
   - Call `syncPool()` with slow RPC
   - Verify: Returns error after 10s
   - Check: AbortError handled correctly

4. **Non-blocking sync:**
   - Call `syncAfterTrade()`
   - Verify: Returns immediately (void)
   - Mock edge function to fail
   - Verify: Warning logged, no throw

5. **Batch sync:**
   - Call `syncMultiplePools()` with 5 addresses
   - Mock: 3 succeed, 2 fail
   - Verify: Returns 5 results, 3 success, 2 error

6. **Sync all:**
   - Call `syncAllPools()`
   - Verify: Edge function called with empty body
   - Check: All pools in DB updated

7. **Missing config:**
   - Unset env vars
   - Call `syncPool()`
   - Verify: Returns error, doesn't throw

### Test Implementation
- **Test Spec:** `specs/test-specs/services/pool-sync.test.md`
- **Test Code:** `tests/services/pool-sync.test.ts`

### Validation
- Unit tests with mocked fetch
- Integration tests with test edge function
- E2E tests with real Solana devnet
- Timeout tests with delayed responses
- Retry logic validation

---

## Deployment Considerations

### Environment Setup

**Required environment variables:**
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Edge function deployment:**
```bash
supabase functions deploy sync-pool-state
```

**Verify edge function:**
```bash
curl -X POST https://xxx.supabase.co/functions/v1/sync-pool-state \
  -H "Authorization: Bearer SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"pool_address":"POOL_ADDRESS"}'
```

### Deployment Checklist

- [ ] Deploy `sync-pool-state` edge function
- [ ] Set environment variables in deployment platform
- [ ] Verify edge function responds (health check)
- [ ] Test sync with known pool address
- [ ] Monitor sync success rate after deployment
- [ ] Set up alerts for sync failures

---

## Security Considerations

### Access Control

**Who can trigger syncs:**
- Server-side API routes (authenticated)
- Admin users (via admin panel)
- Automated processes (cron, webhooks)

**Edge function auth:**
- Requires `SUPABASE_SERVICE_ROLE_KEY`
- Never exposed to client
- Rotate key quarterly

### Data Validation

**Pool address:**
- Validated by edge function (Solana PublicKey format)
- Invalid addresses return error (no DB write)

**State updates:**
- Overwrite with on-chain truth
- No user input (data from blockchain only)

### Rate Limiting

**Service layer:**
- No rate limiting (rely on edge function)
- Could add client-side debouncing for UI refresh

**Edge function:**
- Consider adding rate limiting for public endpoints
- Service role key bypasses Supabase rate limits

---

## Future Enhancements

### Potential Improvements

**WebSocket subscriptions:**
- Real-time pool state updates via account subscriptions
- Eliminate need for manual syncs
- Reduce RPC load

**Caching layer:**
- Redis cache for recently synced pools
- TTL: 5-10 seconds
- Invalidate on trade/settlement events

**Priority queue:**
- Queue sync requests
- Prioritize user-facing syncs over batch
- Handle bursts gracefully

**Diff-based updates:**
- Only update changed fields
- Reduce database write load

**Metrics dashboard:**
- Track sync performance
- Identify slow pools or RPC issues

---

## References
- Code: `src/services/pool-sync.service.ts`
- Edge function: `supabase/functions/sync-pool-state/index.ts`
- Used by: `app/api/trades/prepare/route.ts`, `app/api/pools/deploy/route.ts`
- Related: `specs/services/event-processor.md`, `specs/edge-function-specs/04-solana-sync-functions.md`
