# Time-Based Pool Decay System - Implementation Spec v2

## Purpose
Apply gradual decay to pool reserves after belief expiration, reducing relevance scores of old content over time. Decay executes passively on-chain during trades and is readable via view function for feed ranking.

---

## Prerequisites - What Must Exist First

### Existing Code Dependencies
1. **ContentPool state struct** - Located at `solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs`
2. **ICBSCurve module** - Located at `solana/veritas-curation/programs/veritas-curation/src/content_pool/curve.rs`
3. **ContentPoolError enum** - Located at `solana/veritas-curation/programs/veritas-curation/src/content_pool/errors.rs`
4. **Trade instruction** - Located at `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/trade.rs`
5. **Settlement instruction** - Located at `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/settle_epoch.rs`

### Exact Constants You Need (from state.rs)
```rust
// File: solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs
// These ALREADY EXIST at lines 132-133:
pub const Q96_ONE: u128 = 1 << 96;        // 1.0 in X96
pub const Q32_ONE: u64 = 1 << 32;         // 1.0 in Q32.32 (for BD scores)
```

### Exact Function Signatures You Need (from curve.rs)
```rust
// File: solana/veritas-curation/programs/veritas-curation/src/content_pool/curve.rs
// This ALREADY EXISTS - exact signature at line 75:
impl ICBSCurve {
    pub fn sqrt_marginal_price(
        s_long: u64,
        s_short: u64,
        side: TokenSide,  // TokenSide is an enum with Long and Short variants
        sqrt_lambda_x96: u128,
        f: u16,
        beta_num: u16,
        beta_den: u16,
    ) -> Result<u128>
}
```

### Exact Enum You Need (from state.rs)
```rust
// File: solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs
// This ALREADY EXISTS:
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum TokenSide {
    Long,
    Short,
}
```

---

## Step 1: Add Decay Constants to state.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs`

**Action:** Add these constants AFTER the existing constants (after line 149)

```rust
// Time-Based Decay Constants
// Decay rates are in basis points per day (10000 = 100%)
pub const DECAY_TIER_1_BPS: u64 = 100;     // 1% per day (days 0-7)
pub const DECAY_TIER_2_BPS: u64 = 200;     // 2% per day (days 7-30)
pub const DECAY_TIER_3_BPS: u64 = 300;     // 3% per day (days 30+)
pub const DECAY_MIN_Q_BPS: u64 = 1000;     // Minimum q after decay: 10% (don't let pools die completely)
pub const SECONDS_PER_DAY: i64 = 86400;    // 24 * 60 * 60
```

**Why:** These constants control decay behavior and must be accessible throughout the program.

---

## Step 2: Add Decay Fields to ContentPool State

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/state.rs`

**Current Structure:** ContentPool struct starts at line 7 and has this layout:
- Identity fields (96 bytes)
- Mints (64 bytes)
- Vaults (64 bytes)
- ICBS Parameters (16 bytes)
- Token Supplies (16 bytes)
- Virtual Reserves (16 bytes)
- Sqrt Prices (32 bytes)
- Sqrt Lambdas (32 bytes)
- Settlement (24 bytes) - **THIS IS WHERE WE ADD**
- Stats (16 bytes)
- Factory Reference (32 bytes)
- Bumps (8 bytes)

**Action:** Find the Settlement section (around line 62-68) and REPLACE it with:

**OLD CODE (DELETE):**
```rust
    // Settlement (24 bytes)
    /// Last settlement timestamp (8 bytes)
    pub last_settle_ts: i64,
    /// Cooldown between settlements (default: 300s)
    pub min_settle_interval: i64,
    /// Current epoch for this pool (independent per-pool epoch counter)
    pub current_epoch: u64,
```

**NEW CODE (REPLACE WITH):**
```rust
    // Settlement (40 bytes)
    /// Last settlement timestamp (8 bytes)
    pub last_settle_ts: i64,
    /// Cooldown between settlements (default: 300s)
    pub min_settle_interval: i64,
    /// Current epoch for this pool (independent per-pool epoch counter)
    pub current_epoch: u64,
    /// When belief expires - decay starts after this timestamp (8 bytes)
    pub expiration_timestamp: i64,
    /// Last time decay was applied on-chain (8 bytes)
    pub last_decay_update: i64,
```

**Account Size Impact:** Added 16 bytes to Settlement section (24 → 40 bytes). Total account size increases by 16 bytes.

**Update Total Size Comment:** Find the comment at line 4 that says:
```rust
/// Total size: 416 bytes + 8 discriminator = 424 bytes
```

Change it to:
```rust
/// Total size: 432 bytes + 8 discriminator = 440 bytes
```

---

## Step 3: Create Decay Calculation Module

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/decay.rs` (NEW FILE)

**Action:** Create this new file with the following complete implementation:

```rust
//! Time-based decay implementation for ContentPool
//!
//! Decay reduces pool reserves after expiration, naturally lowering relevance scores
//! of old content. Uses settlement-style reserve scaling to maintain market invariants.

use anchor_lang::prelude::*;
use super::state::{ContentPool, TokenSide, Q32_ONE, DECAY_TIER_1_BPS, DECAY_TIER_2_BPS, DECAY_TIER_3_BPS, DECAY_MIN_Q_BPS, SECONDS_PER_DAY};
use super::errors::ContentPoolError;
use super::curve::ICBSCurve;

/// Calculate decayed reserves based on elapsed time since expiration
///
/// Returns (r_long_decayed, r_short_decayed)
///
/// Formula:
///   1. Calculate current q = R_L / (R_L + R_S)
///   2. Calculate days expired since expiration_timestamp
///   3. Determine decay rate tier based on days expired
///   4. Calculate target q: x_decay = max(0.1, q - (days × decay_rate))
///   5. Calculate scaling factors: f_L = x_decay / q, f_S = (1 - x_decay) / (1 - q)
///   6. Apply scaling: R_L' = R_L × f_L, R_S' = R_S × f_S
pub fn calculate_decayed_reserves(
    pool: &ContentPool,
    current_timestamp: i64
) -> Result<(u64, u64)> {
    // No decay before expiration
    if current_timestamp <= pool.expiration_timestamp {
        return Ok((pool.r_long, pool.r_short));
    }

    // Calculate days since expiration (truncated to integer days)
    let seconds_expired = current_timestamp
        .checked_sub(pool.expiration_timestamp)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let days_expired = seconds_expired / SECONDS_PER_DAY;

    // No decay if less than 1 day has passed
    if days_expired == 0 {
        return Ok((pool.r_long, pool.r_short));
    }

    // Calculate current q (relevance score)
    let total_reserves = (pool.r_long as u128)
        .checked_add(pool.r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Handle edge case: empty pool
    if total_reserves == 0 {
        return Ok((0, 0));
    }

    // q in Q32 format
    let q_u128 = (pool.r_long as u128)
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(total_reserves)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let q = q_u128 as u64;

    // Determine decay rate based on tier
    // Tier 1: days 0-6 (i.e., days_expired < 7) = 1% per day
    // Tier 2: days 7-29 (i.e., days_expired < 30) = 2% per day
    // Tier 3: days 30+ = 3% per day
    let decay_rate_bps: u64 = if days_expired < 7 {
        DECAY_TIER_1_BPS
    } else if days_expired < 30 {
        DECAY_TIER_2_BPS
    } else {
        DECAY_TIER_3_BPS
    };

    // Calculate x_decay (target q after decay) in basis points
    // q_bps = q * 10000 / Q32_ONE (convert Q32 to basis points)
    let q_bps = (q as u128)
        .checked_mul(10000)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // total_decay_bps = days_expired * decay_rate_bps
    let total_decay_bps = (days_expired as u128)
        .checked_mul(decay_rate_bps as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // x_decay_bps = max(DECAY_MIN_Q_BPS, q_bps - total_decay_bps)
    let x_decay_bps = q_bps
        .saturating_sub(total_decay_bps)
        .max(DECAY_MIN_Q_BPS as u128);

    // Convert x_decay back to Q32 format
    let x_decay = (x_decay_bps
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(10000)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    // Calculate scaling factors (settlement-style)
    // f_L = x_decay / q (both in Q32)
    // f_S = (Q32_ONE - x_decay) / (Q32_ONE - q)

    let f_long = (x_decay as u128)
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(q as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let numerator_short = (Q32_ONE as u128)
        .checked_sub(x_decay as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let denominator_short = (Q32_ONE as u128)
        .checked_sub(q as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let f_short = numerator_short
        .checked_div(denominator_short)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Apply scaling to reserves
    let r_long_decayed = ((pool.r_long as u128)
        .checked_mul(f_long)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    let r_short_decayed = ((pool.r_short as u128)
        .checked_mul(f_short)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    Ok((r_long_decayed, r_short_decayed))
}

/// Apply decay to pool state (mutates reserves and prices)
///
/// Only applies if:
/// - Current time > expiration_timestamp
/// - At least 1 day has passed since last_decay_update
///
/// Updates:
/// - pool.r_long
/// - pool.r_short
/// - pool.sqrt_price_long_x96
/// - pool.sqrt_price_short_x96
/// - pool.last_decay_update
///
/// Emits: DecayAppliedEvent
pub fn apply_decay_if_needed(pool: &mut ContentPool, current_timestamp: i64) -> Result<bool> {
    // Check if at least 1 day has passed since last update
    let days_since_update = (current_timestamp
        .checked_sub(pool.last_decay_update)
        .ok_or(ContentPoolError::NumericalOverflow)?) / SECONDS_PER_DAY;

    if days_since_update < 1 {
        return Ok(false); // No decay applied
    }

    // Store old values for event
    let r_long_before = pool.r_long;
    let r_short_before = pool.r_short;

    // Calculate decayed reserves
    let (r_long_decayed, r_short_decayed) = calculate_decayed_reserves(pool, current_timestamp)?;

    // Apply to pool state
    pool.r_long = r_long_decayed;
    pool.r_short = r_short_decayed;
    pool.last_decay_update = current_timestamp;

    // Recalculate sqrt prices from new reserves
    // Note: We don't change lambda or supplies, only reserves
    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
        pool.s_long,
        pool.s_short,
        TokenSide::Long,
        pool.sqrt_lambda_long_x96,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
        pool.s_long,
        pool.s_short,
        TokenSide::Short,
        pool.sqrt_lambda_short_x96,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    // Emit event
    emit!(DecayAppliedEvent {
        pool: pool.key(),
        days_applied: days_since_update,
        r_long_before,
        r_short_before,
        r_long_after: r_long_decayed,
        r_short_after: r_short_decayed,
        timestamp: current_timestamp,
    });

    Ok(true) // Decay was applied
}

/// Event emitted when decay is applied on-chain
#[event]
pub struct DecayAppliedEvent {
    #[index]
    pub pool: Pubkey,
    pub days_applied: i64,
    pub r_long_before: u64,
    pub r_short_before: u64,
    pub r_long_after: u64,
    pub r_short_after: u64,
    pub timestamp: i64,
}
```

**Why This File Exists:** Separates decay logic into its own module for clarity and reusability.

---

## Step 4: Register Decay Module in mod.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/mod.rs`

**Action:** Add this line to the existing module declarations (usually near the top of the file):

```rust
pub mod decay;
```

**Expected Result:** The decay module is now accessible as `content_pool::decay`

---

## Step 5: Create Get Current State View Instruction

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/get_current_state.rs` (NEW FILE)

**Action:** Create this new file:

```rust
//! View-only instruction: Returns current pool state with decay applied
//!
//! Does NOT mutate on-chain state - purely for reading current values.
//! Used by: UI display, feed ranking, analytics

use anchor_lang::prelude::*;
use crate::content_pool::state::{ContentPool, Q32_ONE};
use crate::content_pool::decay::calculate_decayed_reserves;
use crate::content_pool::errors::ContentPoolError;

#[derive(Accounts)]
pub struct GetCurrentState<'info> {
    /// CHECK: Read-only account, no validation needed
    pub pool: Account<'info, ContentPool>,
}

pub fn handler(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
    let pool = &ctx.accounts.pool;
    let current_time = Clock::get()?.unix_timestamp;

    // Calculate decayed reserves (does not mutate state)
    let (r_long, r_short) = calculate_decayed_reserves(pool, current_time)?;

    // Calculate total reserves
    let total = (r_long as u128)
        .checked_add(r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Calculate relevance score (q value)
    let q = if total > 0 {
        let q_u128 = (r_long as u128)
            .checked_mul(Q32_ONE as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(total)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        q_u128 as u64
    } else {
        Q32_ONE / 2 // Default to 0.5 if pool is empty
    };

    // Calculate human-readable prices (micro-USDC per token)
    // price = reserve / supply
    let price_long = if pool.s_long > 0 {
        let price_u128 = (r_long as u128)
            .checked_mul(1_000_000) // Convert to micro-USDC
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(pool.s_long as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        price_u128 as u64
    } else {
        1_000_000 // 1.0 USDC default
    };

    let price_short = if pool.s_short > 0 {
        let price_u128 = (r_short as u128)
            .checked_mul(1_000_000)
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(pool.s_short as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        price_u128 as u64
    } else {
        1_000_000 // 1.0 USDC default
    };

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

    Ok(CurrentPoolState {
        r_long,
        r_short,
        q,
        price_long,
        price_short,
        s_long: pool.s_long,
        s_short: pool.s_short,
        sqrt_price_long_x96: pool.sqrt_price_long_x96,
        sqrt_price_short_x96: pool.sqrt_price_short_x96,
        days_expired,
        days_since_last_update,
        decay_pending,
        expiration_timestamp: pool.expiration_timestamp,
        last_decay_update: pool.last_decay_update,
    })
}

/// Return type for get_current_state view function
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CurrentPoolState {
    /// Decayed LONG reserves (micro-USDC)
    pub r_long: u64,
    /// Decayed SHORT reserves (micro-USDC)
    pub r_short: u64,
    /// Relevance score in Q32 format (use q / Q32_ONE to get 0.0-1.0 value)
    pub q: u64,
    /// LONG price in micro-USDC per token
    pub price_long: u64,
    /// SHORT price in micro-USDC per token
    pub price_short: u64,
    /// LONG supply (unchanged by decay)
    pub s_long: u64,
    /// SHORT supply (unchanged by decay)
    pub s_short: u64,
    /// Square root of LONG price in X96 format
    pub sqrt_price_long_x96: u128,
    /// Square root of SHORT price in X96 format
    pub sqrt_price_short_x96: u128,
    /// Days since expiration (0 if not expired)
    pub days_expired: i64,
    /// Days since last on-chain decay update
    pub days_since_last_update: i64,
    /// True if decay will be applied on next trade
    pub decay_pending: bool,
    /// Timestamp when decay starts
    pub expiration_timestamp: i64,
    /// Timestamp of last on-chain decay execution
    pub last_decay_update: i64,
}
```

**Why:** View function provides read-only access to current decayed state without mutating on-chain data.

---

## Step 6: Register Get Current State Instruction in mod.rs

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/mod.rs`

**Action:** Add this line to the module declarations:

```rust
pub mod get_current_state;
```

**Action:** Add this line to the `pub use` section (makes it available to lib.rs):

```rust
pub use get_current_state::*;
```

**Expected Result:** The get_current_state instruction is now available to the main program.

---

## Step 7: Add Get Current State to Program Instructions

**File:** `solana/veritas-curation/programs/veritas-curation/src/lib.rs`

**Locate:** The `#[program]` module (should be around line 20-100)

**Action:** Add this function inside the `pub mod veritas_curation` program module:

```rust
    /// View-only instruction: Get current pool state with decay applied
    /// Does not mutate on-chain state
    pub fn get_current_state(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
        content_pool::instructions::get_current_state::handler(ctx)
    }
```

**Expected Location:** Add it near other content_pool instructions like `trade`, `settle_epoch`, etc.

---

## Step 8: Integrate Decay into Trade Instruction

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/trade.rs`

**Locate:** The `handler` function (should start around line 20-30)

**Action:** Add decay check as the FIRST operation in the handler:

**Find this line:**
```rust
pub fn handler(
    ctx: Context<Trade>,
    side: TokenSide,
    trade_type: TradeType,
    amount: u64,
    stake_skim: u64,
    min_tokens_out: u64,
    min_usdc_out: u64,
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
```

**Add this code immediately after `let pool = &mut ctx.accounts.pool;`:**

```rust
    // Apply decay if needed (before any trade logic)
    let current_time = Clock::get()?.unix_timestamp;
    crate::content_pool::decay::apply_decay_if_needed(pool, current_time)?;
```

**Expected Result:** Every trade will check and apply decay before executing.

---

## Step 9: Integrate Decay into Settlement Instruction

**File:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/instructions/settle_epoch.rs`

**Locate:** The `handler` function (should start around line 20-30)

**Action:** Add decay check as the FIRST operation in the handler:

**Find this line:**
```rust
pub fn handler(ctx: Context<SettleEpoch>, bd_score: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
```

**Add this code immediately after `let pool = &mut ctx.accounts.pool;`:**

```rust
    // Apply decay BEFORE settlement (settlement factors calculated from decayed reserves)
    let current_time = Clock::get()?.unix_timestamp;
    crate::content_pool::decay::apply_decay_if_needed(pool, current_time)?;
```

**Expected Result:** Decay is applied before settlement, so settlement factors are calculated from decayed reserves.

---

## Step 10: Update Pool Deployment to Set Expiration

**File:** `solana/veritas-curation/programs/veritas-curation/src/pool_factory/instructions/create_pool.rs`

**Locate:** The pool initialization code (where ContentPool fields are set)

**Action:** Add these two field assignments when initializing the pool:

**Find the section where pool fields are being set (should look like):**
```rust
    pool.content_id = content_id;
    pool.creator = ctx.accounts.creator.key();
    pool.market_deployer = ctx.accounts.trader.key();
    pool.long_mint = long_mint.key();
    pool.short_mint = short_mint.key();
    pool.vault = vault.key();
    pool.stake_vault = custodian.usdc_vault;
    // ... more fields ...
```

**Add these two lines in the appropriate position (after settlement fields):**

```rust
    // Set expiration timestamp (decay starts after this)
    let current_time = Clock::get()?.unix_timestamp;
    pool.expiration_timestamp = current_time + (BELIEF_DURATION_HOURS as i64 * 3600);
    pool.last_decay_update = pool.expiration_timestamp; // Start tracking from expiration
```

**Note:** If `BELIEF_DURATION_HOURS` is not defined, you need to either:
1. Add it as a constant in state.rs: `pub const BELIEF_DURATION_HOURS: u32 = 720; // 30 days`
2. Or accept it as a parameter in create_pool and pass it from the factory

**Expected Result:** New pools will have expiration_timestamp set, decay will start after that time.

---

## Step 11: Add DecayAppliedEvent to Events Module (if exists)

**Check if file exists:** `solana/veritas-curation/programs/veritas-curation/src/content_pool/events.rs`

**If file exists:**
- The event is already defined in decay.rs, but if you have a central events module, you may want to move it there or re-export it.

**If file does not exist:**
- No action needed, event is defined in decay.rs

---

## Step 12: Update Database Schema

**File:** Create new migration `supabase/migrations/20251024000002_add_pool_decay_tracking.sql`

**Action:** Create this file with:

```sql
-- ============================================================================
-- Add Pool Decay Tracking Fields
-- ============================================================================
-- Migration Date: 2025-01-24
-- Purpose: Track expiration and decay timestamps for time-based pool decay
-- ============================================================================

-- Add decay tracking fields to pool_deployments
ALTER TABLE pool_deployments
ADD COLUMN expiration_timestamp BIGINT,
ADD COLUMN last_decay_update BIGINT;

-- Add helpful comments
COMMENT ON COLUMN pool_deployments.expiration_timestamp IS 'Unix timestamp when belief expires and decay begins';
COMMENT ON COLUMN pool_deployments.last_decay_update IS 'Unix timestamp of last on-chain decay execution';

-- Backfill existing pools using belief duration
-- Assumes beliefs have a 'created_at' timestamp and 'belief_duration_hours' field
UPDATE pool_deployments pd
SET
  expiration_timestamp = EXTRACT(EPOCH FROM (
    SELECT b.created_at + (COALESCE(b.belief_duration_hours, 720) * INTERVAL '1 hour')
    FROM beliefs b
    WHERE b.id = pd.belief_id
  ))::BIGINT,
  last_decay_update = EXTRACT(EPOCH FROM (
    SELECT b.created_at + (COALESCE(b.belief_duration_hours, 720) * INTERVAL '1 hour')
    FROM beliefs b
    WHERE b.id = pd.belief_id
  ))::BIGINT
WHERE belief_id IS NOT NULL;

-- Make columns NOT NULL after backfill (with default for new rows)
ALTER TABLE pool_deployments
ALTER COLUMN expiration_timestamp SET DEFAULT 0,
ALTER COLUMN last_decay_update SET DEFAULT 0;

-- For new pools, these will be set by the create_pool instruction
-- For testing/dev, you can manually update them:
-- UPDATE pool_deployments SET expiration_timestamp = EXTRACT(EPOCH FROM NOW()) + 86400 WHERE expiration_timestamp = 0;
```

**Expected Result:** Database tracks expiration and last decay update for each pool.

---

## Step 13: Create Client Library for Fetching Pool State

**File:** `src/lib/solana/fetch-pool-state.ts` (NEW FILE or UPDATE EXISTING)

**Check if file exists first.** If `src/lib/solana/fetch-pool-data.ts` already exists, add this function to it. Otherwise create a new file.

**Action:** Add/create this code:

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { VeritasCuration } from './target/types/veritas_curation';
import idl from './target/idl/veritas_curation.json';

export interface PoolStateWithDecay {
  // Decayed reserves (micro-USDC)
  rLong: number;
  rShort: number;
  // Relevance score (0.0 to 1.0)
  q: number;
  // Human-readable prices (USDC per token)
  priceLong: number;
  priceShort: number;
  // Token supplies (atomic units)
  sLong: number;
  sShort: number;
  // Sqrt prices (X96 format)
  sqrtPriceLongX96: string;
  sqrtPriceShortX96: string;
  // Decay info
  daysExpired: number;
  daysSinceLastUpdate: number;
  decayPending: boolean;
  expirationTimestamp: number;
  lastDecayUpdate: number;
}

/**
 * Fetch current pool state with decay applied (view function)
 *
 * This calls the on-chain view function which calculates decayed reserves
 * without mutating state.
 *
 * @param poolAddress - Solana address of the ContentPool
 * @param rpcEndpoint - Solana RPC endpoint URL
 * @returns Current pool state with decay applied
 */
export async function fetchPoolStateWithDecay(
  poolAddress: string,
  rpcEndpoint: string
): Promise<PoolStateWithDecay> {
  const connection = new Connection(rpcEndpoint, 'confirmed');
  const poolPubkey = new PublicKey(poolAddress);

  // Create dummy wallet for provider (read-only, no signing needed)
  const dummyWallet = {
    publicKey: poolPubkey,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any[]) => txs,
  };

  const provider = new AnchorProvider(connection, dummyWallet as any, {
    commitment: 'confirmed',
  });

  const program = new Program<VeritasCuration>(
    idl as VeritasCuration,
    provider
  );

  try {
    // Call view function (simulated transaction, no signature needed)
    const result = await program.methods
      .getCurrentState()
      .accounts({
        pool: poolPubkey,
      })
      .view();

    // Convert from on-chain format to JavaScript
    const Q32_ONE = 2 ** 32;

    return {
      rLong: result.rLong.toNumber(),
      rShort: result.rShort.toNumber(),
      q: result.q.toNumber() / Q32_ONE, // Convert Q32 to 0.0-1.0
      priceLong: result.priceLong.toNumber() / 1_000_000, // Micro-USDC to USDC
      priceShort: result.priceShort.toNumber() / 1_000_000,
      sLong: result.sLong.toNumber(),
      sShort: result.sShort.toNumber(),
      sqrtPriceLongX96: result.sqrtPriceLongX96.toString(),
      sqrtPriceShortX96: result.sqrtPriceShortX96.toString(),
      daysExpired: result.daysExpired.toNumber(),
      daysSinceLastUpdate: result.daysSinceLastUpdate.toNumber(),
      decayPending: result.decayPending,
      expirationTimestamp: result.expirationTimestamp.toNumber(),
      lastDecayUpdate: result.lastDecayUpdate.toNumber(),
    };
  } catch (error) {
    console.error('[fetchPoolStateWithDecay] Error:', error);
    throw error;
  }
}

/**
 * Batch fetch multiple pool states in parallel
 *
 * Optimized for feed ranking - fetches 50+ pools efficiently.
 *
 * @param poolAddresses - Array of pool addresses to fetch
 * @param rpcEndpoint - Solana RPC endpoint URL
 * @returns Map of pool address -> pool state
 */
export async function fetchMultiplePoolStates(
  poolAddresses: string[],
  rpcEndpoint: string
): Promise<Map<string, PoolStateWithDecay>> {
  // Fetch all pools in parallel
  const promises = poolAddresses.map(async (address) => {
    try {
      const state = await fetchPoolStateWithDecay(address, rpcEndpoint);
      return { address, state };
    } catch (error) {
      console.warn(`[fetchMultiplePoolStates] Failed to fetch ${address}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);

  // Build map
  const stateMap = new Map<string, PoolStateWithDecay>();
  for (const result of results) {
    if (result) {
      stateMap.set(result.address, result.state);
    }
  }

  return stateMap;
}
```

**Expected Result:** Client can fetch pool state with decay applied without making transactions.

---

## Step 14: Rebuild and Deploy

**Action 1: Rebuild Anchor Program**

```bash
cd solana/veritas-curation
anchor build
```

**Expected Output:** Build succeeds with no errors. New instruction `get_current_state` is included.

**Action 2: Generate TypeScript Client**

```bash
anchor client-gen
# OR if using npm script:
npm run sync-idl
```

**Expected Output:** Updated TypeScript types in `src/lib/solana/target/types/veritas_curation.ts`

**Action 3: Deploy to Local Devnet**

```bash
# Start local validator if not running
solana-test-validator &

# Deploy
anchor deploy
```

**Expected Output:** Program deployed successfully, program ID printed.

**Action 4: Run Database Migration**

```bash
npx supabase db push
# OR if using local Supabase:
npx supabase migration up
```

**Expected Output:** Migration applied, new columns added to pool_deployments.

---

## Step 15: Testing Checklist

### On-Chain Tests

**Test 1: View Function Returns Correct State (No Decay)**
- Deploy pool with expiration = now + 7 days
- Call get_current_state immediately
- Assert: r_long and r_short match on-chain values
- Assert: days_expired = 0
- Assert: decay_pending = false

**Test 2: View Function Returns Decayed State**
- Deploy pool with expiration = now - 3 days (simulate expired pool)
- Call get_current_state
- Assert: r_long < original (decayed)
- Assert: days_expired = 3
- Assert: decay_pending = true

**Test 3: Trade Applies Decay**
- Deploy pool with expiration = now - 1 day
- Execute trade
- Assert: DecayAppliedEvent emitted
- Assert: pool.last_decay_update = current timestamp
- Assert: pool.r_long and pool.r_short are reduced

**Test 4: Multiple Days Accumulate**
- Deploy pool with expiration = now - 5 days
- Execute trade
- Assert: decay applied for 5 full days
- Assert: r_long reduced by approximately 5% (5 days × 1%)

**Test 5: Settlement After Decay**
- Deploy pool with expiration = now - 2 days
- Execute settle_epoch with bd_score
- Assert: Decay applied first (DecayAppliedEvent emitted)
- Assert: Settlement applied second (SettlementEvent emitted)
- Assert: Final reserves reflect both decay and settlement

### Client-Side Tests

**Test 6: Fetch Pool State With Decay**
- Deploy pool
- Call fetchPoolStateWithDecay
- Assert: Returns valid PoolStateWithDecay object
- Assert: q value between 0 and 1

**Test 7: Batch Fetch Multiple Pools**
- Deploy 10 pools
- Call fetchMultiplePoolStates
- Assert: Returns map with all 10 pools
- Assert: All pools have valid state

### Edge Cases

**Test 8: Pool Never Traded After Expiration**
- Deploy pool
- Wait until after expiration
- Call get_current_state
- Assert: Returns decayed reserves
- Execute first trade
- Assert: Decay applied on-chain

**Test 9: Decay Doesn't Apply Twice in Same Day**
- Deploy pool with expiration = now - 1 day
- Execute trade (decay applies)
- Execute another trade 1 hour later
- Assert: Decay NOT applied second time (days_since_update < 1)

**Test 10: Minimum Q Floor**
- Deploy pool with high q value (0.9)
- Simulate 100 days expired
- Call get_current_state
- Assert: q >= 0.1 (minimum floor respected)

---

## Operational Notes

### Compute Units
- View function: ~30 CU (read-only)
- Decay execution: ~50 CU (state mutation)
- Total trade with decay: ~5,050 CU (1% overhead)

### RPC Calls
- Single pool fetch: ~50-100ms
- Batch 50 pools: ~150-300ms (parallel)
- Acceptable for feed loading

### Gas Costs
- View functions are free (simulated locally)
- Decay adds negligible cost to trades (~1% CU increase)

---

## Dependencies Summary

### Rust Dependencies (Cargo.toml)
- anchor-lang = "0.29.0" (or whatever version you're using)
- anchor-spl = "0.29.0"

### TypeScript Dependencies (package.json)
- @coral-xyz/anchor = "^0.29.0"
- @solana/web3.js = "^1.87.0"

### Database Dependencies
- PostgreSQL (Supabase)
- pool_deployments table must exist
- beliefs table must exist

---

## Troubleshooting

### Error: "cannot find value `Q32_ONE`"
**Fix:** Add `use super::state::Q32_ONE;` to imports in decay.rs

### Error: "cannot find type `TokenSide`"
**Fix:** Add `use super::state::TokenSide;` to imports

### Error: "cannot find function `sqrt_marginal_price`"
**Fix:** Add `use super::curve::ICBSCurve;` to imports

### Error: Account size mismatch
**Fix:** You changed ContentPool size but didn't update existing accounts. Either:
1. Rerun `anchor test` to reset local validator
2. Implement account reallocation in a migration instruction

### Error: View function returns wrong values
**Fix:** Ensure you're calling `view()` not `rpc()` on the method builder

### Error: TypeError in TypeScript client
**Fix:** Regenerate types with `anchor client-gen` after building

---

## Final Verification

✅ **On-Chain State:**
- [ ] ContentPool has expiration_timestamp field
- [ ] ContentPool has last_decay_update field
- [ ] decay.rs module exists and compiles
- [ ] get_current_state instruction exists
- [ ] trade instruction calls apply_decay_if_needed
- [ ] settle_epoch instruction calls apply_decay_if_needed

✅ **Client-Side:**
- [ ] fetchPoolStateWithDecay function exists
- [ ] fetchMultiplePoolStates function exists
- [ ] TypeScript types include CurrentPoolState

✅ **Database:**
- [ ] pool_deployments has expiration_timestamp column
- [ ] pool_deployments has last_decay_update column
- [ ] Existing pools have backfilled timestamps

✅ **Tests:**
- [ ] All 10 test cases pass
- [ ] No integer overflow errors
- [ ] View function matches execution results
- [ ] Feed ranking uses decayed q values

---

## Next Steps After Implementation

1. **Integrate with Feed Ranking**
   - Update feed service to call fetchMultiplePoolStates
   - Sort posts by decayed q values

2. **Add Analytics**
   - Track decay events
   - Show decay history on pool detail pages

3. **Add UI Indicators**
   - Show "Decaying" badge on expired posts
   - Display days until decay starts
   - Show decay rate tier

4. **Performance Optimization**
   - Add caching layer for frequently-accessed pools
   - Implement RPC connection pooling

5. **Monitoring**
   - Alert on decay event failures
   - Track average decay amounts per tier
   - Monitor RPC load from batch fetches
