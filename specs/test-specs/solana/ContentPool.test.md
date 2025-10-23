# ContentPool Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript/Rust
- **Location:** `/solana/veritas-curation/tests/`

## Overview
ContentPool implements an ICBS (Inversely Coupled Bonding Surface) market for content relevance speculation. This test specification covers the new architecture with:
- ICBS cost function with **fixed parameters (F=1, β=0.5)** for numerical stability
- Virtual reserves (R_L, R_S) tracked on-chain for settlement
- SPL token minting/burning for LONG and SHORT positions
- Epoch settlement with BD score integration (micro-unit format: 0-1,000,000)

## Test Categories

### 1. Pool Initialization

#### 1.1 Empty Pool Creation
**Purpose:** Verify pool can be created via PoolFactory
```typescript
it("creates empty pool with factory reference")
// Setup: Deploy PoolFactory
// Action: Call PoolFactory::create_pool with content_id
// Assert: Pool created with:
//   - content_id matches input
//   - creator set correctly
//   - factory reference set
//   - F, beta_num, beta_den from factory defaults
//   - market_deployer = Pubkey::default() (not deployed yet)
//   - All supplies and reserves = 0
```

#### 1.2 Parameter Validation
**Purpose:** Ensure ICBS parameters are validated at factory level
```typescript
it("validates F parameter bounds (1-10)")
// Test F = 0, 11 - should fail
// Test F = 1, 5, 10 - should succeed
// Note: Current implementation uses F=1 for all pools

it("validates beta coefficient bounds (0.1-0.9)")
// Test beta_num/beta_den ratios outside bounds - should fail
// Test valid ratios - should succeed
// Note: Current implementation uses β=0.5 (1/2) for all pools
```

### 2. Market Deployment

#### 2.1 First Trader Deployment
**Purpose:** Verify market deployment mechanics
```typescript
it("allows first trader to deploy market with initial liquidity")
// Setup: Create empty pool
// Action: Call deploy_market with 100 USDC, 60% LONG allocation
// Assert:
//   - market_deployer set to trader
//   - LONG and SHORT mints created
//   - Vault created and funded
//   - initial_q ≈ 0.6 (60% LONG) in Q32.32 format
//   - Tokens minted at 1:1 flat rate (1 USDC = 1 token)
//   - Lambda values calculated for unit price (p_L = p_S = 1.0 USDC)
//   - Virtual reserves initialized (R_L = 60 USDC, R_S = 40 USDC)

it("enforces minimum initial deposit ($100)")
// Try with 50 USDC - should fail
// Try with 100 USDC - should succeed

it("prevents duplicate market deployment")
// Deploy market once
// Try to deploy again - should fail with MarketAlreadyDeployed
```

#### 2.2 Token Distribution
**Purpose:** Verify initial token allocation
```typescript
it("mints tokens at 1:1 flat rate during deployment")
// Deploy with 100 USDC, 40% LONG (40 USDC LONG, 60 USDC SHORT)
// Assert: LONG tokens = 40_000_000 (40 USDC with 6 decimals)
// Assert: SHORT tokens = 60_000_000 (60 USDC with 6 decimals)
// Assert: pool.s_long = 40_000_000
// Assert: pool.s_short = 60_000_000
// Assert: pool.r_long = 40_000_000
// Assert: pool.r_short = 60_000_000
```

#### 2.3 Add Liquidity
**Purpose:** Verify liquidity provision after market deployment
```typescript
it("allows liquidity addition at current market ratio")
// Setup: Pool with deployed market
// Action: Call add_liquidity with 100 USDC
// Assert:
//   - USDC split by current reserve ratio: q * amount to LONG, (1-q) * amount to SHORT
//   - Tokens minted at current marginal prices
//   - Virtual reserves increased proportionally
//   - Market prediction q unchanged (no price movement)
//   - Vault balance increased by 100 USDC

it("bootstraps pricing from lambda for zero-supply sides")
// Setup: Pool with only LONG supply (s_short = 0)
// Action: Add liquidity (will allocate some to SHORT)
// Assert:
//   - SHORT tokens priced using sqrt_lambda_short_x96
//   - No arbitrage gap created
//   - Smooth transition to two-sided market

it("enforces minimum liquidity amount")
// Try to add 0 USDC - should fail
// Try to add 1 USDC - should succeed
```

### 3. ICBS Mathematics

#### 3.1 Cost Function Calculation
**Purpose:** Verify ICBS cost function implementation with F=1, β=0.5
```typescript
it("calculates cost function C(s_L, s_S) correctly")
// With F=1, β=0.5: C = (s_L^2 + s_S^2)^0.5 = ||s|| (L2 norm)
// Test with various supply combinations
// Verify R_total = R_L + R_S = C(s_L, s_S)

it("calculates marginal prices correctly")
// With F=1, β=0.5, marginal price formula simplifies to:
// p_L = λ_L × s_L / ||s||
// p_S = λ_S × s_S / ||s||
// where ||s|| = sqrt(s_L^2 + s_S^2)
// Verify prices match expected values after trades
```

#### 3.2 Virtual Reserves
**Purpose:** Verify reserve calculations
```typescript
it("maintains virtual reserves as R = s × p")
// After market deployment and trades
// Assert: R_L = s_L × p_L
// Assert: R_S = s_S × p_S
// Assert: R_total = R_L + R_S = C(s_L, s_S)

it("calculates market prediction q correctly")
// q = R_L / (R_L + R_S)
// Test various states
// Verify q ∈ [0, 1]
```

#### 3.3 Inverse Coupling
**Purpose:** Verify inverse price coupling property
```typescript
it("demonstrates inverse coupling on LONG buy")
// Initial state: record p_L and p_S
// Buy LONG tokens
// Assert: p_L increased
// Assert: p_S decreased
// Assert: Buying LONG made SHORT cheaper

it("demonstrates inverse coupling on SHORT buy")
// Initial state: record p_L and p_S
// Buy SHORT tokens
// Assert: p_S increased
// Assert: p_L decreased
// Assert: Buying SHORT made LONG cheaper
```

### 4. Trading Operations

#### 4.1 Buy Operations
**Purpose:** Test token purchasing
```typescript
it("executes LONG buy with correct token output")
// Buy with 50 USDC for LONG
// Calculate expected tokens from ICBS solver
// Assert: Tokens minted match calculation (within 0.01%)
// Assert: s_L increased correctly
// Assert: R_L updated
// Assert: Vault received USDC
// Assert: User's ATA created if needed

it("executes SHORT buy with correct token output")
// Similar test for SHORT side

it("applies stake skim on buys")
// Buy with 100 USDC, 10 USDC skim
// Assert: 90 USDC goes to trade
// Assert: 10 USDC goes to stake vault
// Assert: Tokens calculated from 90 USDC

it("enforces slippage protection on buys")
// Set min_tokens_out higher than actual
// Assert: Error code 6557 (SlippageExceeded)

it("auto-creates associated token account on first buy")
// User without ATA buys tokens
// Assert: ATA created with correct owner and mint
// Assert: Rent paid by user
```

#### 4.2 Sell Operations
**Purpose:** Test token redemption
```typescript
it("executes LONG sell with correct USDC output")
// Sell 100 LONG tokens
// Calculate expected USDC from ICBS solver
// Assert: USDC returned matches calculation (within 0.01%)
// Assert: s_L decreased correctly
// Assert: R_L updated
// Assert: Tokens burned from user's ATA
// Assert: Total supply decreased

it("executes SHORT sell with correct USDC output")
// Similar test for SHORT side

it("enforces slippage protection on sells")
// Set min_usdc_out higher than actual
// Assert: Error code 6557 (SlippageExceeded)
```

#### 4.3 Trade Size Limits
**Purpose:** Verify trade size validation
```typescript
it("enforces minimum trade size")
// Try trade with 0.0005 USDC (below 0.001 minimum)
// Assert: Error code 6520 (TradeTooSmall)

it("enforces maximum trade size")
// Try trade with 2M USDC (above 1M maximum)
// Assert: Error code 6521 (TradeTooLarge)
```

#### 4.4 SPL Token Operations
**Purpose:** Verify SPL token standard compliance
```typescript
it("allows token transfers between wallets")
// User A buys LONG tokens
// User A transfers to User B via SPL token program
// Assert: Standard SPL transfer succeeds
// Assert: Pool state unaffected
// User B can sell transferred tokens

it("allows users to burn tokens directly")
// User burns LONG tokens without selling
// Assert: Tokens destroyed permanently
// Assert: No USDC returned
// Assert: Pool reserves unchanged
// Note: User loses value but this is allowed
```

### 5. Settlement Mechanics

#### 5.1 BD Score Settlement
**Purpose:** Test epoch settlement with BD scores (micro-unit format)
```typescript
it("settles with BD score updating reserves")
// Setup: Pool with q ≈ 0.4 (40% LONG prediction)
// Action: Settle with bd_score = 600_000 (60% in micro-units)
// Calculate: f_L = 0.6/0.4 = 1.5, f_S = 0.4/0.6 = 0.67
// Assert: R_L scaled by 1.5
// Assert: R_S scaled by 0.67
// Assert: New q ≈ 0.6 (converged to actual)
// Assert: Lambda values updated (sqrt_lambda *= sqrt(f))

it("maintains zero-sum property in settlement")
// Before: R_total = R_L + R_S
// Settle with any BD score (0-1_000_000)
// After: R_total' = R_L' + R_S'
// Assert: R_total' ≈ R_total (within rounding tolerance)
```

#### 5.2 Settlement Constraints
**Purpose:** Verify settlement rules
```typescript
it("enforces settlement cooldown")
// Settle once
// Try to settle again immediately
// Assert: Error code 6014 (SettlementCooldown)
// Wait min_settle_interval (300s)
// Settle again successfully

it("validates BD score bounds")
// Try to settle with bd_score > 1_000_000 - should fail
// Try to settle with bd_score = 0 - should succeed (0%)
// Try to settle with bd_score = 1_000_000 - should succeed (100%)

it("clamps q to prevent division issues")
// Pool with extreme q near 0 or 1 (calculated from reserves)
// Settle with opposite extreme BD score
// Assert: q clamped to [0.1%, 99.9%] (1000-999000 in micro-units)
// Assert: No division by zero
```

#### 5.3 Authority Validation
**Purpose:** Ensure proper settlement authority
```typescript
it("requires protocol authority for settlement")
// Try settlement without protocol_authority
// Assert: Error code 6561 (UnauthorizedProtocol)

it("allows any user to trigger settlement with protocol sig")
// User calls settle_epoch (not protocol)
// Protocol authority co-signs
// Assert: Settlement succeeds
```

### 6. Pool Closure

#### 6.1 Close Conditions
**Purpose:** Test pool closure mechanics
```typescript
it("allows pool closure when no positions open")
// Create pool, deploy market, ensure s_long = 0 and s_short = 0
// Close pool with creator + protocol authority
// Assert: Pool account closed
// Assert: Vault closed
// Assert: Remaining USDC transferred to creator
// Assert: Rent lamports returned to creator

it("prevents closure with open positions")
// Pool with users holding tokens (s_long > 0 or s_short > 0)
// Try to close
// Assert: Error code PositionsStillOpen (exact code TBD)

it("requires both creator and protocol authority for closure")
// Try to close with creator only - should fail
// Try to close with protocol authority only - should fail
// Close with both - should succeed
```

### 7. State Invariants

#### 7.1 Supply Conservation
**Purpose:** Verify token supply integrity
```typescript
it("maintains token supply consistency")
// Throughout all operations:
// Assert: Pool s_L matches mint total_supply
// Assert: Pool s_S matches mint total_supply
// Assert: No tokens created/destroyed except through pool
```

#### 7.2 Reserve-Supply Relationship
**Purpose:** Verify ICBS invariants
```typescript
it("maintains R = C(s) relationship")
// After any operation:
// Calculate C(s_L, s_S) from supplies
// Assert: R_L + R_S = C(s_L, s_S) ± tolerance
```

### 8. Authority and Access Control

#### 8.1 Factory Authority Usage
**Purpose:** Verify factory authority integration
```typescript
it("validates factory pool_authority for trades")
// Trade requires protocol_authority signature
// Assert: Must match factory.pool_authority
// Assert: Error code 6561 if wrong authority

it("validates factory pool_authority for settlements")
// Settlement requires protocol_authority signature
// Assert: Must match factory.pool_authority
// Assert: Error code 6561 if wrong authority
```

#### 8.2 Creator Permissions
**Purpose:** Test creator privileges
```typescript
it("restricts pool closure to creator")
// Non-creator tries to close pool
// Assert: Error code 6560 (Unauthorized)
```

### 9. Edge Cases

#### 9.1 Numerical Boundaries
**Purpose:** Test extreme values
```typescript
it("handles very large supplies without overflow")
// Push supplies near Q64.64 limits
// Assert: Calculations remain correct
// Assert: No panic or overflow

it("handles very small trades correctly")
// Trade at minimum size (0.001 USDC)
// Assert: Rounding handled properly
// Assert: State updates correctly
```

#### 9.2 Numerical Precision
**Purpose:** Test fixed-point arithmetic precision
```typescript
it("maintains precision in X96 sqrt price calculations")
// Verify sqrt_price_long_x96 and sqrt_price_short_x96 accuracy
// Compare against reference implementation
// Assert: Price error < 0.01%

it("handles lambda calculation for unit price correctly")
// At deployment, verify λ calculated such that p_L = p_S = 1.0 USDC
// Assert: Initial marginal prices within 0.001% of 1.0

it("preserves reserve invariants through settlements")
// After multiple settlements
// Recalculate R = s × p independently
// Assert: pool.r_long matches s_long × p_long
// Assert: pool.r_short matches s_short × p_short
```

## Test Data Configuration

### Constants
```typescript
// Fixed-point math
const Q96_ONE = new BN(1).shln(96);  // X96 format for sqrt prices
const Q32_ONE = new BN(1).shln(32);  // Q32.32 format for initial_q
const Q64_ONE = new BN(1).shln(64);  // Legacy, may be removed

// ICBS parameters (FIXED for all pools)
const DEFAULT_F = 1;          // Growth exponent (changed from 2)
const DEFAULT_BETA_NUM = 1;
const DEFAULT_BETA_DEN = 2;   // β = 0.5

// Trade limits
const MIN_TRADE_SIZE = 1_000; // 0.001 USDC (6 decimals)
const MAX_TRADE_SIZE = new BN(1_000_000_000_000); // 1M USDC

// Initial deposit limits
const MIN_INITIAL_DEPOSIT = 100_000_000;   // 100 USDC
const MAX_INITIAL_DEPOSIT = 10_000_000_000; // 10K USDC

// Settlement
const MIN_SETTLE_INTERVAL = 300; // 5 minutes
const BD_SCORE_MAX = 1_000_000;  // 100% in micro-units

// Token decimals
const USDC_DECIMALS = 6;
const TOKEN_DECIMALS = 6;  // LONG/SHORT tokens match USDC
```

### Mock Setup
```typescript
// USDC mint with 6 decimals
// Test users with 100K USDC each
// Content IDs as deterministic hashes
// Protocol authority keypair for signing
```

## Implementation Priority

### Phase 1: Core Functionality (Must Have)
1. Pool initialization via factory
2. Market deployment
3. Basic buy/sell operations
4. ICBS math verification
5. Settlement with BD scores

### Phase 2: Security & Constraints (Should Have)
1. Authority validation
2. Trade size limits
3. Settlement cooldown
4. Slippage protection
5. State invariants

### Phase 3: Edge Cases (Nice to Have)
1. Parameter extremes
2. Numerical boundaries
3. Concurrent operations
4. Attack vectors

## Test Count Summary

### Total Tests: 48
- **Pool Initialization:** 3 tests
- **Market Deployment:** 6 tests (including add_liquidity)
- **ICBS Mathematics:** 5 tests
- **Trading Operations:** 9 tests (including SPL token ops)
- **Settlement:** 7 tests
- **Pool Closure:** 3 tests
- **State Invariants:** 2 tests
- **Authority:** 3 tests
- **Edge Cases:** 6 tests
- **Test Data:** 4 helper setup tests

### Critical Tests (MUST PASS)
1. ✅ Pool creation via factory
2. ✅ Market deployment with initial liquidity (1:1 flat rate)
3. ✅ ICBS price calculations (F=1, β=0.5)
4. ✅ Buy/sell token operations
5. ✅ Add liquidity at market ratio
6. ✅ SPL token standard compliance
7. ✅ Settlement with BD scores (micro-unit format)
8. ✅ Virtual reserve tracking and updates
9. ✅ Zero-sum property maintenance
10. ✅ Authority validation

## Success Criteria
- All 10 critical tests passing
- 90%+ of all tests passing (43/48)
- Core invariants never violated:
  - R_L + R_S remains constant through settlement
  - R = s × p relationship maintained
  - Token supply = mint total_supply
- No numerical overflows or panics
- Proper error codes returned
- X96 fixed-point precision < 0.01% error