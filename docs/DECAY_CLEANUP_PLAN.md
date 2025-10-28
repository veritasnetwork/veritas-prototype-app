# Decay Code Cleanup Plan

**Date:** October 26, 2025
**Status:** Ready for Implementation
**Context:** ADR-001 - Abandon time-based decay mechanism

---

## Overview

Remove all decay-related code from the codebase. This is safe because:
- Decay is never actually triggered (1-day minimum check + expiration date never reached)
- Removing it simplifies the codebase
- No migration needed (fields stay in state, just unused)

**Total Files to Modify:** 16 files
**Total Files to Delete:** 5 files
**Estimated Time:** 3-4 hours

---

## Phase 1: Smart Contract Cleanup (8 files)

### 1.1 Delete decay.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/decay.rs`

**Action:** DELETE entire file

**Justification:** Core decay logic - unused, can be completely removed.

---

### 1.2 Remove decay module export

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/mod.rs`

**Find:**
```rust
pub mod decay;
```

**Action:** DELETE line

---

### 1.3 Remove decay call from trade.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/trade.rs`

**Line 197-198:**
```rust
// FIND AND DELETE:
// Apply decay if needed (before any trade logic)
crate::content_pool::decay::apply_decay_if_needed(pool, pool_key, current_time)?;
```

**Action:** DELETE these 2 lines

---

### 1.4 Remove decay constants from state.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs`

**Lines 173-179:**
```rust
// FIND AND DELETE:
// Time-Based Decay Constants
// Decay rates are in basis points per day (10000 = 100%)
pub const DECAY_TIER_1_BPS: u64 = 100;     // 1% per day (days 0-7)
pub const DECAY_TIER_2_BPS: u64 = 200;     // 2% per day (days 7-30)
pub const DECAY_TIER_3_BPS: u64 = 300;     // 3% per day (days 30+)
pub const DECAY_MIN_Q_BPS: u64 = 1000;     // Minimum q after decay: 10%
pub const SECONDS_PER_DAY: i64 = 86400;    // 24 * 60 * 60
pub const BELIEF_DURATION_HOURS: u32 = 720; // 30 days (30 * 24)
```

**Action:** DELETE these constants

**Note:** KEEP the state fields (`expiration_timestamp`, `last_decay_update`) in ContentPool struct.
- Removing them would change account size → break all existing pools
- Fields are harmless when unused (8+8=16 bytes)
- Can be repurposed later if needed

---

### 1.5 Simplify create_pool.rs initialization

**File:** `solana/veritas-curation/programs/veritas-curation/src/pool_factory/instructions/create_pool.rs`

**Lines 66-69:**
```rust
// FIND:
// Decay parameters
let current_time = clock.unix_timestamp;
pool.expiration_timestamp = current_time + (crate::content_pool::state::BELIEF_DURATION_HOURS as i64 * 3600);
pool.last_decay_update = pool.expiration_timestamp; // Start tracking from expiration

// REPLACE WITH:
// Decay fields (unused but required for account layout)
let current_time = clock.unix_timestamp;
pool.expiration_timestamp = 0;  // Unused
pool.last_decay_update = current_time;
```

**Action:** Simplify initialization, add comment that fields are unused

---

### 1.6 Remove decay from get_current_state.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/get_current_state.rs`

**Check if file has decay logic:**
```bash
grep -n "decay" get_current_state.rs
```

**Action:** Remove any decay calculation logic if present. This file might calculate decayed reserves for view purposes.

---

### 1.7 Update lib.rs exports

**File:** `solana/veritas-curation/programs/veritas-curation/src/lib.rs`

**Action:** Verify no decay-related exports exist. If they do, remove them.

---

### 1.8 Clean up errors.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/errors.rs`

**Search for decay-related errors:**
```rust
// Look for error variants like:
DecayNotNeeded,
InvalidDecayRate,
etc.
```

**Action:** Remove any decay-specific error variants (likely none exist)

---

## Phase 2: Frontend Cleanup (5 files)

### 2.1 Remove DecayedPoolState type

**File:** `src/types/post.types.ts`

**Lines ~104-123:** Remove interface
```typescript
// FIND AND DELETE:
/**
 * Decayed pool state from on-chain view function
 * Includes time-based decay calculations
 */
export interface DecayedPoolState {
  /** Relevance score (0.0 to 1.0) with decay applied */
  q: number;
  /** LONG price with decay applied (USDC per token) */
  priceLong: number;
  /** SHORT price with decay applied (USDC per token) */
  priceShort: number;
  daysExpired: number;
  /** Days since last on-chain decay update */
  daysSinceLastUpdate: number;
  /** True if decay will be applied on next trade */
  decayPending: boolean;
  /** Unix timestamp when decay starts */
  expirationTimestamp: number;
  /** Unix timestamp of last on-chain decay execution */
  lastDecayUpdate: number;
}
```

**Line ~100:** Remove from EnrichedPost
```typescript
// FIND:
  // Decayed pool state (enriched from on-chain)
  decayedPoolState?: DecayedPoolState | null;

// REPLACE WITH:
  // Pool state (enriched from on-chain)
  poolState?: PoolState | null;
```

---

### 2.2 Update PoolStateEnricher.ts

**File:** `src/services/feed/PoolStateEnricher.ts`

**Line 4:** Update comment
```typescript
// FIND:
 * Fetches on-chain pool state (with decay) and enriches posts with fresh data.

// REPLACE WITH:
 * Fetches on-chain pool state and enriches posts with fresh data.
```

**Line 68:** Update comment
```typescript
// FIND:
      // Batch fetch pool states from chain (with decay)

// REPLACE WITH:
      // Batch fetch pool states from chain
```

**Lines 116-127:** Update enrichment
```typescript
// FIND:
      // Add decayed pool state
      decayedPoolState: {
        q: poolState.q,
        priceLong: poolState.priceLong,
        priceShort: poolState.priceShort,
        daysExpired: poolState.daysExpired,
        daysSinceLastUpdate: poolState.daysSinceLastUpdate,
        decayPending: poolState.decayPending,
        expirationTimestamp: poolState.expirationTimestamp,
        lastDecayUpdate: poolState.lastDecayUpdate,
      },

      // Update relevance score with decayed q value (0-100 scale)

// REPLACE WITH:
      // Add pool state
      poolState: {
        q: poolState.q,
        priceLong: poolState.priceLong,
        priceShort: poolState.priceShort,
        // Decay fields removed
      },

      // Update relevance score with q value (0-100 scale)
```

**Line 141:** Update null case
```typescript
// FIND:
      decayedPoolState: null,

// REPLACE WITH:
      poolState: null,
```

---

### 2.3 Update FeedRankingService.ts

**File:** `src/services/feed/FeedRankingService.ts`

**Line 5:** Update comment
```typescript
// FIND:
 * 1. Enriching posts with on-chain pool state (with decay)

// REPLACE WITH:
 * 1. Enriching posts with on-chain pool state
```

**Line 66:** Update count variable
```typescript
// FIND:
        const enrichedCount = enrichedPosts.filter(p => p.decayedPoolState).length;

// REPLACE WITH:
        const enrichedCount = enrichedPosts.filter(p => p.poolState).length;
```

---

### 2.4 Delete DecayBasedRanking.ts

**File:** `src/services/feed/DecayBasedRanking.ts`

**Action:** DELETE entire file (unused decay ranking implementations)

---

### 2.5 Update feed service exports

**File:** `src/services/feed/index.ts`

**Lines 22-25:** Remove decay exports
```typescript
// FIND:
export {
  DecayBasedRanking,
  HybridDecayRanking,
  DecayAwareRanking,
} from './DecayBasedRanking';

// DELETE these lines
```

---

## Phase 3: Test Cleanup (1 file + backups)

### 3.1 Remove decay tests

**File:** `solana/veritas-curation/tests/content-pool-icbs.test.ts`

**Search for:**
```typescript
it("applies decay after expiration"
it("decay tier"
it("decay reduces reserves"
```

**Action:** DELETE all decay-related test cases

**Also delete test backup files:**
```bash
rm solana/veritas-curation/tests/content-pool-icbs.test.ts.bak*
```

---

## Phase 3: Documentation Cleanup (4 files)

### 3.1 Move spec to archive

**File:** `specs/architecture/time-based-pool-decay.md`

**Action:**
```bash
mkdir -p specs/archive
mv specs/architecture/time-based-pool-decay.md specs/archive/
```

**Add README in archive:**
```bash
echo "# Archived Specs\n\nThese specs were part of earlier designs but not implemented.\nSee docs/ARCHITECTURE_DECISIONS.md for context." > specs/archive/README.md
```

---

### 3.2 Delete DecayBasedRanking.ts

**File:** `src/services/feed/DecayBasedRanking.ts`

**Action:** DELETE file (frontend decay ranking - never implemented)

---

### 3.3 Archive database migration

**File:** `supabase/migrations/archive/20251024000002_add_pool_decay_tracking.sql`

**Action:** Already archived, no change needed

---

### 3.4 Update edge function spec

**File:** `specs/edge-function-specs/low-level-protocol-specs/02-belief-creation.md`

**Search for:** References to `BELIEF_DURATION_HOURS`

**Action:** Remove or update references to decay/expiration

---

## Phase 4: Update get_current_state.rs

### 4.1 Simplify get_current_state instruction

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/get_current_state.rs`

**Lines 1-10:** Remove decay imports and update comments
```rust
// FIND:
//! View-only instruction: Returns current pool state with decay applied
//!
//! Does NOT mutate on-chain state - purely for reading current values.
//! Used by: UI display, feed ranking, analytics

use anchor_lang::prelude::*;
use crate::content_pool::state::{ContentPool, Q32_ONE};
use crate::content_pool::decay::calculate_decayed_reserves;
use crate::content_pool::errors::ContentPoolError;

// REPLACE WITH:
//! View-only instruction: Returns current pool state
//!
//! Does NOT mutate on-chain state - purely for reading current values.
//! Used by: UI display, feed ranking, analytics

use anchor_lang::prelude::*;
use crate::content_pool::state::{ContentPool, Q32_ONE};
use crate::content_pool::errors::ContentPoolError;
```

**Lines 17-22:** Remove decay calculation
```rust
// FIND:
pub fn handler(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
    let pool = &ctx.accounts.pool;
    let current_time = Clock::get()?.unix_timestamp;

    // Calculate decayed reserves (does not mutate state)
    let (r_long, r_short) = calculate_decayed_reserves(pool, current_time)?;

// REPLACE WITH:
pub fn handler(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
    let pool = &ctx.accounts.pool;
    let current_time = Clock::get()?.unix_timestamp;

    // Use actual reserves (no decay calculation)
    let r_long = pool.r_long;
    let r_short = pool.r_short;
```

**Lines 65-77:** Remove decay-related calculations
```rust
// FIND:
    // Calculate days expired
    let days_expired = if current_time > pool.expiration_timestamp {
        (current_time - pool.expiration_timestamp) / 86400
    } else {
        0
    };

    // Calculate days since last on-chain update
    let days_since_last_update = (current_time - pool.last_decay_update) / 86400;

    // Decay is pending if expired and at least 1 day since last update
    let decay_pending = current_time > pool.expiration_timestamp &&
                        days_since_last_update >= 1;

// REPLACE WITH:
    // Decay fields unused (kept for backward compatibility)
    let days_expired = 0;
    let days_since_last_update = 0;
    let decay_pending = false;
```

**Result:** get_current_state returns actual reserves, not decayed reserves

---

## Phase 5: Rebuild and Test (Required)

### 5.1 Rebuild smart contracts

```bash
cd solana/veritas-curation
anchor build
```

**Expected:** Build succeeds with no errors

---

### 4.2 Update IDL files

```bash
# Copy new IDL (with decay fields removed from events)
cp target/idl/veritas_curation.json ../../src/lib/solana/target/idl/
cp target/idl/veritas_curation.json ../../supabase/functions/_shared/veritas_curation_idl.json
```

---

### 4.3 Run tests

```bash
anchor test
```

**Expected:** All tests pass (decay tests removed, no other changes)

---

### 4.4 Verify account sizes unchanged

```bash
# Check ContentPool size
anchor idl parse -f programs/veritas-curation/src/content_pool/state.rs | grep ContentPool -A 5
```

**Expected:** ContentPool still 480 bytes (fields remain, just unused)

---

## Phase 5: Verification Checklist

- [ ] `decay.rs` deleted
- [ ] Module export removed from `mod.rs`
- [ ] Decay call removed from `trade.rs`
- [ ] Constants removed from `state.rs`
- [ ] Fields in ContentPool struct REMAIN (commented as unused)
- [ ] `create_pool.rs` simplified
- [ ] Decay tests removed
- [ ] Test backups deleted
- [ ] Spec moved to archive
- [ ] `DecayBasedRanking.ts` deleted
- [ ] `anchor build` succeeds
- [ ] `anchor test` passes
- [ ] IDL files updated
- [ ] ContentPool account size verified (480 bytes)

---

## What STAYS (Important!)

### State Fields (DO NOT REMOVE)

```rust
// In ContentPool struct - KEEP THESE:
pub expiration_timestamp: i64,  // Unused but required for account layout
pub last_decay_update: i64,     // Unused but required for account layout
```

**Why?** Removing them changes `ContentPool::LEN` from 480 → 464 bytes, breaking all existing pools.

### Database Columns (DO NOT REMOVE)

If any database columns exist for decay tracking, KEEP them:
- They're harmless when unused
- Removing requires migration
- May be useful for analytics later

---

## Testing After Cleanup

### Test Scenarios

1. **Deploy new pool**
   - Should work normally
   - `expiration_timestamp` set to 0 (unused)
   - No decay ever applied

2. **Trade on existing pool**
   - Should work normally
   - No decay logic runs
   - Prices calculated from vault (sigma virtualization)

3. **Settle existing pool**
   - Should work normally
   - No decay applied before settlement
   - Sigma scales as designed

---

## Rollback Plan

If cleanup causes issues:

```bash
# Revert all changes
git checkout HEAD -- solana/veritas-curation/programs/veritas-curation/src/content_pool/
git checkout HEAD -- solana/veritas-curation/tests/

# Rebuild
cd solana/veritas-curation
anchor build
anchor test
```

---

## Summary

**Before Cleanup:**
- 1 decay module (222 lines)
- 9 constants
- 1 function call in trade flow
- Decay logic in get_current_state
- DecayedPoolState TypeScript interface
- Multiple test cases
- Frontend decay ranking service
- Spec documentation

**After Cleanup:**
- 0 decay modules
- 0 constants
- 0 decay function calls
- 0 decay tests
- Simplified get_current_state
- Simplified TypeScript types
- Archived specs and unused services

**Risk Level:** LOW
- No account size changes
- No migration needed
- Only removing unused code
- Can be rolled back easily

**Time Required:** 3-4 hours

---

## Implementation Order

1. Smart contract changes (Phase 1) - 1.5 hours
2. Frontend cleanup (Phase 2) - 1 hour
3. Test cleanup (Phase 3) - 30 min
4. get_current_state update (Phase 4) - 30 min
5. Rebuild and verify (Phase 5) - 30 min
6. Documentation cleanup (Phase 3) - 30 min
7. Final verification - 30 min

**Total: ~4 hours**

---

**Status:** Ready to implement ✅
