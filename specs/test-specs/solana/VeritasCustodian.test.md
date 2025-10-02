# VeritasCustodian Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript
- **Location:** `/solana/veritas-curation/tests/`

## Critical Test Categories

### 1. Custodian Initialization

#### 1.1 Singleton Custodian Creation
**Purpose:** Verify single custodian instance with pooled model
```typescript
it("initializes custodian with owner and protocol authority")
// Setup: Deploy program
// Action: Initialize with owner and protocol_authority
// Assert: Custodian PDA created at correct address
// Assert: USDC vault created and owned by custodian PDA
// Assert: owner and protocol_authority set correctly
// Assert: emergency_pause = false
// Assert: total_deposits = 0, total_withdrawals = 0

it("prevents duplicate custodian initialization")
// Action: Try to initialize custodian again
// Assert: Account already exists error
```

#### 1.2 Authority Validation
**Purpose:** Prevent invalid authorities
```typescript
it("rejects custodian with default pubkey authorities")
it("rejects custodian with system program authorities")
// Test both owner and protocol_authority
// Assert: InvalidAuthority errors
```

### 2. Deposit Operations

#### 2.1 Permissionless Deposits
**Purpose:** Verify anyone can deposit to pool
```typescript
it("allows any user to deposit USDC")
// Setup: User with USDC balance
// Action: Deposit 1000 USDC
// Assert: USDC transferred to custodian vault
// Assert: total_deposits increased by 1000
// Assert: DepositEvent emitted with correct data

it("handles multiple deposits from same user")
// Action: Same user deposits 3 times
// Assert: All deposits succeed
// Assert: total_deposits = sum of all deposits
// Assert: Each DepositEvent captured
```

#### 2.2 Deposit Validation
**Purpose:** Enforce deposit constraints
```typescript
it("enforces minimum deposit amount")
// Action: Try to deposit 0.5 USDC (below 1 USDC minimum)
// Assert: BelowMinimum error

it("rejects zero amount deposit")
// Action: Try to deposit 0
// Assert: InvalidAmount error

it("validates vault address matches custodian")
// Action: Try to deposit to wrong vault
// Assert: InvalidVault error
```

### 3. Withdrawal Operations

#### 3.1 Protocol-Controlled Withdrawals
**Purpose:** Verify only protocol can withdraw
```typescript
it("allows protocol_authority to withdraw on behalf of users")
// Setup: Custodian with 10K USDC
// Action: protocol_authority withdraws 1K to user
// Assert: USDC transferred to recipient
// Assert: total_withdrawals increased
// Assert: WithdrawEvent emitted

it("rejects withdrawal from non-protocol authority")
// Action: Owner tries to withdraw
// Assert: Unauthorized error
// Action: Random user tries to withdraw
// Assert: Unauthorized error
```

#### 3.2 Withdrawal Validation
**Purpose:** Ensure withdrawal integrity
```typescript
it("validates recipient token account ownership")
// Setup: Create token account owned by Alice
// Action: Try to withdraw with Bob as recipient parameter
// Assert: InvalidRecipient error (account owner != recipient)

it("validates recipient token account mint")
// Setup: Create SOL token account (wrong mint)
// Action: Try to withdraw USDC to SOL account
// Assert: InvalidMint error

it("validates vault has sufficient balance")
// Setup: Vault with 100 USDC
// Action: Try to withdraw 200 USDC
// Assert: InsufficientVaultBalance error

it("validates vault address matches custodian")
// Action: Try to withdraw from wrong vault
// Assert: InvalidVault error
```

#### 3.3 Zero-Sum Accounting
**Purpose:** Verify withdrawals can exceed deposits (profits)
```typescript
it("allows withdrawals exceeding deposits (user profits)")
// Setup: Total deposits = 1000 USDC
// Action: Withdraw 1500 USDC (user made profit)
// Assert: Succeeds (no check against total_deposits)
// Assert: total_withdrawals = 1500
// This is CRITICAL for the pooled model!
```

### 4. Emergency Pause

#### 4.1 Toggle Emergency Pause
**Purpose:** Test emergency halt mechanism
```typescript
it("allows owner to activate emergency pause")
// Action: Owner calls toggle_emergency_pause(true)
// Assert: emergency_pause = true

it("blocks withdrawals when paused")
// Setup: Activate emergency pause
// Action: protocol_authority tries to withdraw
// Assert: SystemPaused error

it("allows deposits even when paused")
// Setup: Emergency pause active
// Action: User deposits USDC
// Assert: Deposit succeeds (only withdrawals blocked)

it("allows owner to deactivate pause")
// Action: Owner calls toggle_emergency_pause(false)
// Assert: Withdrawals work again
```

#### 4.2 Pause Authority
**Purpose:** Verify only owner controls pause
```typescript
it("rejects pause toggle from protocol_authority")
// Action: protocol_authority tries to pause
// Assert: Unauthorized error

it("rejects pause toggle from random user")
// Action: Random user tries to pause
// Assert: Unauthorized error
```

### 5. Authority Management

#### 5.1 Update Protocol Authority
**Purpose:** Test protocol authority handover
```typescript
it("allows owner to update protocol_authority")
// Action: Owner updates protocol_authority
// Assert: New authority can withdraw
// Assert: Old authority cannot withdraw

it("rejects update from non-owner")
// Action: protocol_authority tries to update itself
// Assert: Unauthorized error

it("validates new authority is not default/system")
// Assert: InvalidAuthority errors
```

#### 5.2 Update Owner
**Purpose:** Test ownership transfer
```typescript
it("allows owner to transfer ownership")
// Action: Owner transfers to new_owner
// Assert: New owner can update authorities
// Assert: Old owner cannot update

it("validates new owner is not default/system")
// Assert: InvalidAuthority errors
```

### 6. Event Tracking

#### 6.1 Deposit Events
**Purpose:** Verify event emission for indexing
```typescript
it("emits DepositEvent with correct data")
// After deposit:
// Assert: Event contains depositor pubkey
// Assert: Event contains amount
// Assert: Event contains timestamp
```

#### 6.2 Withdraw Events
**Purpose:** Track withdrawals off-chain
```typescript
it("emits WithdrawEvent with correct data")
// After withdrawal:
// Assert: Event contains recipient pubkey
// Assert: Event contains amount
// Assert: Event contains authority (who approved)
// Assert: Event contains timestamp
```

### 7. Integration with Off-Chain System

#### 7.1 Deposit Indexing Simulation
**Purpose:** Verify deposit tracking feasibility
```typescript
it("generates indexable deposit events")
// Execute 10 deposits from different users
// Parse transaction logs for events
// Assert: Can reconstruct deposit history
// Assert: Can map depositor -> amount
```

#### 7.2 Balance Reconciliation
**Purpose:** Verify off-chain tracking accuracy
```typescript
it("maintains reconcilable pool balance")
// After series of deposits/withdrawals:
// Assert: vault.amount = total_deposits - total_withdrawals
// Note: May differ due to profits/losses in protocol
```

### 8. Attack Vectors

#### 8.1 Direct Vault Manipulation
**Purpose:** Prevent bypassing custodian
```typescript
it("prevents direct transfers from vault")
// Try to transfer USDC directly from vault
// Assert: Only custodian PDA can sign
```

#### 8.2 Fake Recipient Account
**Purpose:** Prevent fund redirection
```typescript
it("prevents withdrawal to attacker-controlled account")
// Setup: Attacker creates token account
// Action: Try to specify victim as recipient but attacker's account
// Assert: InvalidRecipient (owner check fails)
```

#### 8.3 Drainage Attack
**Purpose:** Verify vault protection
```typescript
it("prevents complete vault drainage without authority")
// Multiple attack attempts:
// - Non-authority withdrawal
// - Fake vault reference
// - Direct transfer attempt
// Assert: All fail with appropriate errors
```

### 9. Edge Cases

#### 9.1 Maximum Values
**Purpose:** Test overflow protection
```typescript
it("handles maximum deposit amounts")
// Deposit u64::MAX USDC (if possible)
// Assert: total_deposits uses u128, no overflow

it("handles maximum total_deposits accumulation")
// Simulate many large deposits
// Assert: u128 provides sufficient range
```

#### 9.2 Rapid Operations
**Purpose:** Test concurrent operations
```typescript
it("handles rapid deposits from multiple users")
// 10 users deposit simultaneously
// Assert: All succeed, total_deposits correct

it("handles multiple withdrawals in same block")
// Protocol executes 5 withdrawals
// Assert: All process correctly
// Assert: Vault balance updated atomically
```

## Performance Benchmarks

### Compute Unit Usage
```typescript
it("measures CU usage for operations")
// Initialize: < 250K CUs
// Deposit: < 100K CUs
// Withdraw: < 150K CUs
// Toggle pause: < 50K CUs
// Update authority: < 50K CUs
```

### Account Size Validation
```typescript
it("verifies custodian account size")
// Assert: VeritasCustodian = 138 bytes exactly
```

## Security Test Suite

### Critical Invariants
```typescript
it("maintains vault ownership by PDA")
// Throughout all operations:
// Assert: vault.authority always = custodian PDA

it("ensures only protocol controls withdrawals")
// Try every possible signer combination
// Assert: Only protocol_authority succeeds

it("prevents value extraction without authority")
// Try all known attack patterns
// Assert: Funds remain safe
```

## Test Data Configuration

### Mock Setup
```typescript
const TEST_OWNER = Keypair.generate();
const TEST_PROTOCOL = Keypair.generate();
const TEST_USERS = Array(5).fill(0).map(() => Keypair.generate());
const MOCK_USDC_MINT = await createMint(...);

// Fund test users
for (const user of TEST_USERS) {
  await mintTo(user, 10_000_000_000); // 10K USDC
}
```

### Scenario Testing
```typescript
const SCENARIOS = {
  normalOperation: {
    deposits: [1000, 2000, 1500],
    withdrawals: [500, 1000, 2000, 1000], // More than deposits!
  },
  emergencyScenario: {
    deposits: [5000],
    pauseAfter: 1,
    withdrawalAttempts: [1000], // Should fail
  }
};
```

## Integration Tests

### Complete Lifecycle
```typescript
it("executes complete custodian lifecycle")
// 1. Initialize custodian
// 2. Multiple users deposit
// 3. Protocol processes withdrawals (including profits)
// 4. Update protocol authority
// 5. More withdrawals with new authority
// 6. Emergency pause activated
// 7. Deposits continue, withdrawals blocked
// 8. Pause deactivated
// 9. Normal operations resume
// Assert: All state transitions correct
```

## Coverage Requirements
- Line Coverage: > 95%
- Branch Coverage: > 90%
- Security paths: 100%
- Event emission: 100%
- Error conditions: 100%

## Regression Tests
- Previous withdrawal validation bugs
- Authority spoofing attempts
- Emergency pause edge cases
- Event indexing reliability