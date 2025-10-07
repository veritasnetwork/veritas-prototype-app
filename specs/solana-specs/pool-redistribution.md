# Pool Redistribution Service Specification

## Overview

Backend service that runs after epoch processing to apply penalties and rewards to ContentPools on Solana based on belief relevance changes.

## Flow

```
Epoch Processing Completes
  ↓
Epoch processing outputs: certainty + delta_relevance per belief
  ↓
Pool Redistribution Service
  ↓
Phase 1: Apply Penalties (Δr ≤ 0 pools → Treasury)
Phase 2: Apply Rewards (Treasury → Δr > 0 pools)
```

## Inputs

From epoch processing, we need for each belief:
- **`certainty`** - From Learning Assessment (range: [0, 1])
- **`delta_relevance`** - Current aggregate - previous aggregate (range: [-1, 1])

These should be written to the `beliefs` table during epoch processing.

## Penalty Rate Formula

```typescript
if (deltaR < 0) {
  penaltyRate = Math.min(Math.abs(deltaR) * certainty, 0.10)  // Cap at 10%
} else if (deltaR === 0) {
  penaltyRate = baseSkimRate  // Default 1%
} else {
  penaltyRate = 0  // No penalty for rising pools
}
```

## Reward Distribution Formula

```typescript
// Calculate impact = deltaR × certainty for each pool with deltaR > 0
const positivePools = pools.filter(p => p.deltaR > 0)
const impacts = positivePools.map(p => p.deltaR * p.certainty)
const totalImpact = sum(impacts)

// Normalize to probability simplex
reward[i] = (penaltyPot × impact[i]) / totalImpact
```

## Edge Case: No Winners

If no pools have deltaR > 0:
- Collect all penalties
- Store in `system_config.epoch_rollover_balance`
- Add to next epoch's penalty pot
- Skip reward phase

## Implementation: Edge Function

### Location

`supabase/functions/pool-redistribution/index.ts`

### Trigger

Called by epoch processing cron **AFTER** epoch processing completes and writes `certainty` + `delta_relevance` to beliefs table.

### Implementation Steps

1. **Fetch & Validate Pools**
   - Query `pool_deployments` joined with `beliefs` (only confirmed pools)
   - Validate certainty ∈ [0, 1], delta_relevance ∈ [-1, 1], reserve ≥ 0
   - Skip invalid pools with warnings

2. **Calculate Penalties**
   - For each valid pool, calculate penalty rate using formula
   - Accumulate total penalty pot (including rollover from previous epoch)

3. **Calculate Rewards**
   - Filter pools with Δr > 0
   - Calculate impact = Δr × certainty for each
   - Normalize to probability simplex for reward distribution

4. **Update Rollover (BEFORE transactions)**
   - If winners exist: Reset rollover to 0
   - If no winners: Update rollover to accumulated penalty pot
   - **Critical**: This must happen before Step 5/6 to prevent double-spending on retry

5. **Apply Penalties**
   - Call `applyPoolPenalty` for each pool with Δr ≤ 0
   - Track failures separately, continue on error

6. **Apply Rewards**
   - Call `applyPoolReward` for each pool with Δr > 0
   - Track failures separately, continue on error

7. **Return Results**
   - Return counts of successful/failed penalties and rewards
   - Include failed pool addresses for manual retry if needed


## Integration with Epoch Processing

Called by `protocol-epochs-process` after all belief processing completes:

1. **Epoch processing** writes `certainty` and `delta_relevance` to `beliefs` table
2. **Pool redistribution** reads from `beliefs` table (via join with `pool_deployments`)
3. **Pool redistribution** applies penalties and rewards on Solana

## Input Validation

Before processing, validate:
- `certainty` ∈ [0, 1] (fail if null or out of range)
- `delta_relevance` ∈ [-1, 1] (fail if null or out of range)
- `reserve` ≥ 0 (skip pool if invalid)

## Error Handling

### Critical Errors (Abort)
- Solana not configured (`SOLANA_PROGRAM_ID` missing) → Skip with success=true
- Database connection failure → Fail with 500
- Config values missing → Use defaults (base_skim_rate=0.01, rollover=0)

### Non-Critical Errors (Continue)
- Individual pool penalty/reward transaction fails → Log error, track failed pools, continue
- Rollover balance update fails → Log warning, continue (epoch processing continues)

### Partial Failure Handling
- Track failed penalty/reward transactions separately
- Return both successful and failed transaction counts
- Allow manual retry of failed transactions

## Database Consistency

**Rollover Update Timing**: Update `epoch_rollover_balance` BEFORE applying rewards to prevent double-spending on retry:

```typescript
// 1. Update rollover first (idempotent)
if (totalPositiveImpact > 0) {
  await supabase.from('system_config').update({ value: '0' }).eq('key', 'epoch_rollover_balance')
} else {
  await supabase.from('system_config').update({ value: penaltyPot.toString() }).eq('key', 'epoch_rollover_balance')
}

// 2. Then apply transactions (can retry safely)
applyPenalties()
applyRewards()
```
