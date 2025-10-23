# On-Manifold Deployment Precision Issue

## Problem Summary

The `deploy_market` instruction in ContentPool is failing with `InvalidAllocation` error because the calculated token amounts (`s_long` and `s_short`) are rounding to zero due to numerical precision loss in the current formula.

## Current Implementation

Location: `programs/veritas-curation/src/content_pool/instructions/deploy_market.rs:218-288`

Current formula (lines 218-272):
```rust
// Step 1: v_l = long_allocation / p0, v_s = short_allocation / p0
// (use a 1e6 scale K to keep precision: v' = K * v)
const K: u128 = USDC_PRECISION as u128; // 1_000_000

let v_l = (long_allocation * K) / p0;
let v_s = (short_allocation * K) / p0;

// Step 2: pin the larger side to p0
let v_ref = v_l.max(v_s);

// Step 3: ||v||^2
let v_norm2 = v_l^2 + v_s^2;

// Step 4: t = D·v_ref / (p0·K·||v||²)
let denominator = p0 * v_norm2 * K;
let t = (initial_deposit * v_ref) / denominator;

// Step 5: s = floor(t * v / K)
let s_long = (t * v_l) / K;
let s_short = (t * v_s) / K;
```

## The Problem

### Example with realistic values:
- `initial_deposit = 100_000_000` (100 USDC, 6 decimals)
- `long_allocation = 60_000_000` (60 USDC)
- `short_allocation = 40_000_000` (40 USDC)
- `p0 = 1_000_000` (1 USDC, from factory defaults)
- `K = 1_000_000`

### Calculation breakdown:
```
v_l = (60_000_000 * 1_000_000) / 1_000_000 = 60_000_000
v_s = (40_000_000 * 1_000_000) / 1_000_000 = 40_000_000
v_ref = max(60_000_000, 40_000_000) = 60_000_000
v_norm2 = 60_000_000² + 40_000_000² = 5_200_000_000_000_000
denominator = 1_000_000 * 5_200_000_000_000_000 * 1_000_000
            = 5_200_000_000_000_000_000_000

t = (100_000_000 * 60_000_000) / 5_200_000_000_000_000_000_000
  = 6_000_000_000_000_000 / 5_200_000_000_000_000_000_000
  ≈ 0.00115 (rounds to 0 in integer math!)

s_long = (0 * 60_000_000) / 1_000_000 = 0 ❌
s_short = (0 * 40_000_000) / 1_000_000 = 0 ❌
```

The denominator is far too large, causing `t` to round to zero, which makes both token amounts zero.

## Expected Behavior

Based on test expectations (lines 448-464 of content-pool-icbs.test.ts):

The deployment should satisfy: **C(s) = λ·||s|| ≈ initial_deposit**

Where:
- `C(s)` = cost function
- `λ` = lambda parameter (related to p0)
- `||s|| = sqrt(s_L² + s_S²)` = L2 norm of supply vector
- The token amounts should be on the bonding curve manifold
- The reserve split should approximately match the allocation percentages

### Invariants that must hold:
1. `s_long > 0` and `s_short > 0` (both non-zero)
2. Each side should have at least `10 * p0` allocation (10 USDC minimum per side)
3. Token supplies should match pool state
4. `C(s) ≈ initial_deposit` (within 1 lamport)
5. The calculated `q = R_L / R_total` should approximately match `long_allocation / initial_deposit`

## ICBS Parameters

From factory defaults (`pool_factory/state.rs:59`):
- `F = 1` (growth exponent)
- `β = 0.5` (coupling coefficient)
- `p0 = 1_000_000` (1.0 USDC in micro-USDC)

Cost function: `C(s_L, s_S) = (s_L^(F/β) + s_S^(F/β))^β`
With F=1, β=0.5: `C(s_L, s_S) = (s_L² + s_S²)^0.5 = ||s||`

So the simplified cost function is just the L2 norm!

## What We Need

A corrected on-manifold deployment formula that:

1. **Avoids precision loss** - Should not have enormous denominators that cause rounding to zero
2. **Respects the bonding curve** - Token amounts should lie on the ICBS manifold
3. **Matches allocation percentages** - If 60% of deposit goes to LONG, the reserve split should reflect that
4. **Produces non-zero token amounts** - Must pass the validation checks

## Related Code

- Test file: `tests/content-pool-icbs.test.ts:368-470` (first deployment test)
- Error definition: `programs/veritas-curation/src/content_pool/errors.rs` (ContentPoolError::InvalidAllocation)
- Helper function: `programs/veritas-curation/src/content_pool/math.rs` (mul_div_u128)
- ICBS spec: `specs/solana-specs/smart-contracts/icbs-high-level.md`

## Test Output

The test currently fails with:
```
Error: AnchorError thrown in programs/veritas-curation/src/content_pool/instructions/deploy_market.rs:281.
Error Code: InvalidAllocation. Error Number: 6007.
Error Message: Invalid LONG/SHORT allocation.
```

This happens at line 281-283 which checks `require!(s_long > 0, ContentPoolError::InvalidAllocation)`.

## Questions for Analysis

1. Is the current formula mathematically correct for ICBS on-manifold deployment?
2. Can we reformulate to avoid the precision loss?
3. Should we use a different scaling factor than K = 1_000_000?
4. Is there a simpler closed-form solution given that F=1, β=0.5?
5. How should we handle the relationship between p0, λ, and the initial deployment?

## Additional Context

- All calculations use u128 for intermediate values
- Final token amounts must fit in u64
- The `mul_div_u128` helper is available for high-precision division
- Token decimals = 6 (same as USDC)
- Price calculations use Q96 fixed-point format (sqrt prices)
