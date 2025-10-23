# Pool Rebase Flow

## Overview

The **rebase** feature allows users to trigger belief-specific epoch processing and pool settlement with a single button click. This combines BD (Belief Decomposition) scoring with stake redistribution and on-chain settlement.

## Flow Architecture

```
User clicks "Rebase Pool" button in TradingChartCard
  ↓
POST /api/posts/[postId]/rebase (Next.js API Route)
  ↓
Server-side:
  1. Authenticate user (Privy)
  2. Validate pool exists and is market_deployed
  3. Check settlement cooldown
  4. Call protocol-belief-epoch-process (Supabase Edge Function)
     → Calculate weights (w_i from user_pool_balances.belief_lock)
     → Run BD decomposition → absolute relevance score
     → Run BTS scoring with new belief_weights
     → Run stake redistribution (ΔS = score × w_i)
     → Update belief.previous_aggregate
  5. Build settle_epoch transaction
     → Convert BD score to Q32.32 fixed-point
     → Protocol authority partially signs
  6. Return serialized transaction + metadata
  ↓
Client-side:
  7. User signs transaction with embedded wallet
  8. Send to Solana blockchain
  9. Wait for confirmation
  10. Event indexer picks up SettlementExecuted event
  11. Updates pool_deployments.current_epoch
  12. Records settlement in settlements table
  13. UI refreshes with new BD score and pool state
```

## Dual Signing Pattern

**Why two signatures?**
- **Protocol Authority**: Signs to certify the BD score (prevents users from faking relevance scores)
- **User Wallet**: Signs as fee payer (user pays gas, maintains decentralization)

This ensures trustless settlement where:
- Users can't manipulate BD scores
- Users pay for their own transactions
- Protocol maintains authority over scoring

## Implementation

### 1. API Endpoint

**`POST /api/posts/[id]/rebase`**

Request:
```typescript
{
  walletAddress: string  // User's Solana wallet address
}
```

Response:
```typescript
{
  success: true,
  transaction: string,        // Base64 serialized tx (partially signed)
  beliefId: string,
  bdScore: number,            // New BD relevance score [0, 1]
  poolAddress: string,
  currentEpoch: number,
  stakeChanges: {
    totalRewards: number,     // Total USDC rewarded
    totalSlashes: number,     // Total USDC slashed
    participantCount: number
  }
}
```

Error (429 - Cooldown):
```typescript
{
  error: "Settlement cooldown active. Please wait 5m 30s before rebasing.",
  remainingSeconds: 330,
  minInterval: 3600
}
```

Error (400 - Insufficient New Submissions):
```typescript
{
  error: "Insufficient new activity. Need at least 2 new unique belief submissions since last settlement (found 1).",
  minNewSubmissions: 2,
  currentNewSubmissions: 1,
  lastSettlementEpoch: 5
}
```

### 2. React Hook

**`useRebasePool()`**

```typescript
const { rebasePool, isRebasing, error } = useRebasePool();

const result = await rebasePool(postId);
// Returns: { success, txSignature?, bdScore?, stakeChanges?, error? }
```

### 3. UI Component

**`TradingChartCard`** now includes:
- Green "Rebase" button with refresh icon
- Loading state ("Rebasing...")
- Disabled during rebase operation
- Success/error alerts with BD score and stake changes

## Stake Redistribution (New Model)

Uses **belief weights** instead of effective stakes:

```
w_i = belief_lock = 2% × last_buy_amount

ΔS_i = information_score_i × w_i

Where:
- information_score_i ∈ [-1, 1] (from BTS scoring)
- w_i = fixed weight based on last trade amount
- ΔS_i = stake change (positive = reward, negative = slash)
```

### Zero-Sum Property

```
Σ ΔS_i = Σ (score_i × w_i) = 0

This is enforced by BTS scoring:
Σ score_i × weight_i = 0
```

## Rebase Constraints

### 1. Cooldown Mechanism
- **Min Settle Interval**: Configurable per pool (default: 1 hour)
- **Enforcement**: Server-side check before allowing rebase
- **Error Handling**: Returns 429 status with remaining time
- **Purpose**: Prevents spam and gives time for beliefs to accumulate

### 2. Minimum New Submissions
- **Min New Submissions**: Configurable via `system_config.min_new_submissions_for_rebase` (default: 2)
- **Enforcement**: Server-side check counting unique new submitters since last settlement
- **Error Handling**: Returns 400 status with current count
- **Purpose**: Ensures there's meaningful new data to process before rebasing
- **Implementation**: Counts unique `agent_id`s in `belief_submissions` where `epoch > last_settlement_epoch`
- **Configuration**: Update via SQL: `UPDATE system_config SET value = '3' WHERE key = 'min_new_submissions_for_rebase'`

## Error Cases

| Error | Status | Reason |
|-------|--------|--------|
| Not authenticated | 401 | Missing/invalid Privy token |
| Pool not found | 404 | No pool_deployment for post |
| Pool not deployed | 400 | Pool status ≠ market_deployed |
| Cooldown active | 429 | Time since last settlement < min_settle_interval |
| Insufficient new submissions | 400 | New unique submissions < min_new_submissions_for_rebase (system_config) |
| Insufficient participants | 400 | Less than 2 total participants in belief |
| No BD score | 400 | Epoch processing failed to produce score |
| Authority mismatch | 500 | Protocol authority ≠ factory.poolAuthority |
| Transaction failed | 500 | On-chain settlement reverted |

## Testing Checklist

- [ ] Test rebase with 2+ participants
- [ ] Test cooldown enforcement (time-based)
- [ ] Test minimum new submissions enforcement (activity-based)
- [ ] Test rebase blocked when no new submissions
- [ ] Test BD score updates after rebase
- [ ] Test stake redistribution (winners/losers)
- [ ] Test settlement event indexing
- [ ] Test pool.current_epoch increments
- [ ] Test error handling (cooldown, insufficient submissions, etc.)
- [ ] Test UI updates after successful rebase
- [ ] Test transaction signing flow with embedded wallet

## Files Modified/Created

**Created:**
- `/app/api/posts/[id]/rebase/route.ts` - API endpoint
- `/src/hooks/useRebasePool.ts` - React hook
- `/REBASE_FLOW.md` - This documentation

**Modified:**
- `/src/components/post/PostDetailPanel/TradingChartCard.tsx` - Added rebase button

**Related:**
- `/supabase/functions/protocol-belief-epoch-process/index.ts` - Epoch processing
- `/supabase/functions/protocol-weights-calculate/index.ts` - Uses belief_weights
- `/supabase/functions/protocol-beliefs-stake-redistribution/index.ts` - ΔS = score × w_i
- `/app/api/pools/settle/route.ts` - Original settlement endpoint (no epoch processing)

## Future Improvements

1. **Auto-rebase**: Cron job to automatically rebase pools on schedule
2. **Rebase notifications**: Alert users when rebase is ready
3. **Cooldown timer**: Show countdown in UI for next rebase
4. **Batch rebase**: Rebase multiple pools at once
5. **Transaction batching**: Combine multiple rebases into one transaction
6. **Gas optimization**: Optimize instruction size and compute units

---

**Status**: ✅ Implementation complete, ready for testing

**Last Updated**: 2025-10-22
