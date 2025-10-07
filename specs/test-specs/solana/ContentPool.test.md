# ContentPool Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript/Rust
- **Location:** `/solana/veritas-curation/tests/`

## Important Note: Real SPL Token Model
ContentPool uses **real SPL tokens** that are minted when users buy from the bonding curve and burned when users sell back to the curve. Key features:
1. Pool PDA is the mint authority
2. Users hold actual SPL tokens in their wallets
3. Users can transfer tokens freely between wallets
4. Users can burn tokens directly if they wish (losing value)
5. Token metadata (name, symbol) is set by pool creator

## Critical Test Categories

### 1. Initialization Tests

#### 1.1 Valid Pool Creation
**Purpose:** Verify pool can be created with valid parameters and token mint
```typescript
it("creates pool with valid parameters and SPL token mint")
// Setup: Initialize config and factory
// Action: Create pool with k=1000, cap=100K, name="Content-ABC", symbol="cABC"
// Assert: Pool state matches expected values
// Assert: Token mint created with pool PDA as mint authority
// Assert: Token mint has 6 decimals, no freeze authority
// Assert: USDC vault created and owned by pool PDA
// Assert: Token metadata stored correctly in pool account
```

#### 1.2 Parameter Boundary Validation
**Purpose:** Ensure pools respect config bounds
```typescript
it("rejects pool creation with k_quadratic below minimum")
it("rejects pool creation with k_quadratic above maximum")
// Assert: Each returns appropriate error code
// Note: Pure quadratic implementation has no supply_cap parameter
```

#### 1.3 Duplicate Pool Prevention
**Purpose:** Verify same post_id cannot have multiple pools
```typescript
it("prevents duplicate pools for same post_id")
// Action: Create pool, then try to create again with same post_id
// Assert: Second creation fails with PoolAlreadyExists error
```

### 2. Bonding Curve Mathematics

#### 2.1 Pure Quadratic Curve Calculations
**Purpose:** Verify price and reserve calculations with pure quadratic curve
```typescript
it("calculates correct token supply increase from bonding curve")
// Test cases:
// - First purchase: Should use cube root calculation
// - Multiple purchases: Verify cumulative supply correct
// - Price increases quadratically: P(s) = k × s²
// Precision: Within 0.01% due to integer math

it("correctly calculates cube root for buy operations")
// Test cube_root implementation with known values
// Assert: cube_root(8) = 2, cube_root(27) = 3, etc.
// Assert: Handles large u128 values without overflow

it("maintains price floor at zero supply")
// Test that price never goes below PRICE_FLOOR
// First purchase at price floor
// Price transitions smoothly to curve when curve > floor
```

#### 2.2 Price Floor Handling
**Purpose:** Verify price floor mechanism for low supply
```typescript
it("enforces minimum price floor")
// Buy at s=0, should use PRICE_FLOOR ($0.0001)
// Assert: Initial tokens bought at floor price
// Assert: Once curve exceeds floor, uses curve price

it("transitions from price floor to curve pricing")
// Buy enough to exceed price floor
// Assert: Smooth transition, no discontinuity
// Assert: Further buys use pure quadratic pricing
```

### 3. Elastic-K Mechanism

#### 3.1 Penalty Application
**Purpose:** Verify reserve reduction and k-scaling
```typescript
it("applies penalty correctly reducing pool value")
// Setup: Pool with 100K USDC reserve, users hold SPL tokens
// Action: Apply 10K penalty
// Assert: Reserve = 90K
// Assert: k_quadratic scaled by 0.9
// Assert: k_linear (derived) also scaled by 0.9
// Assert: Total SPL token supply unchanged
// Assert: Price per SPL token decreased by 10%
// Note: Token holders still have same amount, but worth less
```

#### 3.2 Reward Application
**Purpose:** Verify reserve increase and k-scaling
```typescript
it("applies reward correctly increasing pool value")
// Setup: Pool with 100K USDC reserve, users hold SPL tokens
// Action: Apply 10K reward
// Assert: Reserve = 110K
// Assert: k_quadratic scaled by 1.1
// Assert: k_linear (derived) also scaled by 1.1
// Assert: Total SPL token supply unchanged
// Assert: Price per SPL token increased by 10%
// Note: Token holders still have same amount, but worth more
```

#### 3.3 Price Consistency After Adjustment
**Purpose:** Ensure elastic-k maintains mathematical consistency
```typescript
it("maintains price continuity after elastic-k adjustment")
// Calculate price before adjustment
// Apply penalty/reward
// Assert: New price = old price × adjustment ratio
// Assert: Reserve integral still equals actual reserve
```

### 4. Authority and Access Control

#### 4.1 Factory Authority Reference
**Purpose:** Verify pools use factory's pool_authority
```typescript
it("validates factory reference in pool operations")
// Assert: Pool contains correct factory address
// Assert: Authority operations check against factory.pool_authority

it("allows pool operations with factory's pool_authority")
it("rejects pool operations with wrong authority")
it("updates pool authority when factory updates")
// Test penalty/reward/setSupplyCap with various signers
```

#### 4.2 User Operations Permissions
**Purpose:** Ensure buy/sell operations are permissionless
```typescript
it("allows any user to buy SPL tokens from curve")
// No authority checks on buy operations
// User provides USDC, receives SPL tokens

it("allows any token holder to sell back to curve")
// User must own SPL tokens to sell
// SPL token program enforces ownership
// No additional authority checks needed
```

### 5. Edge Cases and Attack Vectors

#### 5.1 Numerical Overflow Protection
**Purpose:** Prevent overflow in calculations
```typescript
it("handles maximum possible token supply without overflow")
// Buy tokens up to u128::MAX / 2
// Assert: No panic, calculations remain correct

it("handles maximum USDC amounts without overflow")
// Test with large USDC amounts (billions)
// Assert: Proper overflow errors, not panic
```

#### 5.2 Minimum Trade Amount Enforcement
**Purpose:** Prevent dust attacks
```typescript
it("rejects trades below minimum amount")
// Try buy with 0.5 USDC (below 1 USDC minimum)
// Assert: BelowMinimum error
```

#### 5.3 Rounding and Precision
**Purpose:** Verify no value leakage through rounding
```typescript
it("maintains reserve consistency through many trades")
// Execute 1000 small random buys and sells
// Track all USDC in and out
// Assert: Final reserve matches net USDC flow ± 0.01%
// Assert: Total SPL tokens match minted minus burned
```

#### 5.4 Factory Validation
**Purpose:** Verify factory reference is validated
```typescript
it("validates pool.factory matches expected factory")
// Try to call penalty/reward with mismatched factory
// Assert: Operation fails if factory reference invalid
```

### 6. State Consistency Tests

#### 6.1 Reserve-Supply Invariant
**Purpose:** Ensure reserve always matches integral of price curve
```typescript
it("maintains reserve = ∫P(s)ds invariant after all operations")
// After each operation (buy/sell/penalty/reward):
// Calculate theoretical reserve from curve integral
// Assert: Actual reserve matches ± rounding error
// Assert: SPL token total supply matches expected
// Verify using SPL token program's supply query
```

#### 6.2 Supply Cap Update
**Purpose:** Verify supply cap changes maintain consistency
```typescript
it("updates supply cap maintaining k_linear relationship")
// Change supply cap
// Assert: k_linear = k_quadratic × new_supply_cap (derived, not stored)
// Assert: No impact on current SPL token supply
// Assert: No impact on reserve
// Assert: Existing token holders unaffected
```

### 7. SPL Token Tests

#### 7.1 Token Mint Creation
**Purpose:** Verify proper SPL token mint setup
```typescript
it("creates SPL token mint with pool as authority")
// After pool creation:
// Assert: Token mint exists at expected address
// Assert: Mint authority = pool PDA
// Assert: No freeze authority
// Assert: Decimals = 6
// Assert: Supply = 0 initially

it("sets token metadata correctly")
// Assert: Token name matches pool creator input
// Assert: Token symbol matches pool creator input (max 10 chars)
// Assert: Metadata stored in pool account
```

#### 7.2 Token Minting and Burning
**Purpose:** Test token lifecycle
```typescript
it("mints exact tokens calculated from bonding curve")
// User buys with 1000 USDC
// Calculate expected tokens from curve
// Assert: User receives exact calculated amount
// Assert: Total supply increases by exact amount

it("burns tokens when selling back to curve")
// User sells 100 tokens
// Assert: Tokens burned from user account
// Assert: Total supply decreases by 100
// Assert: User receives calculated USDC
```

#### 7.3 Token Transfers
**Purpose:** Verify SPL token standard compliance
```typescript
it("allows users to transfer tokens between wallets")
// User A buys tokens from curve
// User A transfers to User B
// Assert: Standard SPL transfer works
// Assert: Pool state unaffected by transfer
// User B can sell transferred tokens to curve

it("allows users to burn tokens directly")
// User burns tokens without selling
// Assert: Tokens destroyed permanently
// Assert: No USDC returned
// Assert: Pool reserve unchanged
// Note: User loses value but this is allowed
```

#### 7.4 Associated Token Accounts
**Purpose:** Test ATA creation and management
```typescript
it("creates associated token account on first buy")
// User without ATA buys tokens
// Assert: ATA created automatically
// Assert: User pays for ATA rent
// Assert: Tokens deposited to new ATA

it("uses existing ATA for subsequent operations")
// User with ATA buys more tokens
// Assert: No new ATA created
// Assert: Tokens added to existing ATA
```

### 8. Integration Tests

#### 8.1 Concurrent Operations
**Purpose:** Test transaction ordering independence
```typescript
it("handles concurrent buys from multiple users")
// Submit multiple buy transactions in same slot
// Assert: All process correctly regardless of order
```

## Implemented Tests Status

### ⚠️ CRITICAL: Test Implementation Mismatch

**Problem:** Tests are testing a **piecewise curve** (quadratic + linear regions) but the actual implementation is **pure quadratic with price floor**.

**Evidence:**
- Implementation (`content_pool/state.rs`): NO `supply_cap` or `k_linear` fields
- Tests (`content-pool.test.ts`): Testing "linear region" functionality with `supply_cap`
- Test spec claims: "BOTH QUADRATIC AND LINEAR REGIONS COVERED"

### Tests That Need Updating

❌ **Section 2.2 Linear Region Tests** (3 tests) - Testing non-existent feature!
  - "reaches linear region at $5K pool size" - NO LINEAR REGION EXISTS
  - "calculates correct price in linear region" - NO LINEAR REGION EXISTS
  - "allows multiple purchases in linear region" - NO LINEAR REGION EXISTS

❌ **Parameter validation** - Tests for `supply_cap` min/max that don't exist in struct

### Tests That Are Correct

✅ **1. Initialization Tests** (needs minor updates)
- ✅ **1.1 Valid Pool Creation** - Valid but remove supply_cap references
- ⚠️ **1.2 Parameter Boundary Validation** - Remove supply_cap tests (2 tests to delete)
- ✅ **1.3 Duplicate Pool Prevention** - Valid

✅ **2.1 Pure Quadratic Calculations** (3 tests) - Core logic correct
  - Calculates correct token supply increase for first purchase
  - Maintains price curve consistency across multiple purchases
  - Verifies price increases with supply

⚠️ **2.2 Should Test Price Floor Instead** - Replace linear region tests with price floor tests

### 4. Minimum Trade Amount Enforcement (2 tests) **[IMPLEMENTED]**
- ✅ Rejects buy below minimum (1 USDC)
- ✅ Rejects sell below minimum

### 5. SPL Token Standard Compliance (3 tests) **[IMPLEMENTED]**
- ✅ Allows standard SPL token transfers between wallets
- ✅ Auto-creates associated token account on first buy
- ✅ Allows direct token burning by users

### 6. Authority and Access Control (4 tests) **[IMPLEMENTED]**
- ✅ Factory authority validation for penalty operations
- ✅ Factory authority validation for reward operations
- ✅ Rejects penalty from unauthorized signer
- ✅ Rejects reward from unauthorized signer

### 7. SPL Token Tests
- ✅ **7.2 Token Minting and Burning** (2 tests)
  - Mints exact tokens calculated from bonding curve
  - Burns tokens when selling back to curve

## Cross-Module Integration Tests

### Elastic-K Mechanism ✅ **[TESTED VIA PROTOCOLTEASURY]**
**Status:** Fully tested through ProtocolTreasury cross-module integration tests
- ✅ Penalty application (reserve reduction, k-scaling)
- ✅ Reward application (reserve increase, k-scaling)
- ✅ Price consistency after adjustments
- ✅ Zero-sum property validation

**Implementation:** Uses `TestEnvironment` and `TestPool` helper classes for cross-module testing

## Important Tests Still Missing

### Low Priority (Skip Unless Needed)
1. **Numerical Overflow Protection** - Already handled by Rust type system
2. **Rounding and Precision** - Complex, marginal value (implicitly tested)
3. **State Consistency Tests** - Reserve-supply invariant (implicitly tested)
4. **Concurrent Operations** - Complex, minimal value for unit tests

### Not Recommended (Remove from Scope)
- **Performance Benchmarks** - Use profiling tools instead
- **Attack Vector Tests** - Security audit concern
- **Account Size Validation** - Fragile, low value
- **Integration Tests** - Cross-module testing (separate suite)

## Test Data Configuration

### Mock Setup (Already Implemented)
```typescript
const TEST_K_QUADRATIC = new anchor.BN(1_000);
const TEST_SUPPLY_CAP = new anchor.BN("100000000000"); // 100K tokens
const TEST_USDC_AMOUNT = 1_000_000_000; // 1000 USDC

// USDC Mint: Mock USDC with 6 decimals
// Test Users: 2 users with 10K USDC each
// Post IDs: Deterministic SHA-256 hashes
```

### Critical Implementation Notes
```typescript
// k_linear is ALWAYS derived, never stored
const k_linear = k_quadratic * supply_cap;

// Real SPL tokens with pool PDA as mint authority
// Tokens minted on buy(), burned on sell()
// Users can transfer tokens freely as standard SPL tokens
// Pool tracks token_mint address for CPI to token program
```

## Test Execution

### Run All Tests
```bash
cd solana/veritas-curation
./test-isolated.sh
```

### Expected Output
```
ContentPool Tests
  1. Initialization Tests
    1.1 Valid Pool Creation
      ✔ creates pool with valid parameters and SPL token mint (3 tests)
    1.2 Parameter Boundary Validation
      ✔ rejects pool with k_quadratic below minimum
      ✔ rejects pool with k_quadratic above maximum
      ✔ rejects pool with reserve_cap below minimum
      ✔ rejects pool with reserve_cap above maximum
    1.3 Duplicate Pool Prevention
      ✔ prevents duplicate pools for same post_id
  2. Bonding Curve Mathematics
    2.1 Quadratic Region
      ✔ calculates correct supply for first purchase
      ✔ maintains consistency across purchases
      ✔ verifies price increases with supply
    2.2 Linear Region Functionality
      ✔ reaches linear region at $5K pool size
      ✔ calculates correct price in linear region
      ✔ allows multiple purchases in linear region
  4. Minimum Trade Amount Enforcement
      ✔ rejects buy below minimum
      ✔ rejects sell below minimum
  5. SPL Token Standard Compliance
      ✔ allows standard SPL token transfers
      ✔ auto-creates ATA on first buy
      ✔ allows direct token burning
  6. Authority and Access Control
      ✔ validates factory authority for penalty
      ✔ validates factory authority for reward
      ✔ rejects unauthorized penalty
      ✔ rejects unauthorized reward
  7. SPL Token Tests
    7.2 Token Minting and Burning
      ✔ mints exact tokens from bonding curve
      ✔ burns tokens when selling back

  21 passing
```

## Test Infrastructure

### Cross-Module Testing
**Implementation:** Uses `TestEnvironment` and `TestPool` helper classes
- `TestEnvironment.setup()` - Initializes shared USDC mint, factory, treasury
- `TestPool` - Wrapper for pool operations (initialize, buy, penalty, reward)
- Enables integration tests across ContentPool, PoolFactory, and ProtocolTreasury

## Coverage Status

### ⚠️ CRITICAL FINDING: Tests Don't Match Implementation!

- **Tests Implemented:** 21 tests
- **Tests Passing:** 21/21 (100%) - **BUT TESTING WRONG CURVE MODEL!**
- **Critical Issue:** Tests validate piecewise curve, implementation is pure quadratic

### What's Actually Tested vs What Should Be Tested

❌ **Bonding curve math:** Tests cover "quadratic AND linear regions" but implementation is PURE QUADRATIC ONLY
  - 3 tests for "linear region" are testing non-existent functionality
  - These tests likely pass due to mocking or incorrect assumptions

⚠️ **Parameter validation:** 2 tests for `supply_cap` min/max validate fields that don't exist in struct

✅ **Correct Coverage:**
  - Pool initialization: Partially correct (needs supply_cap removal)
  - Token minting/burning: ✅ Correct (2 tests)
  - Pure quadratic math: ✅ Correct (3 tests)
  - Elastic-K mechanism: ✅ Correct (via ProtocolTreasury integration)
  - Authority validation: ✅ Correct (4 tests)
  - SPL token compliance: ✅ Correct (3 tests)
  - Minimum trade amounts: ✅ Correct (2 tests)

### Missing Coverage

❌ **Price floor mechanism** - NOT TESTED AT ALL
  - No tests for PRICE_FLOOR ($0.0001) enforcement
  - No tests for transition from floor to curve pricing
  - This is a CRITICAL feature that's completely untested!

### Recommended Actions

1. **Remove invalid tests** (5 tests):
   - 3 linear region tests
   - 2 supply_cap validation tests

2. **Add price floor tests** (3 new tests):
   - Enforce minimum price at s=0
   - Transition from floor to curve
   - Verify floor applies throughout

3. **Update remaining tests**: Remove supply_cap references from initialization tests