# Stake Mechanics: How It Actually Works

**Date:** 2025-01-28
**Status:** ✅ Final Design - P90-Scaled Redistribution
**Purpose:** Single source of truth for stake/lock mechanics

**See also:**
- [07-stake-redistribution.md](../edge-function-specs/low-level-protocol-specs/07-stake-redistribution.md) - Complete P90-scaled redistribution spec
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

**See:** [Complete specification](../edge-function-specs/low-level-protocol-specs/07-stake-redistribution.md)

### P90-Scaled Redistribution (Current Design)

**Required inputs:**
- `belief_id` → look up `pool_address` via `pool_deployments.belief_id`
- `bts_scores` (map of agent_id → raw BTS score, unbounded)
- `certainty` ∈ [0, 1] from BD aggregate
- `current_epoch` for idempotency

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

  // 2. Get gross locks per agent (sum LONG + SHORT) - micro-USDC
  const { data: userLocks } = await supabase
    .from('user_pool_balances')
    .select('user_id, belief_lock, users!inner(agent_id)')
    .eq('pool_address', poolAddress)
    .gt('token_balance', 0)

  const grossLocksMicro = new Map<string, number>()  // agentId → lock
  for (const row of userLocks) {
    const agentId = row.users.agent_id
    const current = grossLocksMicro.get(agentId) || 0
    grossLocksMicro.set(agentId, current + row.belief_lock)  // Sum LONG + SHORT
  }

  // 3. Compute P90 adaptive scale
  const agents = Array.from(grossLocksMicro.keys())
  const absScores = agents.map(id => Math.abs(btsScores[id]))
  absScores.sort((a, b) => a - b)  // Ascending
  const N = absScores.length
  const r = Math.ceil(0.90 * N)
  const k_raw = absScores[r - 1]
  const k_floor = 0.1
  const k = Math.max(k_raw, k_floor)

  // 4. Clamp scores to [-1, 1]
  const clampedScores = new Map<string, number>()
  for (const agentId of agents) {
    const clamped = Math.min(Math.max(btsScores[agentId] / k, -1), 1)
    clampedScores.set(agentId, clamped)
  }

  // 5. Compute noise and signal magnitudes
  const noiseMicro = new Map<string, number>()  // losers
  const signalMicro = new Map<string, number>()  // winners

  for (const agentId of agents) {
    const s_clamped = clampedScores.get(agentId)!
    const w_micro = grossLocksMicro.get(agentId)!

    // Noise (losers)
    noiseMicro.set(agentId, Math.max(0, -s_clamped) * w_micro)

    // Signal (winners)
    signalMicro.set(agentId, Math.max(0, s_clamped) * w_micro)
  }

  // 6. Calculate loser slashes (certainty-scaled)
  const slashesMicro = new Map<string, number>()
  let poolSlashMicro = 0

  for (const agentId of agents) {
    const n_micro = noiseMicro.get(agentId)!
    const n_usdc = n_micro / 1_000_000
    const slash_usdc = certainty * n_usdc
    const slash_micro = Math.floor(slash_usdc * 1_000_000)

    slashesMicro.set(agentId, slash_micro)
    poolSlashMicro += slash_micro
  }

  // 7. Distribute to winners (largest-remainders for exact zero-sum)
  const rewardsMicro = new Map<string, number>()
  const totalSignalMicro = Array.from(signalMicro.values()).reduce((a, b) => a + b, 0)

  if (totalSignalMicro === 0) {
    // No winners - skip redistribution
    return { redistribution_occurred: false, ... }
  }

  // First pass: floor allocation
  for (const agentId of agents) {
    const p_micro = signalMicro.get(agentId)!
    const reward_base = Math.floor((poolSlashMicro * p_micro) / totalSignalMicro)
    rewardsMicro.set(agentId, reward_base)
  }

  // Compute remainder
  const allocated = Array.from(rewardsMicro.values()).reduce((a, b) => a + b, 0)
  const remainder = poolSlashMicro - allocated

  // Largest-remainders: distribute remainder micro-units
  if (remainder > 0) {
    const residuals = agents
      .filter(id => signalMicro.get(id)! > 0)
      .map(id => ({
        agentId: id,
        residual: (poolSlashMicro * signalMicro.get(id)!) % totalSignalMicro
      }))
      .sort((a, b) => {
        if (b.residual !== a.residual) return b.residual - a.residual
        return a.agentId.localeCompare(b.agentId)  // Deterministic tie-break
      })

    for (let i = 0; i < remainder; i++) {
      const agentId = residuals[i].agentId
      rewardsMicro.set(agentId, rewardsMicro.get(agentId)! + 1)
    }
  }

  // 8. HARD-ENFORCE zero-sum (exact micro-unit equality)
  let totalDeltaMicro = 0
  for (const agentId of agents) {
    const delta = rewardsMicro.get(agentId)! - slashesMicro.get(agentId)!
    totalDeltaMicro += delta
  }

  if (totalDeltaMicro !== 0) {
    throw new Error(`Zero-sum violated: Σ Δ = ${totalDeltaMicro} μUSDC (expected exactly 0)`)
  }

  // 9. Update stakes ATOMICALLY
  for (const agentId of agents) {
    const deltaMicro = rewardsMicro.get(agentId)! - slashesMicro.get(agentId)!
    if (deltaMicro === 0) continue

    // Get stake before
    const { data: agentBefore } = await supabase
      .from('agents')
      .select('total_stake')
      .eq('id', agentId)
      .single()

    // Update atomically
    await supabase.rpc('update_stake_atomic', {
      p_agent_id: agentId,
      p_delta_micro: deltaMicro
    })

    // Get stake after for audit trail
    const { data: agentAfter } = await supabase
      .from('agents')
      .select('total_stake')
      .eq('id', agentId)
      .single()

    // Record event
    await supabase.from('stake_redistribution_events').insert({
      belief_id: beliefId,
      epoch: currentEpoch,
      agent_id: agentId,
      information_score: btsScores[agentId],  // Raw unbounded score
      belief_weight: grossLocksMicro.get(agentId)!,
      normalized_weight: grossLocksMicro.get(agentId)! / Array.from(grossLocksMicro.values()).reduce((a,b) => a+b, 0),
      stake_before: agentBefore.total_stake,
      stake_delta: deltaMicro,
      stake_after: agentAfter.total_stake,
      recorded_by: 'server'
    })
  }

  // 10. Locks stay unchanged (only change on buy trades)

} finally {
  await supabase.rpc('pg_advisory_unlock', { lock_id: hashPoolAddress(poolAddress) })
}
```

**Key Properties:**
- **Single weighting:** Score weighted exactly once by gross lock
- **Bounded risk:** Max loss per belief = `c · w_i ≤ w_i` (your lock in this pool)
- **Adaptive scaling:** P90 prevents outliers, preserves relative magnitudes
- **Certainty control:** `c ∈ [0, 1]` scales impact (high c → larger movements)
- **Exact zero-sum:** Integer micro-unit accounting with largest-remainders
- **Solvency guaranteed:** Slashes respect lock constraints
- **Atomic updates:** No lost updates from concurrent epochs
- **Locks unchanged:** Only change on buy trades

**Edge cases:**
- No winners (`P = 0`): Skip redistribution (no slashes)
- No losers (`PoolSlash = 0`): Skip redistribution (no rewards)
- Zero certainty (`c = 0`): All slashes = 0, no redistribution
- Tiny scores (`|s_i| < 0.1`): k_floor prevents division issues
- All identical scores: P90 = max score, normalized to [-1, 1]

**Differences from old λ-scaled model:**
- ~~Lambda scaling~~ → **P90 adaptive scaling** (no lambda needed)
- ~~Unbounded deltas~~ → **Bounded by certainty × lock**
- ~~Post-hoc scaling~~ → **Pre-scaled via clamped scores**
- ~~Risk of exceeding stake~~ → **Guaranteed ≤ c · w_i**

See [07-stake-redistribution.md](../edge-function-specs/low-level-protocol-specs/07-stake-redistribution.md) for complete algorithm with examples.

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

T1: BTS worst case (clamped score = -1.0, certainty = 1.0)
  Max loss: c · w_i = 1.0 · 10M = 10M μUSDC
  After: stake: 90M, locks: {A: 10M}
  Still solvent: 90M ≥ 10M ✅

T2: Close position
  stake: 90M, locks: {} (row deleted)
  Withdrawable: 90M ✅
```

**Solvency guarantee:**
- Max loss per pool = `c · w_i ≤ w_i` (bounded by your lock)
- After closing all positions, `stake ≥ 0` always (P90 scaling ensures this)
- With `c < 1`, losses are dampened further (e.g., `c = 0.5` → max loss = 50% of lock)

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

- [07-stake-redistribution.md](../edge-function-specs/low-level-protocol-specs/07-stake-redistribution.md) - Complete P90-scaled redistribution spec
- [OPEN-IMPLEMENTATION-QUESTIONS.md](./OPEN-IMPLEMENTATION-QUESTIONS.md) - All implementation decisions
- [INCENTIVE-STRUCTURE.md](./INCENTIVE-STRUCTURE.md) - Economic theory, game theory proofs
- [STAKE-SYSTEM-AUDIT.md](./STAKE-SYSTEM-AUDIT.md) - Original bug discovery
- [authority-signing.md](../security/authority-signing.md) - Protocol authority security

---

## Implementation Checklist

### Core P90-Scaled Redistribution
- [ ] Update `protocol-beliefs-stake-redistribution/index.ts` with P90-scaled formula
- [ ] Add `pool_address` lookup from `belief_id` via `pool_deployments`
- [ ] Add `certainty` parameter from BD aggregate
- [ ] Aggregate LONG + SHORT locks per agent (gross, not net)
- [ ] Implement P90 adaptive scaling (k = max(P90({|s_i|}), 0.1))
- [ ] Clamp BTS scores to [-1, 1] using k
- [ ] Apply certainty scaling to slashes: `slash = floor(c · n_i)`
- [ ] Implement largest-remainders for exact zero-sum
- [ ] Remove any clearing/re-locking logic (locks only change on buy)
- [ ] Implement atomic stake updates: `total_stake = GREATEST(0, total_stake + Δ)`
- [ ] Wrap redistribution in `pg_advisory_lock(pool_id)` / `unlock`
- [ ] HARD-ENFORCE zero-sum: throw error if `Σ Δ ≠ 0` (exact)
- [ ] Store all values in micro-USDC (integers)
- [ ] Remove database constraint on `information_score` (allow unbounded)
- [ ] Change `information_score` column from `numeric(10,8)` to `numeric`
- [ ] Test: zero-sum property (Σ finalDeltas = 0, exact)
- [ ] Test: max loss = c · lock (when clamped score = -1)
- [ ] Test: concurrent epochs don't corrupt stakes
- [ ] Test: P90 scaling with outliers
- [ ] Test: largest-remainders distributes remainder exactly

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
