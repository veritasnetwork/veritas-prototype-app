# Pool Settlement Service Specification

## Overview

**Per-pool, on-demand settlement** - Each pool settles independently based on its belief's BD relevance score.

**Architecture:** No global epochs. Each pool maintains its own `current_epoch` counter that increments on settlement.

**Settlement Trigger Options:**
1. User-triggered via UI/API (POST /api/pools/settle)
2. Programmatic via edge function (pool-settle-single)
3. Batch settlement via pool-settlement service (legacy, filters by epoch)

**Important Distinction:**
- **BD (Belief Decomposition)** → Determines pool settlement factors (this spec)
- **BTS (Bayesian Truth Serum)** → Determines stake rewards/penalties (separate process)
- **Pool Epoch** → Independent per-pool counter, increments on each settlement

---

## Flow (User-Triggered)

```
Step 1: User triggers belief processing (required before settlement)
  ↓
POST /functions/v1/protocol-belief-epoch-process
  { belief_id: "..." }
  ↓
Backend:
  ├─ Calculate epistemic weights for participants
  ├─ Run BD decomposition → absolute relevance score x ∈ [0, 1]
  ├─ Update beliefs.previous_aggregate = x
  ├─ Record to belief_relevance_history
  ├─ Run BTS scoring + stake redistribution
  └─ Return: { aggregate: x, certainty: c, ... }

Step 2: User triggers pool settlement
  ↓
POST /api/pools/settle
  { postId: "...", walletAddress: "..." }
  ↓
Backend:
  ├─ Fetch belief.previous_aggregate (BD score from Step 1)
  ├─ Check pool.current_epoch (ensure not already settled)
  ├─ Check cooldown (last_settle_ts + min_settle_interval)
  ├─ Build settle_epoch transaction
  ├─ Sign with protocol_authority
  └─ Return serialized tx
  ↓
User signs transaction (pays gas)
  ↓
On-chain: settle_epoch executes
  ├─ Reserves scale by f_L = x/q, f_S = (1-x)/(1-q)
  ├─ pool.current_epoch += 1
  └─ Emit SettlementEvent { epoch: new_epoch, ... }
  ↓
Event Indexer:
  ├─ INSERT INTO settlements (..., epoch)
  ├─ UPDATE pool_deployments SET current_epoch = new_epoch
  └─ Complete audit trail recorded
```

---

## Inputs

From BD (Belief Decomposition) scoring, we need for each belief:
- **`x` (absolute relevance aggregate)** - BD score ∈ [0, 1]
- **NOT delta_relevance** - We don't use deltas anymore
- **NOT BTS score** - BTS is for stake rewards, not pool settlement

Stored in `beliefs` table (existing field):
```sql
ALTER TABLE beliefs ADD COLUMN relevance_aggregate DECIMAL;
-- This is the BD output, range [0, 1]
```

Or in separate table:
```sql
CREATE TABLE bd_relevance_scores (
    id UUID PRIMARY KEY,
    belief_id UUID REFERENCES beliefs(id),
    epoch INTEGER NOT NULL,
    relevance_aggregate DECIMAL NOT NULL,  -- BD score [0, 1]
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(belief_id, epoch)
);
```

---

## Settlement Formula

For each pool, on-chain settlement:

```rust
// 1. Get market prediction
q = R_long / (R_long + R_short)

// 2. Calculate settlement factors
f_long = x / q
f_short = (1 - x) / (1 - q)

// Clamp q to [1%, 99%] to avoid division by zero
q_clamped = clamp(q, 0.01, 0.99)

// 3. Scale reserves (supplies unchanged)
R_long' = R_long × f_long
R_short' = R_short × f_short
```

**Key properties:**
- Token supplies never change
- Only reserves scale
- Zero-sum: R_long' + R_short' = R_long + R_short
- Post-settlement ratio: q' = R_long' / (R_long' + R_short') = x

---

## Implementation: Edge Function

### Location

`supabase/functions/pool-settlement/index.ts`

### Trigger

Called by epoch processing cron **AFTER** BD scoring completes and writes relevance aggregates to `beliefs` table.

### Implementation Steps

1. **Fetch BD Relevance Scores for Current Epoch**
   ```typescript
   const scores = await supabase
     .from('beliefs')
     .select('id, relevance_aggregate')
     .eq('epoch', currentEpoch)
     .not('relevance_aggregate', 'is', null);

   // Or if using separate table:
   // const scores = await supabase
   //   .from('bd_relevance_scores')
   //   .select('belief_id, relevance_aggregate')
   //   .eq('epoch', currentEpoch);
   ```

2. **Map Beliefs to Pools**
   ```typescript
   const pools = await supabase
     .from('pool_deployments')
     .select('pool_address, belief_id')
     .in('belief_id', scores.map(s => s.belief_id));
   ```

3. **Convert Scores to Q32.32 Fixed-Point**
   ```typescript
   const x_score_q32 = Math.floor(score * (1 << 32));
   ```

4. **Call settle_epoch for Each Pool**
   ```typescript
   for (const pool of pools) {
     const score = scores.find(s => s.belief_id === pool.belief_id);
     const x_score = Math.floor(score.score * (1 << 32)); // Q32.32

     await program.methods
       .settleEpoch(x_score)
       .accounts({
         contentPool: new PublicKey(pool.pool_address),
         protocolAuthority: authorityKeypair.publicKey,
         clock: SYSVAR_CLOCK_PUBKEY,
       })
       .signers([authorityKeypair])
       .rpc();
   }
   ```

5. **Index Settlement Events**
   ```typescript
   // Events automatically emitted by smart contract
   // Backend indexer picks them up and records in DB
   ```

6. **Return Results**
   ```typescript
   return {
     epoch: currentEpoch,
     pools_settled: successCount,
     pools_failed: failedPools.length,
     failed_pools: failedPools,
   };
   ```

---

## Integration with Epoch Processing

```
Cron (every 3 hours)
  ↓
1. Run BD scoring
   └─ Calculate absolute relevance per belief
   └─ UPDATE beliefs SET relevance_aggregate
  ↓
2. Call pool-settlement edge function
   └─ Fetch relevance_aggregate from beliefs
   └─ Map to pool_deployments
   └─ Call settle_epoch for each pool
  ↓
3. Event indexer records settlements
   └─ SettlementEvent → INSERT INTO settlements table
```

**Sequence is critical:**
1. BD scoring MUST complete first
2. Settlement service reads from `beliefs.relevance_aggregate`
3. Events are indexed for historical record

---

## Database Schema

### New Tables

```sql
-- Settlement records (output from on-chain events)
CREATE TABLE settlements (
    id UUID PRIMARY KEY,
    pool_address TEXT NOT NULL,
    belief_id UUID REFERENCES beliefs(id),
    epoch INTEGER NOT NULL,
    bd_relevance_score DECIMAL NOT NULL,  -- x value used (from BD scoring)
    market_prediction_q DECIMAL NOT NULL,  -- q before settlement
    f_long DECIMAL NOT NULL,  -- Settlement factor for LONG
    f_short DECIMAL NOT NULL,  -- Settlement factor for SHORT
    tx_signature TEXT UNIQUE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(pool_address, epoch)
);
```

---

## Error Handling

### Critical Errors (Abort Entire Settlement)
- **Solana not configured** (`SOLANA_PROGRAM_ID` missing)
  - Action: Skip with success=true, log warning
  - Rationale: Allow epoch processing to continue

- **Database connection failure**
  - Action: Fail with 500, retry next epoch
  - Rationale: Cannot proceed without data

- **No BD relevance scores found**
  - Action: Skip with success=true, log info
  - Rationale: Nothing to settle

### Non-Critical Errors (Continue with Other Pools)
- **Individual settle_epoch transaction fails**
  - Action: Log error, track failed pool, continue
  - Rationale: Other pools should still settle

- **Pool not found for belief**
  - Action: Skip belief, log warning, continue
  - Rationale: Belief might not have a market yet

### Partial Failure Handling

```typescript
const results = {
  success: [],
  failed: [],
};

for (const pool of pools) {
  try {
    const tx = await settlePool(pool);
    results.success.push({ pool: pool.pool_address, tx });
  } catch (error) {
    results.failed.push({
      pool: pool.pool_address,
      error: error.message
    });
    console.error(`Failed to settle pool ${pool.pool_address}:`, error);
  }
}

return {
  epoch: currentEpoch,
  settled: results.success.length,
  failed: results.failed.length,
  failed_pools: results.failed,
};
```

**Manual retry:** Failed pools can be retried individually via admin endpoint.

---

## Validation

### Input Validation

Before settlement:
- **BD relevance score:** Must be ∈ [0, 1]
  - If out of range: Clamp and log warning
- **Pool exists on-chain:** Verify pool address is valid
  - If not: Skip and log error
- **Epoch not already settled:** Check pool.epoch_index
  - If already settled: Skip with info log

### Post-Settlement Validation (via Events)

Event indexer should verify:
- `f_long × f_short` ≈ constant (sanity check)
- `q' = R_long' / (R_long' + R_short')` ≈ x (convergence check)
- `R_long' + R_short' = R_long + R_short` (conservation check)

If any check fails, alert for investigation.

---

## Transaction Management

### Batching Strategy

**Option 1: Sequential (Simple)**
```typescript
for (const pool of pools) {
  await settlePool(pool);
}
```
- Pros: Simple, clear error handling
- Cons: Slow for many pools (1000 pools = ~10 minutes)

**Option 2: Parallel Batches (Recommended)**
```typescript
const BATCH_SIZE = 10;
for (let i = 0; i < pools.length; i += BATCH_SIZE) {
  const batch = pools.slice(i, i + BATCH_SIZE);
  await Promise.allSettled(batch.map(settlePool));
}
```
- Pros: Fast (1000 pools = ~1 minute)
- Cons: Need Promise.allSettled for error handling
- **Recommendation:** Use this for production

### RPC Limits

- **Rate limit:** Typical RPC ~50 req/sec
- **Batch size:** 10 concurrent requests is safe
- **Retry logic:** Exponential backoff on rate limit errors

---

## Monitoring & Alerts

### Metrics to Track

1. **Settlement success rate**
   - Target: >99% pools settle successfully
   - Alert if <95%

2. **Settlement duration**
   - Target: <2 minutes for 1000 pools
   - Alert if >5 minutes

3. **Failed pools**
   - Target: 0 failed pools
   - Alert if any failures

4. **BD relevance score distribution**
   - Track min/max/avg scores per epoch
   - Alert on anomalies (all 0 or all 1)

### Logging

```typescript
console.log(`[SETTLEMENT] Epoch ${epoch} starting`);
console.log(`[SETTLEMENT] Found ${pools.length} pools to settle`);
console.log(`[SETTLEMENT] Settled ${successCount}/${pools.length} pools`);
console.log(`[SETTLEMENT] Failed pools: ${JSON.stringify(failedPools)}`);
console.log(`[SETTLEMENT] Duration: ${duration}ms`);
```

---

## Comparison to Old Design

| Old Design | New Design |
|------------|-----------|
| Cross-pool redistribution | Independent settlement |
| Delta relative relevance | Absolute BD relevance scores |
| ProtocolTreasury shuttles USDC | No USDC transfers between pools |
| Penalty/reward calculations | Simple factor multiplication |
| Two-phase (penalty then reward) | Single-phase (settle) |
| Complex edge cases (no winners) | No edge cases |

---

## Security Considerations

### Authority Control
- Only protocol authority can call `settle_epoch`
- Authority keypair stored securely (KMS or env var)
- No user can trigger settlement

### Oracle Trust
- BD relevance scores come from centralized backend
- Trust assumption: Backend provides honest scores
- Future: Could add multi-sig or governance

### Replay Protection
- On-chain check: pool.epoch_index prevents double-settlement
- If settle_epoch called twice for same epoch: Transaction fails

### Rate Limiting
- Service should have cooldown between calls
- Prevent spam/DOS via rate limiting at edge function level

---

## Testing Checklist

### Unit Tests
- [x] BD score conversion to Q32.32
- [x] Pool mapping (belief_id → pool_address)
- [x] Error handling for missing pools
- [x] Error handling for invalid scores

### Integration Tests
- [ ] Deploy test pools on devnet
- [ ] Trigger settlement with mock BD scores
- [ ] Verify on-chain state changes
- [ ] Verify events are emitted correctly

### E2E Tests
- [ ] Full epoch cycle (BD → settlement → indexing)
- [ ] Multiple pools settle correctly
- [ ] Failed settlement retry logic
- [ ] Event indexer records all data

---

## Deployment Checklist

- [ ] Create `supabase/functions/pool-settlement/index.ts`
- [ ] Configure Solana RPC URL in env
- [ ] Configure protocol authority keypair in KMS
- [ ] Deploy edge function to Supabase
- [ ] Add cron trigger (every 3 hours)
- [ ] Set up monitoring/alerts
- [ ] Test on devnet first
- [ ] Gradual rollout to mainnet

---

## Future Enhancements

### Optimizations
- WebSocket subscriptions for real-time settlement events
- Transaction compression for lower costs
- Priority fees for faster confirmation

### Features
- Admin endpoint for manual settlement retry
- Settlement preview (dry-run mode)
- Historical settlement analytics dashboard
- Automated alerting on settlement failures