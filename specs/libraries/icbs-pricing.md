# ICBS Pricing Library

## Overview
Client-side price calculation library for ICBS (Inversely Coupled Bonding Surface) markets. Implements same mathematics as Rust smart contract for accurate trade estimation and UI display.

## Context
- **Layer:** App
- **Location:** `src/lib/solana/icbs-pricing.ts`
- **Used By:** UnifiedSwapComponent, PoolMetricsCard, TradingHistoryChart
- **Dependencies:** None (pure math functions)
- **Status:** Implemented

---

## High-Level Design

### Flow
1. UI needs price for LONG or SHORT token
2. Call `calculateICBSPrice()` with current supplies
3. Calculate marginal price using ICBS formula
4. Return price in USDC per token
5. Use for trade estimates or display

### State Changes
None (pure functions, no state)

### Key Decisions
- **Parity with Rust contract:** Math must exactly match on-chain calculations
- **X96 format support:** Square root prices use 96-bit fixed-point for precision
- **Binary search for trade estimates:** Iterative approach for tokens_out given USDC_in
- **Average price for trades:** Uses (price_before + price_after) / 2 for cost estimation

---

## Implementation

### Functions

| Function | Signature | Purpose |
|----------|-----------|---------|
| `calculateICBSPrice` | `(sLong, sShort, side, lambda, f, beta) => number` | Marginal price for LONG or SHORT |
| `calculateSqrtPriceX96` | `(sLong, sShort, side, sqrtLambda, f, beta) => bigint` | Sqrt price in X96 format |
| `calculateMarketPrediction` | `(sLong, sShort, lambdas, f, beta) => number` | Market prediction q (0-1) |
| `estimateTokensOut` | `(supply, otherSupply, usdcIn, side, ...) => number` | Tokens received for USDC |
| `estimateUsdcOut` | `(supply, otherSupply, tokensIn, side, ...) => number` | USDC received for tokens |

### Mathematical Formulas

**ICBS Marginal Price:**
```
p = λ × F × s^(F/β - 1) × (s_L^(F/β) + s_S^(F/β))^(β - 1)

Where:
- λ (lambda): Scaling factor (typically 1.0)
- F: Growth exponent (default 2)
- β (beta): Coupling parameter (β_num / β_den, default 1/2 = 0.5)
- s: Supply of the token side being priced
- s_L, s_S: Supplies of LONG and SHORT tokens
```

**Market Prediction:**
```
q = R_L / (R_L + R_S)

Where:
- R_L = s_L × p_L (virtual reserve LONG)
- R_S = s_S × p_S (virtual reserve SHORT)
```

**Default Parameters:**
- F = 2 (changed from 3 to reduce slippage)
- β_num = 1, β_den = 2 (β = 0.5)
- λ = 1.0

### Data Structures

```typescript
enum TokenSide {
  Long = 'long',
  Short = 'short'
}

// X96 format constant
const Q96 = BigInt(1) << BigInt(96); // 2^96
```

### calculateICBSPrice

**Signature:**
```typescript
function calculateICBSPrice(
  sLong: number,        // LONG supply (atomic units, 6 decimals)
  sShort: number,       // SHORT supply (atomic units, 6 decimals)
  side: TokenSide,      // Which token to price
  lambdaScale: number = 1.0,
  f: number = 2,
  betaNum: number = 1,
  betaDen: number = 2
): number               // Price in USDC per token
```

**Steps:**
1. Get supply for requested side (s = LONG or SHORT)
2. Handle zero supply edge case → return lambda
3. Convert supplies to display units (÷ 1,000,000)
4. Calculate F/β ratio
5. Calculate s^(F/β - 1)
6. Calculate s_L^(F/β) + s_S^(F/β)
7. Calculate (sum)^(β - 1)
8. Multiply: λ × F × s^(F/β - 1) × (sum)^(β - 1)

**Edge Cases:**
- s = 0 → return lambdaScale (minimum price)
- Very large supplies → May hit JavaScript number precision limits

### calculateSqrtPriceX96

**Signature:**
```typescript
function calculateSqrtPriceX96(
  sLong: number,
  sShort: number,
  side: TokenSide,
  sqrtLambdaX96: bigint = Q96,
  f: number = 2,
  betaNum: number = 1,
  betaDen: number = 2
): bigint                // sqrt(price) * 2^96
```

**Purpose:** Compatibility with smart contract's X96 sqrt price format

**Steps:**
1. Calculate regular price using `calculateICBSPrice`
2. Take square root of price
3. Multiply by 2^96 and convert to BigInt
4. Multiply by sqrtLambdaX96 and divide by Q96

**Use Case:** Matching on-chain price representation

### calculateMarketPrediction

**Signature:**
```typescript
function calculateMarketPrediction(
  sLong: number,
  sShort: number,
  lambdaLong: number = 1.0,
  lambdaShort: number = 1.0,
  f: number = 2,
  betaNum: number = 1,
  betaDen: number = 2
): number                 // Prediction q in range [0, 1]
```

**Purpose:** Calculate market's implied probability (reserve ratio)

**Steps:**
1. Calculate price for LONG tokens
2. Calculate price for SHORT tokens
3. Calculate virtual reserves: R = s × p
4. Return q = R_L / (R_L + R_S)

**Edge Cases:**
- R_L + R_S = 0 → return 0.5 (50% default)

### estimateTokensOut

**Signature:**
```typescript
function estimateTokensOut(
  currentSupply: number,
  otherSupply: number,
  usdcIn: number,
  side: TokenSide,
  lambdaScale: number = 1.0,
  f: number = 2,
  betaNum: number = 1,
  betaDen: number = 2
): number                  // Tokens received
```

**Purpose:** Estimate tokens received for a USDC buy trade

**Algorithm:** Binary search to find token amount
1. Set bounds: low = 0, high = usdcIn × 100
2. While low ≤ high:
   - mid = (low + high) / 2
   - Calculate newSupply = currentSupply + mid × 1,000,000
   - Calculate priceBefore and priceAfter
   - avgPrice = (priceBefore + priceAfter) / 2
   - cost = avgPrice × mid
   - If |cost - usdcIn| < tolerance → return mid
   - If cost < usdcIn → low = mid + 0.001
   - Else → high = mid - 0.001
3. Return best result

**Tolerance:** 0.01 USDC (1 cent)

**Edge Cases:**
- usdcIn = 0 → returns 0
- Very large usdcIn → May not converge (increase high bound)

### estimateUsdcOut

**Signature:**
```typescript
function estimateUsdcOut(
  currentSupply: number,
  otherSupply: number,
  tokensIn: number,
  side: TokenSide,
  lambdaScale: number = 1.0,
  f: number = 2,
  betaNum: number = 1,
  betaDen: number = 2
): number                   // USDC received
```

**Purpose:** Estimate USDC received for selling tokens

**Steps:**
1. Calculate newSupply = max(0, currentSupply - tokensIn × 1,000,000)
2. Calculate priceBefore (current price)
3. Calculate priceAfter (price after sell)
4. avgPrice = (priceBefore + priceAfter) / 2
5. Return avgPrice × tokensIn

**Edge Cases:**
- tokensIn > currentSupply / 1,000,000 → newSupply = 0
- tokensIn = 0 → returns 0

### Edge Cases Summary

| Condition | Handling |
|-----------|----------|
| Supply = 0 | Return lambda (minimum price) |
| Total reserves = 0 | Market prediction = 0.5 (default 50%) |
| Sell more tokens than supply | Clamp to max(0, supply - tokens) |
| Binary search doesn't converge | Return best result within max iterations |
| JavaScript precision limit | Potential issue with very large numbers (billions+) |

### Errors

| Error Type | Condition | Thrown By |
|------------|-----------|-----------|
| N/A | All functions are defensive, no throws | All handle edge cases gracefully |

**Note:** These are pure math functions that handle edge cases by returning sensible defaults rather than throwing errors.

---

## Integration

### Usage in Swap Component

```typescript
const priceLong = calculateICBSPrice(
  poolData.supplyLong,
  poolData.supplyShort,
  TokenSide.Long,
  1.0,
  poolData.f,
  poolData.betaNum,
  poolData.betaDen
);

const tokensOut = estimateTokensOut(
  poolData.supplyLong,
  poolData.supplyShort,
  usdcAmount,
  TokenSide.Long,
  1.0,
  poolData.f,
  poolData.betaNum,
  poolData.betaDen
);
```

### Usage in Chart

```typescript
// Calculate prices over time for historical data
const prices = tradeHistory.map(trade => ({
  timestamp: trade.timestamp,
  priceLong: calculateICBSPrice(
    trade.supply_long,
    trade.supply_short,
    TokenSide.Long,
    ...
  ),
  priceShort: calculateICBSPrice(
    trade.supply_long,
    trade.supply_short,
    TokenSide.Short,
    ...
  )
}));
```

### Parity with Rust Contract

**Critical:** Calculations must match smart contract exactly

**Verification:**
1. Run unit tests comparing JS output to Rust contract output
2. Test with various supply combinations
3. Verify edge cases (zero supply, equal supplies, extreme ratios)

---

## Testing

### Critical Paths
1. Calculate price for various supply ratios → Matches expected values
2. Estimate tokens for USDC → Binary search converges correctly
3. Estimate USDC for tokens → Average price calculation correct
4. Market prediction calculation → Returns value in [0, 1]
5. Parity with Rust contract → JS and Rust output identical

### Test Implementation
- **Test Spec:** `specs/test-specs/libraries/icbs-pricing.test.md`
- **Test Code:** `tests/lib/icbs-pricing.test.ts`

### Validation
- Unit tests for all functions
- Parity tests: compare with Rust contract output
- Edge case coverage: zero supply, equal supplies, large values
- Precision tests: verify accuracy within acceptable tolerance

---

## References
- Code: `src/lib/solana/icbs-pricing.ts`
- Smart Contract: `solana/veritas-curation/programs/veritas-curation/src/content_pool/math.rs`
- Sqrt Helpers: `specs/libraries/sqrt-price-helpers.md`
- Used In: `src/components/post/PostDetailPanel/UnifiedSwapComponent.tsx:156`
- Related: `specs/solana-specs/smart-contracts/ICBS-market.md`
