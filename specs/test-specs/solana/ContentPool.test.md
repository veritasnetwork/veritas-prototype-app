# ContentPool Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript/Rust
- **Location:** `/solana/veritas-curation/tests/`

## Critical Test Categories

### 1. Initialization Tests

#### 1.1 Valid Pool Creation
**Purpose:** Verify pool can be created with valid parameters
```typescript
it("creates pool with valid parameters")
// Setup: Initialize config and factory
// Action: Create pool with k=1000, cap=100K
// Assert: Pool state matches expected values
// Assert: USDC vault created and owned by pool PDA
```

#### 1.2 Parameter Boundary Validation
**Purpose:** Ensure pools respect config bounds
```typescript
it("rejects pool creation with k_quadratic below minimum")
it("rejects pool creation with k_quadratic above maximum")
it("rejects pool creation with supply_cap below minimum")
it("rejects pool creation with supply_cap above maximum")
// Assert: Each returns appropriate error code
```

#### 1.3 Duplicate Pool Prevention
**Purpose:** Verify same post_id cannot have multiple pools
```typescript
it("prevents duplicate pools for same post_id")
// Action: Create pool, then try to create again with same post_id
// Assert: Second creation fails with PoolAlreadyExists error
```

### 2. Bonding Curve Mathematics

#### 2.1 Quadratic Region Calculations
**Purpose:** Verify price and reserve calculations in quadratic phase
```typescript
it("calculates correct buy price in quadratic region")
// Test cases:
// - First token: Price should be near 0
// - At 50% of cap: Price = k_quad × (0.5 × cap)²
// - Just before cap: Price = k_quad × cap²
// Precision: Within 0.01% due to integer math

it("calculates correct sell return in quadratic region")
// Test reverse operations maintain reserve consistency
// Assert: Buy then sell returns ~99.9% of USDC (minus rounding)
```

#### 2.2 Linear Region Calculations
**Purpose:** Verify transition and linear pricing
```typescript
it("transitions smoothly from quadratic to linear at supply_cap")
// Buy tokens up to just before cap, then cross boundary
// Assert: No price discontinuity at transition
// Assert: k_linear = k_quadratic × supply_cap

it("calculates correct price in linear region")
// Test at cap + 50K tokens
// Price should be k_linear × current_supply
```

#### 2.3 Boundary Crossing Operations
**Purpose:** Test complex trades crossing regions
```typescript
it("handles buy crossing from quadratic to linear")
// Start at 90% of cap, buy 20% worth
// Assert: Correct token amount considering both regions

it("handles sell crossing from linear to quadratic")
// Start at 110% of cap, sell 20%
// Assert: Correct USDC return from both regions
```

### 3. Elastic-K Mechanism

#### 3.1 Penalty Application
**Purpose:** Verify reserve reduction and k-scaling
```typescript
it("applies penalty correctly reducing pool value")
// Setup: Pool with 100K USDC reserve
// Action: Apply 10K penalty
// Assert: Reserve = 90K
// Assert: k values scaled by 0.9
// Assert: Token holders lose 10% value
```

#### 3.2 Reward Application
**Purpose:** Verify reserve increase and k-scaling
```typescript
it("applies reward correctly increasing pool value")
// Setup: Pool with 100K USDC reserve
// Action: Apply 10K reward
// Assert: Reserve = 110K
// Assert: k values scaled by 1.1
// Assert: Token holders gain 10% value
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
it("allows pool operations with factory's pool_authority")
it("rejects pool operations with wrong authority")
it("updates pool authority when factory updates")
// Test penalty/reward/setSupplyCap with various signers
```

#### 4.2 User Operations Permissions
**Purpose:** Ensure buy/sell are permissionless
```typescript
it("allows any user to buy tokens")
it("allows token holders to sell tokens")
// No authority checks on buy/sell operations
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
it("maintains reserve consistency through many small trades")
// Execute 1000 small random buys/sells
// Assert: Final reserve matches sum of all trades ± 0.01%
```

#### 5.4 Sell Without Balance
**Purpose:** Verify token balance checks
```typescript
it("prevents selling more tokens than owned")
// Try to sell tokens without owning them
// Assert: Insufficient balance error from token program
```

### 6. State Consistency Tests

#### 6.1 Reserve-Supply Invariant
**Purpose:** Ensure reserve always matches integral of price curve
```typescript
it("maintains reserve = ∫P(s)ds invariant after all operations")
// After each operation (buy/sell/penalty/reward):
// Calculate theoretical reserve from curve integral
// Assert: Actual reserve matches ± rounding error
```

#### 6.2 Supply Cap Update
**Purpose:** Verify supply cap changes maintain consistency
```typescript
it("updates supply cap maintaining k_linear relationship")
// Change supply cap
// Assert: k_linear recalculated correctly
// Assert: No impact on current token holders
```

### 7. Integration Tests

#### 7.1 Full Epoch Cycle
**Purpose:** Test complete penalty/reward flow
```typescript
it("processes full epoch with multiple pools")
// Create 3 pools with different reserves
// Apply penalties to pool 1 & 2
// Apply rewards to pool 3
// Assert: Total penalties = total rewards (zero-sum)
// Assert: Each pool's value adjusted correctly
```

#### 7.2 Concurrent Operations
**Purpose:** Test transaction ordering independence
```typescript
it("handles concurrent buys from multiple users")
// Submit multiple buy transactions in same slot
// Assert: All process correctly regardless of order
```

## Performance Benchmarks

### Compute Unit Usage
```typescript
it("measures CU usage for operations")
// Buy: < 200K CUs
// Sell: < 200K CUs
// Penalty/Reward: < 150K CUs
// Initialize: < 300K CUs
```

### Account Size Validation
```typescript
it("verifies account sizes match spec")
// ContentPool: exactly 169 bytes
// ProtocolConfig: exactly 193 bytes
```

## Security Considerations

### 1. **Integer Overflow:** All u128 operations use checked_math
### 2. **Division by Zero:** Never divide by supply or reserve without checks
### 3. **Authority Spoofing:** Always verify signer against factory.pool_authority
### 4. **Reentrancy:** State updates before external calls
### 5. **PDA Validation:** Always verify PDA derivation in instructions

## Test Data Requirements

### Mock Data
- USDC Mint: Create mock USDC with 6 decimals
- Test Users: At least 3 funded test wallets
- Post IDs: Use deterministic hashes for reproducibility

### Test Configuration
```rust
const TEST_K_QUADRATIC: u128 = 1_000;
const TEST_SUPPLY_CAP: u128 = 100_000_000_000;
const TEST_PENALTY_RATE: u64 = 10; // 10%
const TEST_USDC_AMOUNT: u64 = 1_000_000_000; // 1000 USDC
```

## Coverage Requirements
- Line Coverage: > 95%
- Branch Coverage: > 90%
- Critical Path Coverage: 100%

## Regression Test Suite
Maintain tests for:
- Previous bug fixes
- Edge cases discovered in production
- Community-reported issues