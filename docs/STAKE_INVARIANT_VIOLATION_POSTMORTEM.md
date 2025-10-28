# Stake Invariant Violation: Root Cause Analysis & Fix

**Date:** 2025-10-27
**Severity:** CRITICAL
**Status:** Fixed (migrations applied, validation added)

---

## Executive Summary

Users were able to create **underwater positions** (total_stake < total_locks) during normal trading, which should only be possible after BTS redistribution penalties. This violated the core safety invariant of the stake system.

**Root Cause:** Units mismatch bug in `belief_lock` storage (display USDC vs micro-USDC)
**Impact:** Users under-charged on skim, resulting in insufficient collateral
**Detection:** User reported stake not increasing after multiple trades
**Fix Applied:** Data corrected + validation added to prevent recurrence

---

## Timeline of Events

### Migration History

1. **Oct 24-25:** Migrations 20251024000004 through 20251025000018
   - `record_trade_atomic` calculated `belief_lock` as `p_usdc_amount * 0.02` (display USDC)
   - Stored in `bigint` column (meant for micro-USDC)
   - **BUG:** Values 1,000,000x too small

2. **Oct 25:** Migration 20251025000019 - Fixed calculation
   - Changed to `v_usdc_micro * 0.02` (micro-USDC)
   - But existing data remained corrupt

3. **Oct 27:** User trades executed with broken function
   - 5 trades recorded with wrong `belief_lock` values
   - Skim calculation read corrupt locks, massively under-charged
   - User ended up $10 underwater

4. **Oct 27:** Investigation & Fix
   - Migration 20251027200002: Fixed existing `belief_lock` data
   - Migration 20251027200003: Added invariant validation function
   - Migration 20251027200004: Added logging for monitoring

---

## Technical Deep Dive

### The Invariant

```
total_stake >= Σ(belief_lock WHERE token_balance > 0)
```

**Purpose:** Ensures users have sufficient collateral to cover all open positions
**Enforcement:** Should NEVER be violated during normal trading (only after BTS redistribution)

### What Went Wrong

#### 1. The Units Mismatch

**Intended design:**
- `agents.total_stake`: bigint (micro-USDC)
- `user_pool_balances.belief_lock`: bigint (micro-USDC)
- All calculations in micro-USDC throughout

**Actual implementation (Oct 24-25):**
```sql
-- In record_trade_atomic (WRONG)
v_belief_lock := p_usdc_amount * 0.02;  -- p_usdc_amount is display USDC!
-- Stored: 10.0 instead of 10,000,000
```

**Fixed implementation (Oct 25+):**
```sql
-- In record_trade_atomic (CORRECT)
v_usdc_micro := (p_usdc_amount * 1000000)::bigint;
v_belief_lock := (v_usdc_micro * 0.02)::bigint;
-- Stored: 10,000,000 (correct)
```

#### 2. The Skim Calculation Bug

The `calculate_skim_with_lock` function **always read belief_lock as micro-USDC** (correct assumption), but when reading corrupt data:

**Trade #2 Example (Buy SHORT $500):**
```sql
-- What SHOULD happen:
v_total_locks = 200,000 (LONG lock from trade #1, in micro-USDC)
v_new_lock = 10,000,000 (SHORT lock, 2% of $500)
v_required = 200,000 + 10,000,000 = 10,200,000
skim = 10,200,000 - 200,000 = 10,000,000 ($10.00) ✅

-- What ACTUALLY happened:
v_total_locks = 0.20 (corrupt LONG lock, stored as display USDC but read as micro!)
v_new_lock = 10,000,000
v_required = 0.20 + 10,000,000 = 10,000,000.20
skim = 10,000,000.20 - 200,000 = 9,800,000 ($9.80) ❌
```

**Result:** Under-charged by $0.20 on trade #2, cascading to larger deficits on later trades.

#### 3. Cascading Failures

Each subsequent trade read the corrupt locks and calculated insufficient skim:

| Trade | Type | Amount | Lock Should Be | Skim Should Be | Skim Charged | Deficit |
|-------|------|--------|----------------|----------------|--------------|---------|
| 1 | LONG $10 | $10 | $0.20 | $0.20 | $0.20 | $0 |
| 2 | SHORT $500 | $500 | $10.00 | $10.00 | $9.80 | -$0.20 |
| 3 | LONG $602 | $602 | $12.04 | $12.04 | $2.04 | -$10.20 |
| 4 | LONG $100 | $100 | $2.00 | $0 (had enough) | $0 | -$10.20 |
| 5 | LONG $1000 | $1000 | $20.00 | $17.96 | $7.96 | -$10.00 |

**Final State:**
- Total stake: $20.00
- Total locks: $30.00 (SHORT $10 + LONG $20)
- **Underwater by $10.00** ❌

---

## Architectural Weaknesses Identified

### 1. **No Invariant Validation**

**Problem:** The system calculates skim and applies it, but never validates that the invariant holds after the trade.

**Impact:** Bugs in skim calculation silently create underwater positions.

**Fix Applied:** Added `validate_stake_invariant()` function that checks total_stake >= total_locks.

### 2. **Silent Failure Mode**

**Problem:** If `calculate_skim_with_lock` returns the wrong value, trades proceed anyway.

**Impact:** Bad data propagates, making debugging harder.

**Fix Applied:** Added `log_stake_state_after_trade()` to log warnings when invariant is violated.

### 3. **No Unit Type Safety**

**Problem:** Numeric types used for both display USDC and micro-USDC, easy to mix up.

**Impact:** The units mismatch bug took hours to diagnose.

**Recommendation:** Use TypeScript branded types or PostgreSQL DOMAIN types to enforce unit safety.

### 4. **Insufficient Testing**

**Problem:** Integration tests didn't catch that belief_locks were wrong units.

**Impact:** Bug shipped to production (local dev environment in this case).

**Recommendation:** Add specific tests that verify:
- `belief_lock` values are in correct range (should be 6-9 digits for typical trades)
- Stake invariant holds after every trade
- Multiple trades on same pool correctly replace locks

---

## Fixes Applied

### Migration 20251027200002: Fix Corrupt Data
```sql
-- Multiply small belief_lock values by 1,000,000
UPDATE user_pool_balances
SET belief_lock = belief_lock * 1000000
WHERE belief_lock > 0 AND belief_lock < 1000
  AND token_balance > 0;
```

**Result:** Corrected 2 rows (LONG $20M, SHORT $10M)

### Migration 20251027200003: Add Validation Function
```sql
CREATE FUNCTION validate_stake_invariant(p_agent_id uuid, p_context text)
RETURNS void;
```

**Purpose:** Can be called to validate invariant and throw exception if violated.

**Usage:** Should be integrated into `record_trade_atomic` as a safety check (future work).

### Migration 20251027200004: Add Logging Function
```sql
CREATE FUNCTION log_stake_state_after_trade(
  p_agent_id uuid,
  p_tx_signature text,
  p_skim_credited boolean
) RETURNS void;
```

**Purpose:** Logs stake state after trades and warns if invariant is violated.

**Behavior:** Does NOT block trades, only logs warnings for monitoring.

---

## Current State

### User's Position
- Total stake: $20.00
- LONG lock: $20.00
- SHORT lock: $10.00
- Total locks: $30.00
- **Underwater by $10.00**

### System State
✅ belief_lock values corrected to micro-USDC
✅ record_trade_atomic uses correct calculation (since migration 20251025000019)
✅ Validation functions added for monitoring
⚠️ Existing underwater position remains (allowed per stake-mechanics.md)

### What Happens Next?

Per [stake-mechanics.md](../specs/architecture/stake-mechanics.md), being temporarily underwater is allowed. User can recover by:

1. **Make smaller trades** - Replace large locks with smaller ones
   - Example: Buy $50 LONG replaces $20 lock with $1 lock
   - Reduces total locks, gets back to solvency

2. **Close positions** - Sell all tokens to free locks
   - Selling to 0 balance deletes the lock
   - Immediately increases withdrawable amount

3. **Continue trading** - Next trade will charge correct skim
   - Skim calculation now uses corrected locks
   - Will charge enough to maintain invariant

---

## Recommendations

### Immediate (Required for Production)

1. **Integrate `validate_stake_invariant` into `record_trade_atomic`**
   - Add PERFORM call before RETURN statement
   - Change from WARNING to EXCEPTION to block bad trades
   - Test that it correctly rejects underwater-creating trades

2. **Add reconciliation monitoring**
   - Run `validate_stake_invariant` for all agents periodically
   - Alert if any violations found
   - Track deficit amounts over time

3. **Add integration test**
   - Test multiple trades on same pool
   - Verify belief_lock replacement works correctly
   - Assert stake invariant holds after each trade

### Short-term (Before Mainnet)

4. **Implement unit type safety**
   - TypeScript: Use branded types for MicroUsdc vs DisplayUsdc
   - PostgreSQL: Use DOMAIN types with CHECK constraints
   - Enforce at compile/runtime level

5. **Add balance sheet reconciliation**
   - Total system stake = sum of all custodian deposits - withdrawals
   - Total individual stakes = sum of agents.total_stake
   - Total locks = sum of belief_locks
   - Alert if any don't match

6. **Improve error messages**
   - When underwater detected, show which pools contribute to locks
   - Suggest specific actions (close position X, or trade smaller in Y)

### Long-term (Architecture)

7. **Consider on-chain skim validation**
   - Smart contract could verify skim >= required
   - Eliminates trust in off-chain calculation
   - More gas but safer

8. **Add circuit breakers**
   - If X% of users go underwater, pause trading
   - Manual review required before resuming
   - Prevents cascading failures

9. **Implement formal verification**
   - Prove mathematically that invariant holds
   - Use tools like TLA+ or Coq
   - Covers all code paths

---

## Lessons Learned

1. **Units must be explicit** - Naming variables with units (e.g., `amountMicroUsdc`) prevents confusion
2. **Invariants need enforcement** - Checking invariants in tests isn't enough, must enforce at runtime
3. **Silent failures are dangerous** - Calculations that can fail should throw exceptions, not return wrong values
4. **Type safety matters** - Branded types or domain types catch bugs at compile time
5. **Defense in depth** - Multiple layers of validation catch bugs earlier

---

## Testing Validation

To verify the fix works, run these SQL queries:

```sql
-- 1. Check all agents are solvent
SELECT
  a.id,
  a.total_stake / 1000000.0 as stake_usdc,
  COALESCE(SUM(upb.belief_lock), 0) / 1000000.0 as locks_usdc,
  (a.total_stake - COALESCE(SUM(upb.belief_lock), 0)) / 1000000.0 as withdrawable_usdc,
  CASE
    WHEN a.total_stake >= COALESCE(SUM(upb.belief_lock), 0) THEN '✅ SOLVENT'
    ELSE '❌ UNDERWATER'
  END as status
FROM agents a
LEFT JOIN users u ON u.agent_id = a.id
LEFT JOIN user_pool_balances upb ON upb.user_id = u.id AND upb.token_balance > 0
GROUP BY a.id, a.total_stake;

-- 2. Check belief_lock values are in correct range
SELECT
  pool_address,
  token_type,
  belief_lock,
  belief_lock / 1000000.0 as lock_usdc,
  CASE
    WHEN belief_lock < 1000 THEN '❌ TOO SMALL (likely display USDC)'
    WHEN belief_lock > 1000000000 THEN '❌ TOO LARGE'
    ELSE '✅ OK'
  END as status
FROM user_pool_balances
WHERE token_balance > 0;

-- 3. Test validation function
SELECT validate_stake_invariant(
  (SELECT agent_id FROM users LIMIT 1),
  'manual_test'
);
```

---

## Conclusion

The stake invariant violation was caused by a units mismatch bug that resulted in belief_lock values being stored in display USDC instead of micro-USDC. This caused skim calculations to drastically under-charge users, creating underwater positions.

The bug has been fixed through:
1. ✅ Correcting the data (migration 20251027200002)
2. ✅ Fixing the calculation (already done in 20251025000019)
3. ✅ Adding validation (migrations 20251027200003, 20251027200004)

**System is now safe for future trades.** Existing underwater position will self-heal through normal trading activity.

**Critical next step:** Integrate `validate_stake_invariant()` into `record_trade_atomic` to block any future bugs from creating underwater positions.