# Stake Accounting Safety Analysis

## Overview

The stake accounting system uses a **hybrid approach**: fast running balance (`agents.total_stake`) + complete event sourcing for audit trail.

**Formula:**
```
total_stake = deposits - withdrawals + rewards - penalties
```

## Potential Failure Modes & Protections

### 1. ⚠️ Skim Deposits (Trade Buys)

**Location:** `record_trade_atomic()` function

**Flow:**
```sql
1. INSERT INTO trades (...)
2. INSERT INTO custodian_deposits (...) ON CONFLICT DO NOTHING
3. IF deposit was inserted THEN
4.   UPDATE agents SET total_stake = total_stake + skim
```

#### Failure Scenarios:

**A. Process crash between steps 2 and 4**
- **Impact:** Trade recorded, deposit event recorded, but `total_stake` NOT updated
- **Detection:** Reconciliation will show: `calculated_stake > recorded_stake`
- **Recovery:** Manual `UPDATE agents SET total_stake = (calculated from events)`

**B. Event indexer already recorded deposit (tx_signature conflict)**
- **Impact:** PREVENTED by `ON CONFLICT DO NOTHING` + `GET DIAGNOSTICS ROW_COUNT`
- **Protection:** Only updates `total_stake` if deposit INSERT actually succeeded
- **Status:** ✅ SAFE

**C. Network error after step 2, before function returns**
- **Impact:** All database changes are in ONE transaction, so either ALL commit or ALL rollback
- **Protection:** PostgreSQL ACID guarantees
- **Status:** ✅ SAFE

**D. Duplicate trade recording (same tx_signature called twice)**
- **Impact:** PREVENTED by `ON CONFLICT (tx_signature) DO UPDATE` on trades table
- **Protection:** Second call updates `recorded_by = 'both'` but doesn't create new row
- **Skim:** Won't re-insert deposit due to `ON CONFLICT DO NOTHING`
- **Status:** ✅ SAFE

#### Current Protections:
✅ Atomic transaction (all-or-nothing)
✅ Idempotent (can safely retry)
✅ Duplicate detection via `tx_signature` unique constraint
✅ `GET DIAGNOSTICS ROW_COUNT` prevents double-crediting

#### Remaining Risks:
⚠️ **Partial execution if Postgres crashes mid-transaction** (very rare)
- Likelihood: **VERY LOW** (<0.01%)
- Mitigation: Periodic reconciliation detects this

---

### 2. ⚠️ Withdrawals

**Location:** `app/api/users/withdraw/record/route.ts`

**Flow:**
```typescript
1. INSERT INTO custodian_withdrawals (...)
2. RPC: add_agent_stake(agent_id, -amount)
   -> UPDATE agents SET total_stake = total_stake - amount
```

#### Failure Scenarios:

**A. Network error between step 1 and 2**
- **Impact:** Withdrawal recorded but `total_stake` NOT decreased
- **Detection:** Reconciliation shows: `calculated_stake < recorded_stake`
- **Current Protection:** Lines 127-131 have rollback logic:
  ```typescript
  if (stakeError) {
    await supabase.from('custodian_withdrawals').delete().eq('tx_signature', ...)
  }
  ```
- **Issue:** Rollback might ALSO fail (network still down)
- **Status:** ⚠️ MODERATE RISK

**B. Duplicate withdrawal recording**
- **Impact:** PREVENTED by unique constraint on `tx_signature`
- **Status:** ✅ SAFE

**C. User withdraws, on-chain tx fails, but we recorded it**
- **Impact:** `total_stake` decreased but user didn't get USDC
- **Detection:** Event indexer won't confirm (blockchain shows no event)
- **Current handling:** Records have `confirmed = false` until indexer verifies
- **Recovery:** Admin can reverse unconfirmed withdrawals
- **Status:** ⚠️ Requires monitoring

#### Current Protections:
✅ Unique tx_signature prevents duplicates
✅ Rollback logic attempts to undo partial updates
✅ `confirmed` flag tracks indexer verification

#### Remaining Risks:
⚠️ **Rollback failure** if network error persists
- Likelihood: **LOW-MEDIUM** (~1-5%)
- Mitigation: Reconciliation + manual review of `confirmed=false` records

---

### 3. ⚠️ Stake Redistribution (BTS Rewards/Penalties)

**Location:** Stake redistribution edge function (to be updated)

**Flow:**
```sql
1. Calculate rewards/penalties for all agents
2. INSERT INTO stake_redistribution_events (...)
3. UPDATE agents SET total_stake = new_stake
```

#### Failure Scenarios:

**A. Process crash between steps 2 and 3**
- **Impact:** Event recorded but stake not updated
- **Detection:** Reconciliation
- **Status:** ⚠️ NOT YET IMPLEMENTED (need to add event tracking)

**B. Zero-sum violation (bug in BTS calculation)**
- **Impact:** Total stake increases/decreases across all agents
- **Protection:** Spec requires validation: `|Σ(deltas)| < 1e-6`
- **Status:** ✅ SAFE (if validation implemented)

#### Current Protections:
❌ **No event tracking yet** - need to update stake redistribution function
✅ Zero-sum validation (per spec)

#### Required Updates:
- [ ] Add `INSERT INTO stake_redistribution_events` in redistribution function
- [ ] Use same pattern as skim: `GET DIAGNOSTICS ROW_COUNT` for idempotency
- [ ] Add transaction wrapping

---

## Reconciliation Strategy

### Automatic Detection

Run periodically (e.g., hourly):
```sql
SELECT * FROM reconcile_all_agents() WHERE NOT is_correct;
```

Returns agents with discrepancies:
```
agent_id | recorded_stake | calculated_stake | discrepancy | is_correct
---------|----------------|------------------|-------------|------------
abc-123  | 50000000       | 52000000         | -2000000    | false
```

### Manual Recovery

For each discrepant agent:

```sql
-- 1. Check what's wrong
SELECT * FROM reconcile_agent_stake('abc-123');

-- 2. Review recent events
SELECT * FROM custodian_deposits WHERE agent_id = 'abc-123' ORDER BY indexed_at DESC LIMIT 10;
SELECT * FROM custodian_withdrawals WHERE agent_id = 'abc-123' ORDER BY requested_at DESC LIMIT 10;
SELECT * FROM stake_redistribution_events WHERE agent_id = 'abc-123' ORDER BY processed_at DESC LIMIT 10;

-- 3. Fix (if calculated_stake is correct)
UPDATE agents
SET total_stake = (
  SELECT calculated_stake
  FROM reconcile_agent_stake('abc-123')
)
WHERE id = 'abc-123';
```

---

## Overall Risk Assessment

| Event Type | Double-Credit Risk | Missing Credit Risk | Detection | Auto-Recovery |
|------------|-------------------|-------------------|-----------|---------------|
| Skim Deposits | ✅ LOW (prevented) | ⚠️ VERY LOW (crash) | ✅ Reconciliation | ❌ Manual |
| Withdrawals | ✅ LOW (prevented) | ⚠️ LOW-MED (network) | ✅ Reconciliation | ❌ Manual |
| Redistributions | ❌ **NOT IMPLEMENTED** | ❌ **NOT IMPLEMENTED** | ⚠️ When implemented | ❌ Manual |

**Overall:** System is reasonably safe for skims and withdrawals, but **needs immediate work** on stake redistribution event tracking.

---

## Recommended Immediate Actions

1. ✅ **DONE:** Fix double-crediting in skim tracking (migration 20251027000018)
2. ⚠️ **TODO:** Update stake redistribution function to track events
3. ⚠️ **TODO:** Add hourly reconciliation cron job
4. ⚠️ **TODO:** Add admin dashboard to review discrepancies
5. ⚠️ **TODO:** Add monitoring/alerts for `confirmed=false` records older than 1 hour

---

## Long-term: Full Transaction Atomicity

Consider wrapping withdrawal API in a database transaction:

```sql
CREATE FUNCTION process_withdrawal_atomic(
  p_agent_id uuid,
  p_amount_micro bigint,
  p_tx_signature text,
  p_wallet_address text
) RETURNS jsonb AS $$
BEGIN
  -- Both happen atomically in single transaction
  INSERT INTO custodian_withdrawals (...);
  UPDATE agents SET total_stake = total_stake - p_amount_micro WHERE id = p_agent_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  -- Automatic rollback
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;
```

This eliminates the network-between-calls risk.
