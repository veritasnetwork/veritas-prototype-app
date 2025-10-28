# Architecture Decision Records

## ADR-001: Abandon Time-Based Decay Mechanism

**Date:** October 26, 2025
**Status:** Accepted
**Decision Makers:** Core Team

### Context

The original design included a time-based decay mechanism where pool reserves would decay based on inactivity:
- Decay would reduce `r_long` and `r_short` over time
- Multiple tiers of decay rates (1%, 2%, 3% per day)
- Intended to discourage speculation on stale content

After implementing sigma virtualization (where lambda is derived from `vault / ||ŝ||`), we discovered a fundamental conflict:

**The Problem:**
```rust
// Decay modifies reserves:
r_long = 900, r_short = 450  // 10% decay applied

// But vault/supplies/sigma unchanged:
vault = 1000, s_long = 10, s_short = 5

// Next trade derives lambda from vault:
lambda = vault / ||ŝ|| = SAME AS BEFORE

// Trade recalculates reserves:
r_long = s_long * p_long = BACK TO 1000
// Decay effects erased!
```

**To make decay work, we would need to:**
1. Modify vault balance (remove USDC from system)
2. Transfer decayed USDC to treasury
3. Complex accounting and migration
4. Risk of USDC leakage bugs

### Decision

**We abandon the decay mechanism entirely.**

### Rationale

1. **Settlement provides sufficient economic incentive**
   - Pools already settle based on BD scores
   - Accurate traders gain, inaccurate lose
   - No need for additional time-based penalty

2. **Complexity >> Benefit**
   - 22 files to change
   - Migration required for all existing pools
   - 5.5 days implementation time
   - Ongoing maintenance burden
   - Potential for bugs in USDC handling

3. **Feed ranking can be done in frontend**
   - If we want older posts to rank lower, do it in feed algorithm
   - No smart contract changes needed
   - Instantly tunable

4. **No user demand**
   - Feature was speculative
   - No evidence users want it
   - Settlement mechanism already working

### Consequences

**Positive:**
- ✅ Simpler smart contracts
- ✅ No migration needed
- ✅ Lower maintenance burden
- ✅ Less surface area for bugs
- ✅ Faster development velocity

**Negative:**
- ❌ No automatic penalty for stale content
- ❌ Pool reserves don't shrink over time
- ❌ Feed ranking needs alternative solution (if desired)

**Neutral:**
- Existing fields in ContentPool remain (`expiration_timestamp`, `last_decay_update`)
- Fields are unused but harmless (30-day expiration still set, never used)
- Can be repurposed later if needed

### Implementation

**No action required.** Current code has decay infrastructure but it's never triggered in production:
- `decay.rs` exists but `apply_decay_if_needed` returns early (1 day minimum)
- Pools set `expiration_timestamp = creation + 30 days`
- But no code path actually applies decay after expiration
- Reserves only change via trades and settlement

**If feed ranking by age is desired later:**
- Implement in `FeedRankingService.ts` (frontend)
- Use `last_trade_timestamp` or `deployed_at` as age metric
- Apply exponential penalty to relevance score
- ~2 hours implementation

### Future Considerations

If decay is reconsidered in the future, we would need to:
1. Solve the vault balance problem (decay must reduce vault)
2. Design USDC treasury mechanism
3. Implement comprehensive migration
4. Add extensive tests for USDC accounting

Until there's clear user demand, **YAGNI** (You Aren't Gonna Need It) applies.

---

## ADR-002: Sigma Virtualization for Settlement Scaling

**Date:** October 25, 2025
**Status:** Implemented

### Context

Settlement needed to scale reserves without changing actual token supplies or vault balances.

### Decision

Implement sigma virtualization:
- Add `s_scale_long_q64` and `s_scale_short_q64` to ContentPool
- Lambda derived from `vault / ||ŝ||` where `ŝ = s / σ`
- Settlement multiplies sigma scales: `σ *= f`
- Trades compute prices using virtual supplies

### Rationale

- Allows reserve scaling without breaking AMM invariants
- No USDC transferred during settlement
- Preserves token supply accounting

### Implementation

See `docs/SIGMA_VIRTUALIZATION_MASTER.md` for complete details.

**Status:** ✅ Complete

---

## Template for Future ADRs

```markdown
## ADR-XXX: [Title]

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Deprecated | Superseded]

### Context
[What is the issue/problem?]

### Decision
[What we decided to do]

### Rationale
[Why this decision?]

### Consequences
[What are the implications?]

### Implementation
[How to implement or current status]
```
