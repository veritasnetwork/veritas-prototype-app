# ProtocolTreasury Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript
- **Location:** `/solana/veritas-curation/tests/`

## Critical Test Categories

### 1. Treasury Initialization

#### 1.1 Singleton Treasury Creation
**Purpose:** Verify single treasury instance
```typescript
it("initializes treasury with authority and vault")
// Setup: Deploy program
// Action: Initialize treasury with authority
// Assert: Treasury PDA created at correct address
// Assert: USDC vault created and owned by treasury PDA
// Assert: Authority set correctly

it("prevents duplicate treasury initialization")
// Action: Try to initialize treasury again
// Assert: Account already exists error
```

#### 1.2 Authority Validation
**Purpose:** Prevent invalid treasury authority
```typescript
it("rejects treasury with default pubkey authority")
it("rejects treasury with system program authority")
// Assert: InvalidAuthority errors
```

### 2. Epoch Settlement Operations

#### 2.1 Phase 1: Penalty Collection
**Purpose:** Verify penalty collection from pools
```typescript
it("collects penalty from pool to treasury")
// Setup: Pool with 100K USDC, treasury with 0
// Action: Apply 10K penalty via apply_pool_penalty
// Assert: Pool vault decreased by 10K
// Assert: Treasury vault increased by 10K
// Assert: Pool reserve updated
// Assert: Pool k values scaled down

it("handles multiple penalties in sequence")
// Setup: 3 pools with different reserves
// Action: Apply penalties to all 3
// Assert: Treasury balance = sum of penalties
// Assert: Each pool's reserve reduced correctly
```

#### 2.2 Phase 2: Reward Distribution
**Purpose:** Verify reward distribution to pools
```typescript
it("distributes reward from treasury to pool")
// Setup: Treasury with 50K from penalties
// Action: Apply 50K reward to winning pool
// Assert: Treasury vault decreased by 50K
// Assert: Pool vault increased by 50K
// Assert: Pool reserve updated
// Assert: Pool k values scaled up

it("distributes proportional rewards to multiple pools")
// Setup: Treasury with 100K
// Action: Distribute to 2 pools (60K, 40K)
// Assert: Treasury depleted to 0
// Assert: Each pool received correct amount
```

### 3. Zero-Sum Property

#### 3.1 Complete Epoch Cycle
**Purpose:** Verify sum(penalties) = sum(rewards)
```typescript
it("maintains zero-sum through complete epoch")
// Setup: 5 pools with 100K each
// Phase 1: Collect penalties from 3 pools (30K total)
// Phase 2: Distribute rewards to 2 pools (30K total)
// Assert: Treasury starts at 0
// Assert: Treasury ends at 0
// Assert: Total value across all pools unchanged
```

#### 3.2 Rollover Handling
**Purpose:** Handle epochs with no winners
```typescript
it("handles epoch with no reward recipients")
// Setup: All pools have negative relevance
// Action: Collect penalties (treasury accumulates)
// Assert: Treasury retains balance for next epoch
// Note: In practice, backend tracks rollover
```

### 4. Authority and Access Control

#### 4.1 Treasury Operations Authority
**Purpose:** Verify only authority can operate
```typescript
it("allows authority to update treasury authority")
// Action: Current authority updates to new authority
// Assert: treasury.authority updated
// Assert: Old authority cannot operate

it("rejects treasury operations from non-authority")
// Action: Random user tries to trigger penalty/reward
// Assert: Unauthorized error
```

#### 4.2 PDA Signing for Transfers
**Purpose:** Verify treasury PDA controls vault
```typescript
it("treasury PDA signs outgoing transfers")
// During reward distribution:
// Assert: Treasury PDA is signer for transfer
// Assert: Seeds = ["treasury", bump]
```

### 5. Integration with ContentPool

#### 5.1 Penalty Integration
**Purpose:** Test penalty flow from pool to treasury
```typescript
it("integrates penalty with pool's elastic-k update")
// Setup: Pool with known k values
// Action: apply_pool_penalty
// Assert: USDC transferred to treasury
// Assert: Pool k values scaled by (1 - penalty_rate)
// Assert: Pool reserve matches new k values
```

#### 5.2 Reward Integration
**Purpose:** Test reward flow from treasury to pool
```typescript
it("integrates reward with pool's elastic-k update")
// Setup: Treasury funded, pool with known k values
// Action: apply_pool_reward
// Assert: USDC transferred from treasury
// Assert: Pool k values scaled by (1 + reward_rate)
// Assert: Pool reserve matches new k values
```

### 6. Edge Cases and Attack Vectors

#### 6.1 Insufficient Treasury Balance
**Purpose:** Prevent overdraft on rewards
```typescript
it("rejects reward exceeding treasury balance")
// Setup: Treasury with 10K
// Action: Try to distribute 20K reward
// Assert: InsufficientBalance error
```

#### 6.2 Insufficient Pool Balance
**Purpose:** Prevent over-penalization
```typescript
it("rejects penalty exceeding pool reserve")
// Setup: Pool with 10K reserve
// Action: Try to apply 20K penalty
// Assert: InsufficientReserve error
```

#### 6.3 Zero Amount Operations
**Purpose:** Validate amount checks
```typescript
it("rejects zero penalty amount")
it("rejects zero reward amount")
// Assert: InvalidAmount errors
```

### 7. Vault Management

#### 7.1 Vault Ownership
**Purpose:** Verify proper vault control
```typescript
it("treasury PDA owns USDC vault")
// Assert: vault.authority = treasury PDA
// Assert: Only treasury program can transfer
```

#### 7.2 Vault Consistency
**Purpose:** Track vault balance accuracy
```typescript
it("maintains accurate vault balance through operations")
// Execute 100 random penalties/rewards
// Assert: Final vault balance = expected from operations
// Assert: No value lost to rounding (within 0.01%)
```

### 8. State Consistency Tests

#### 8.1 Atomic Operations
**Purpose:** Ensure all-or-nothing updates
```typescript
it("completes penalty atomically")
// If any part fails (e.g., transfer)
// Assert: No partial state changes
// Assert: Pool reserve unchanged if transfer fails
```

#### 8.2 Treasury Balance Tracking
**Purpose:** Verify balance accuracy
```typescript
it("tracks treasury balance correctly")
// After each operation:
// Assert: treasury vault amount matches expected
// Use getTokenAccount to verify actual SPL balance
```

## Security Considerations

### 1. Transfer Authorization
```typescript
it("prevents unauthorized USDC transfers")
// Try to transfer from treasury vault directly
// Assert: Only treasury program can transfer
```

### 2. Account Validation
```typescript
it("validates pool account in penalty instruction")
// Try to pass non-pool account
// Assert: Account discriminator check fails

it("validates treasury account genuineness")
// Try to pass fake treasury account
// Assert: PDA derivation check fails
```

### 3. Reentrancy Protection
```typescript
it("prevents reentrancy during transfers")
// State updates before CPI calls
// Assert: Cannot exploit mid-transfer state
```

## Performance Benchmarks

### Compute Unit Usage
```typescript
it("measures CU usage for treasury operations")
// Initialize treasury: < 200K CUs
// Penalty collection: < 150K CUs
// Reward distribution: < 150K CUs
// Authority update: < 50K CUs
```

### Batch Operation Efficiency
```typescript
it("handles batch epoch processing efficiently")
// Process 50 penalties + 50 rewards
// Assert: Total CUs < 15M (within transaction limit)
// Consider: May need multiple transactions for large epochs
```

## Test Data Configuration

### Mock Setup
```typescript
const MOCK_USDC_MINT = new PublicKey("...");
const TEST_AUTHORITY = Keypair.generate();
const TEST_POOLS = Array(10).fill(0).map(() => ({
  postId: randomBytes(32),
  reserve: 100_000_000_000, // 100K USDC
}));
```

### Epoch Scenarios
```typescript
const EPOCH_SCENARIOS = {
  balanced: {
    penalties: [10_000, 15_000, 5_000],  // 30K total
    rewards: [20_000, 10_000],           // 30K total
  },
  noWinners: {
    penalties: [20_000, 30_000],         // 50K total
    rewards: [],                         // None
  },
  allWinners: {
    penalties: [],                       // None
    rewards: [],                         // Nothing to distribute
  }
};
```

## Integration Test Suite

### Complete Epoch Processing
```typescript
it("processes complete epoch with 20 pools")
// 1. Initialize treasury
// 2. Create 20 pools with various reserves
// 3. Calculate penalties based on mock relevance
// 4. Execute all penalty collections
// 5. Calculate reward distribution
// 6. Execute all reward distributions
// 7. Verify zero-sum property
// 8. Verify all pools updated correctly
```

## Error Coverage

### Expected Errors to Test
- InvalidAuthority
- Unauthorized
- InsufficientBalance (treasury)
- InsufficientReserve (pool)
- InvalidAmount
- NumericalOverflow

## Coverage Requirements
- Line Coverage: > 95%
- Branch Coverage: > 90%
- Critical paths: 100% (penalty/reward flows)
- Error conditions: 100%