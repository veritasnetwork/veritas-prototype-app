# Stake Mechanics: How It Actually Works

**Date:** 2025-01-22
**Status:** ✅ Final Design (Ready to Implement)
**Purpose:** Single source of truth for stake/lock mechanics

**See also:**
- [BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md](./BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md) - λ-scaled redistribution design
- [OPEN-IMPLEMENTATION-QUESTIONS.md](./OPEN-IMPLEMENTATION-QUESTIONS.md) - All implementation decisions

---

## Units & Precision

**All monetary values are stored as signed 64-bit integers in micro-USDC:**
- 1 USDC = 1,000,000 micro-USDC
- On-chain (Solana): All token amounts are u64 in micro-USDC
- Database: `agents.total_stake`, `user_pool_balances.belief_lock` → stored in micro-USDC (INTEGER)
- Client/UI: Convert to floating-point USDC only at display layer

**Example:**
- Database: `total_stake = 10000000` (10 USDC)
- Database: `belief_lock = 20000` (0.02 USDC = 2% of $1 trade)
- UI Display: `$10.00` and `$0.02`

---

## The Two Numbers

### 1. Global Stake (per user)
```sql
agents.total_stake  -- ONE number across all pools (micro-USDC, INTEGER)
```

**Changes via:**
- `+` Skims on buys (when needed to cover locks)
- `+` BTS rewards (informative beliefs)
- `-` BTS penalties (uninformative beliefs)
- `-` Withdrawals

**Implementation:** [agents table](../../supabase/migrations/)

---

### 2. Per-Pool Lock (per user per pool per side)
```sql
user_pool_balances.belief_lock  -- ONE number per (pool, side) position (micro-USDC, INTEGER)
```

**Key:** Locks are keyed by `(user_id, pool_address, token_type)` where `token_type ∈ {LONG, SHORT}`

**Represents:**
- Voice in that pool's consensus (epistemic weight)
- Max BTS loss for that belief (when score = -1)
- Required coverage from global stake

**Value:** `0.02 × last_buy_amount` in micro-USDC (per side: LONG or SHORT)
- Example: Buy $500 worth → lock = 500 × 1,000,000 × 0.02 = 10,000,000 micro-USDC ($10)

**Aggregation:** For BTS and solvency checks, LONG + SHORT locks are **summed** (gross, not net)
- User can have both LONG and SHORT positions in same pool
- Total pool lock = LONG lock + SHORT lock
- Example: $500 LONG + $300 SHORT = $16 total lock ($10 + $6)
- **Why gross?** BTS score is sign-agnostic; both sides exposed to same consensus process

**Implementation:**
- Schema: [user_pool_balances](../../supabase/migrations/20251024000004_add_belief_locks_to_balances.sql)
- **Migration Required:** Add `token_type TEXT CHECK (token_type IN ('LONG', 'SHORT'))`
- **Primary Key:** `(user_id, pool_address, token_type)` - allows separate LONG and SHORT positions

---

## The Invariant

```
total_stake ≥ Σ(belief_lock WHERE token_balance > 0)
```

**Enforced at:**
- **Buy trades:** Skim calculated to maintain invariant ([calculate-skim.ts](../../src/lib/stake/calculate-skim.ts))
- **Withdrawals:** Reject if `amount > (total_stake - Σ locks)` ([withdraw.rs](../../solana/veritas-curation/programs/veritas-curation/src/veritas_custodian/instructions/withdraw.rs))

**Can violate temporarily:**
- **After BTS epoch:** Stakes change but locks don't → can go underwater
- **Self-healing:** Next trade or closing positions restores solvency
- **Allowed:** Users can have `withdrawable < 0` (negative withdrawable) temporarily
- **Guarantee:** With λ-scaled redistribution, `stake ≥ 0` always (max loss = Σ locks)

---

## On Buy

**File:** [calculate-skim.ts](../../src/lib/stake/calculate-skim.ts)

```typescript
// ALL VALUES IN MICRO-USDC (integers)

// 1. Get current global stake (micro-USDC)
const currentStakeMicro = agents.total_stake  // Already in micro-USDC

// 2. Get total of *all* active locks (micro-USDC)
const totalLocksMicro = Σ(belief_lock WHERE token_balance > 0)

// 3. Identify the lock that will be replaced (0 if no existing position on this side)
const oldLockThisSide = getLock(userId, poolAddress, side)  // side = 'LONG' | 'SHORT'

// 4. Existing locks after replacement but before adding the new one
const existingLocksMicro = totalLocksMicro - oldLockThisSide

// 5. New lock for this buy (micro-USDC)
const newLockMicro = Math.floor(tradeAmountMicro × 0.02)

// 6. Required stake to maintain invariant
const requiredStakeMicro = existingLocksMicro + newLockMicro

// 7. Skim if the user is short
const skimMicro = Math.max(0, requiredStakeMicro - currentStakeMicro)

// 8. Update global stake (atomic)
agents.total_stake += skimMicro

// 9. Update/replace per-pool lock for this side
user_pool_balances.belief_lock = newLockMicro  // REPLACED, not added!
user_pool_balances.last_buy_amount = tradeAmountMicro
user_pool_balances.token_type = side  // 'LONG' or 'SHORT'
```

**Key insights:**
- Lock for this pool/side is **REPLACED**, not accumulated
- `belief_lock` is always `0.02 × last_buy_amount` for the most recent open trade on that side
- Earlier partial buys are subsumed by latest price-time priority
- Skim auto-collateralizes - no need to reject trades for insufficient stake

**Concurrency protection:**
- Wrap calculate-skim + DB update in a Postgres transaction
- Use `SELECT ... FOR UPDATE` on `agents` row to prevent race conditions
- Filter locks by `token_type` to only replace the correct side (LONG or SHORT)
- Without this: two buys in same block could both read `oldLockThisSide` before either updates it
- Example race:
  ```
  Thread A: reads oldLock=10M μUSDC, calculates skim for newLock=20M μUSDC
  Thread B: reads oldLock=10M μUSDC, calculates skim for newLock=15M μUSDC
  Thread A: updates lock to 20M, charges skim
  Thread B: updates lock to 15M, charges skim (WRONG - should be 5M)
  ```

**On-chain:** [trade.rs:117-140](../../solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/trade.rs#L117-L140)

**Recording:** [trades/record/route.ts:188-213](../../app/api/trades/record/route.ts#L188-L213)

---

## On Sell

**File:** [trades/record/route.ts:240-266](../../app/api/trades/record/route.ts#L240-L266)

```typescript
// 1. Decrease token balance
user_pool_balances.token_balance -= tokenAmount

// 2. Lock stays unchanged during sell
// belief_lock NOT updated

// 3. If position fully closed (token_balance = 0):
//    - Auto-delete the row to free the lock
DELETE FROM user_pool_balances
WHERE user_id = ? AND pool_address = ? AND token_type = ?
  AND token_balance = 0 AND belief_lock = 0
```

**Key change:** Auto-cleanup when position closes (prevents table bloat)

---

## On BTS Epoch

**File:** [protocol-beliefs-stake-redistribution](../../supabase/functions/protocol-beliefs-stake-redistribution/index.ts)

### Current Implementation (BROKEN)

```typescript
// Calculate BTS scores (how informative was each belief?)
score = -1 to +1

// Calculate stake changes (NORMALIZED WEIGHTS - BROKEN)
stake_change = score × (your_lock / total_locks)

// Update stakes
agents.total_stake += stake_change

// Locks unchanged
```

**The Bug:** Normalized weights divide losses across everyone:
```
Your lock: 10M μUSDC
Your max loss: 10M ÷ 50 = 200k μUSDC ($0.20)
Gap: 9.8M unaccounted for → insolvency
```

---

### The Fix: λ-Scaled Redistribution

**Required inputs:**
- `belief_id` → look up `pool_address` via `pool_deployments.belief_id`
- `information_scores` (map of agent_id → BTS score)
- **Remove** `belief_weights` parameter (compute from DB locks instead)

```typescript
// ALL VALUES IN MICRO-USDC (integers)

// 0. Acquire per-pool advisory lock (prevent concurrent epochs)
await supabase.rpc('pg_advisory_lock', { lock_id: hashPoolAddress(poolAddress) })

try {
  // 1. Fetch pool_address from belief_id
  const { data: pool } = await supabase
    .from('pool_deployments')
    .select('pool_address')
    .eq('belief_id', beliefId)
    .single()

  if (!pool) throw new Error(`No pool found for belief ${beliefId}`)
  const poolAddress = pool.pool_address

  // 2. Get gross lock per user (sum LONG + SHORT) - micro-USDC
  const { data: userLocks } = await supabase
    .from('user_pool_balances')
    .select('user_id, belief_lock, token_type')
    .eq('pool_address', poolAddress)
    .gt('token_balance', 0)

  const grossLocksMicro = new Map<string, number>()
  for (const row of userLocks) {
    const current = grossLocksMicro.get(row.user_id) || 0
    grossLocksMicro.set(row.user_id, current + row.belief_lock)  // Sum LONG + SHORT
  }

  // 3. Calculate raw deltas (absolute weights, not normalized) - micro-USDC
  const agentDeltas = agentIds.map(id => ({
    agentId: id,
    score: informationScores[id],
    lockMicro: grossLocksMicro.get(id) || 0,
    rawMicro: Math.floor(informationScores[id] * (grossLocksMicro.get(id) || 0))
  }))

  // 4. Separate winners and losers - micro-USDC
  const lossesMicro = sum(agentDeltas.filter(d => d.rawMicro < 0).map(d => Math.abs(d.rawMicro)))
  const gainsMicro = sum(agentDeltas.filter(d => d.rawMicro > 0).map(d => d.rawMicro))

  // 5. Calculate scaling factor
  const lambda = gainsMicro > 0 ? lossesMicro / gainsMicro : 0

  // 6. Apply scaled deltas - micro-USDC
  const finalDeltas = agentDeltas.map(d => ({
    agentId: d.agentId,
    deltaMicro: d.rawMicro > 0 ? Math.floor(d.rawMicro * lambda) : d.rawMicro
  }))

  // 7. HARD-ENFORCE zero-sum (fail if violated)
  const totalDeltaMicro = sum(finalDeltas.map(d => d.deltaMicro))
  if (Math.abs(totalDeltaMicro) > 1) {  // Tolerance: 1 micro-USDC
    throw new Error(`Zero-sum violated: Σ Δ = ${totalDeltaMicro} μUSDC`)
  }

  // 8. Update stakes ATOMICALLY (prevents concurrent epoch races)
  for (const {agentId, deltaMicro} of finalDeltas) {
    if (deltaMicro === 0) continue

    await supabase.rpc('update_stake_atomic', {
      p_agent_id: agentId,
      p_delta_micro: deltaMicro
    })
    // SQL: UPDATE agents SET total_stake = GREATEST(0, total_stake + p_delta_micro)
  }

  // 9. Locks stay unchanged (no clearing/re-locking!)

} finally {
  // Release advisory lock
  await supabase.rpc('pg_advisory_unlock', { lock_id: hashPoolAddress(poolAddress) })
}
```

**Result:**
- Losers pay full: `delta = score × lock` (max loss = lock when score = -1)
- Winners share pot: `delta = (score × lock) × λ` (scaled down to match total losses)
- Zero-sum enforced: `Σ finalDeltas = 0` (hard-fail if |Σ| > 1 μUSDC)
- Locks unchanged: only change on buy trades
- Solvency guaranteed: `stake ≥ 0` always (max loss = Σ locks)
- Atomic updates: prevents lost updates from concurrent epochs
- Advisory lock: only one redistribution per pool at a time

**Edge cases:**
- All winners (G>0, L=0): λ=0, no redistribution
- All losers (L>0, G=0): λ=0, no redistribution
- No participants: Skip redistribution, log `info: "BTS skip – no active locks"`
- Zero-sum violation: **ABORT** entire redistribution (fail-safe)

See [BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md](./BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md) for full design rationale.

---

## Solvency Scenarios

### Scenario 1: Profitable Trading
```
T0: Buy $500 in Pool A
  stake: 10M μUSDC, locks: {A: 10M}, withdrawable: 0

T1: BTS reward +5M μUSDC
  stake: 15M, locks: {A: 10M}, withdrawable: 5M ✅

T2: Buy $500 in Pool B
  stake: 15M, locks: {A: 10M, B: 10M}, withdrawable: 0
  skim: 5M (only top-up needed, not full 2%)
```

### Scenario 2: Loss + Replacement Escape Hatch
```
T0: Two positions
  stake: 30M μUSDC, locks: {A: 20M, B: 10M}

T1: BTS loss -5M μUSDC
  stake: 25M, locks: {A: 20M, B: 10M}
  underwater: 25M < 30M ❌

T2: Buy small in Pool A ($100)
  otherLocks: 10M (B only)
  newLock: 2M (2% of $100)
  required: 12M
  skim: 0
  After: stake: 25M, locks: {A: 2M, B: 10M} = 12M
  Back to solvent: 25M ≥ 12M ✅
```

**Key insight:** Trading in existing pools with smaller amounts reduces total locks → escape from insolvency.

### Scenario 3: Loss + Can't Withdraw
```
T0: Two positions
  stake: 30M μUSDC, locks: {A: 20M, B: 10M}

T1: BTS loss -5M μUSDC
  stake: 25M, locks: {A: 20M, B: 10M}
  Can withdraw? 25M - 30M = -5M ❌

T2: Close Pool B (sell all)
  stake: 25M, locks: {A: 20M}  (B row deleted)
  Can withdraw? 25M - 20M = 5M ✅
```

### Scenario 4: Maximum Loss (Worst Case)
```
T0: Position
  stake: 100M μUSDC, locks: {A: 10M}

T1: BTS worst case (σ = -1.0)
  Max loss: 10M (= lock amount, after λ-fix)
  After: stake: 90M, locks: {A: 10M}
  Still solvent: 90M ≥ 10M ✅

T2: Close position
  stake: 90M, locks: {} (row deleted)
  Withdrawable: 90M ✅
```

**Solvency guarantee:** After closing all positions, stake ≥ 0 (even if all beliefs score -1.0).

---

## Lock Replacement vs. Accumulation

### Why Replacement?

**One belief per pool:**
- Each pool tracks ONE current belief
- New buy = new belief → replaces old belief
- Lock should match current position, not history

**Example:**
```
Buy $500 → lock: 10M μUSDC
Buy $1000 (same pool, same side) → lock: 20M μUSDC (not 30M!)
```

### What Accumulates?

**Global stake accumulates:**
```
Buy $500 → stake: +10M μUSDC
Buy $1000 → stake: +20M μUSDC (if needed to cover)
Total stake: 30M μUSDC ✓
```

**Locks do NOT accumulate per pool per side:**
```
locks: {Pool A LONG: 20M}  (not 30M)
```

---

## Withdrawals

**File:** [veritas_custodian/withdraw.rs](../../solana/veritas-curation/programs/veritas-curation/src/veritas_custodian/instructions/withdraw.rs)

```typescript
// ALL VALUES IN MICRO-USDC
// Calculate withdrawable amount (gross sum of all locks)
const totalStakeMicro = agents.total_stake  // Already in micro-USDC
const totalLocksMicro = Σ(belief_lock WHERE token_balance > 0)
const withdrawableMicro = totalStakeMicro - totalLocksMicro

// Can only withdraw if positive
require(withdrawableMicro > 0, "Close positions to free stake")
require(amountMicro <= withdrawableMicro, "Exceeds withdrawable")
```

**Negative withdrawable allowed:**
- After BTS losses, user can have `withdrawable < 0` temporarily
- User must close positions to free locks before withdrawing
- Self-healing: trade smaller amounts or close positions to restore solvency

---

## Implementation Files

### Core Logic
- [calculate-skim.ts](../../src/lib/stake/calculate-skim.ts) - Skim calculation
- [load-authority.ts](../../src/lib/solana/load-authority.ts) - Protocol authority keypair
- [trades/prepare/route.ts](../../app/api/trades/prepare/route.ts) - Server signs with authority
- [trades/record/route.ts](../../app/api/trades/record/route.ts) - Updates locks after trade

### Smart Contracts
- [trade.rs](../../solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/trade.rs) - On-chain trade validation
- [deposit.rs](../../solana/veritas-curation/programs/veritas-curation/src/veritas_custodian/instructions/deposit.rs) - Skim to vault
- [withdraw.rs](../../solana/veritas-curation/programs/veritas-curation/src/veritas_custodian/instructions/withdraw.rs) - Stake withdrawal

### Protocol
- [protocol-beliefs-stake-redistribution](../../supabase/functions/protocol-beliefs-stake-redistribution/index.ts) - BTS redistribution (needs fix)

### Database
- [20251024000004_add_belief_locks_to_balances.sql](../../supabase/migrations/20251024000004_add_belief_locks_to_balances.sql) - Schema

---

## UI Specification

**Wallet/Profile Section:**
```
┌─────────────────────────────┐
│ Your Stake                  │
├─────────────────────────────┤
│ Total Stake:      $100.00   │ (100M μUSDC from DB)
│ Locked:           $75.00    │ ℹ️ (75M μUSDC)
│ Available:        $25.00    │ (red if < 0)
└─────────────────────────────┘
```

**Tooltip on ℹ️:**
> Locked stake backs your open positions for consensus validation. Close positions to free up stake.

**Per-Pool Card:**
```
┌─────────────────────────────┐
│ "Will AI replace devs?"     │
├─────────────────────────────┤
│ LONG:  500 tokens ($520)    │ Lock: $10.40 (10.4M μUSDC)
│ SHORT: 300 tokens ($285)    │ Lock: $5.70 (5.7M μUSDC)
│ Total Value: $805           │
│ Total Locked: $16.10        │ ℹ️ (gross sum)
└─────────────────────────────┘
```

**Tooltip on per-pool lock:**
> 2% of your buy amounts in this pool

**Buy Trade Toast:**
> + 2% stake skim ($X) will be bonded for validation.

**Implementation:**
- New API endpoint: `GET /api/users/[userId]/stake-summary`
- Returns: `{ total_stake, total_locked, withdrawable, locks_by_pool }`

---

## Related Docs

- [BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md](./BTS-REDISTRIBUTION-DESIGN-QUESTIONS.md) - λ-scaled redistribution design
- [OPEN-IMPLEMENTATION-QUESTIONS.md](./OPEN-IMPLEMENTATION-QUESTIONS.md) - All implementation decisions
- [INCENTIVE-STRUCTURE.md](./INCENTIVE-STRUCTURE.md) - Economic theory, game theory proofs
- [STAKE-SYSTEM-AUDIT.md](./STAKE-SYSTEM-AUDIT.md) - Original bug discovery
- [authority-signing.md](../security/authority-signing.md) - Protocol authority security

---

## Implementation Checklist

### Core λ-Scaled Redistribution
- [ ] Update `protocol-beliefs-stake-redistribution/index.ts` with λ-scaled formula
- [ ] Add `pool_address` lookup from `belief_id` via `pool_deployments`
- [ ] Remove `belief_weights` parameter (compute from DB locks instead)
- [ ] Aggregate LONG + SHORT locks per user (gross, not net)
- [ ] Remove any clearing/re-locking logic (locks only change on buy)
- [ ] Implement atomic stake updates: `total_stake = total_stake + Δ`
- [ ] Wrap redistribution in `pg_advisory_lock(pool_id)` / `unlock`
- [ ] HARD-ENFORCE zero-sum: throw error if `|Σ Δ| > 1 μUSDC`
- [ ] Store all values in micro-USDC (integers)
- [ ] Test: zero-sum property (Σ finalDeltas = 0, exact)
- [ ] Test: max loss = lock (when score = -1)
- [ ] Test: concurrent epochs don't corrupt stakes

### Skim Calculation Fix
- [ ] Add `token_type` column to `user_pool_balances`
- [ ] Update PK to `(user_id, pool_address, token_type)`
- [ ] Fix `calculate-skim.ts` to filter by `token_type` (side-aware)
- [ ] Store `agents.total_stake` in micro-USDC natively (remove ×1M conversion)
- [ ] Store `user_pool_balances.belief_lock` in micro-USDC
- [ ] Wrap skim calculation + DB update in Postgres transaction
- [ ] Use `SELECT ... FOR UPDATE` on `agents` row for concurrency protection
- [ ] Test: concurrent buys don't double-charge skim
- [ ] Test: LONG + SHORT in same pool correctly sums to gross lock

### Lock Cleanup
- [ ] Add `DELETE` statement in sell handler when `token_balance = 0`
- [ ] Test: closed positions are auto-deleted and don't count in locks

### UI Enhancements
- [ ] Create `GET /api/users/[userId]/stake-summary` endpoint
- [ ] Add stake breakdown to wallet/profile UI
- [ ] Add per-pool lock display to pool cards
- [ ] Add skim notification toast on buy trades
- [ ] Red text styling for negative available stake

### Edge Cases & Monitoring
- [ ] Withdraw API: Better error message when `withdrawable < 0`
- [ ] Update epoch processor callers to pass `pool_address`
- [ ] Update `protocol-weights-calculate` to aggregate gross locks
- [ ] Add database view for user solvency monitoring (optional)
- [ ] Add edge function for underwater user alerts (optional)
- [ ] Update all API endpoints that query `user_pool_balances` to handle LONG+SHORT
