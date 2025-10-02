# PoolFactory Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript
- **Location:** `/solana/veritas-curation/tests/`

## Critical Test Categories

### 1. Factory Initialization

#### 1.1 Singleton Factory Creation
**Purpose:** Verify only one factory can exist
```typescript
it("initializes factory with dual authorities")
// Setup: Deploy program
// Action: Initialize factory with factory_authority and pool_authority
// Assert: Factory state matches inputs
// Assert: total_pools = 0

it("prevents duplicate factory initialization")
// Action: Try to initialize factory again
// Assert: Account already exists error
```

#### 1.2 Authority Validation
**Purpose:** Prevent invalid authorities
```typescript
it("rejects factory initialization with default pubkey")
it("rejects factory initialization with system program ID")
// Assert: InvalidAuthority errors
```

### 2. Pool Creation Through Factory

#### 2.1 Permissionless Pool Creation
**Purpose:** Verify anyone can create pools
```typescript
it("allows any user to create a pool")
// Setup: Initialize factory
// Action: Random user creates pool (not authority)
// Assert: Pool created successfully
// Assert: Pool references factory address
// Assert: Factory total_pools incremented
```

#### 2.2 Registry Creation
**Purpose:** Verify registry tracking
```typescript
it("creates registry entry for new pool")
// Action: Create pool for post_id
// Assert: Registry PDA exists
// Assert: Registry contains correct pool_address
// Assert: Registry timestamp is current
```

#### 2.3 Pool-Factory Linkage
**Purpose:** Ensure pools reference factory correctly
```typescript
it("created pool contains factory reference")
// Action: Create pool through factory
// Read pool account
// Assert: pool.factory == factory PDA address
```

### 3. Authority Management

#### 3.1 Update Pool Authority
**Purpose:** Test pool authority updates
```typescript
it("allows factory_authority to update pool_authority")
// Setup: Factory with authorities A and B
// Action: A updates pool_authority to C
// Assert: Factory pool_authority = C

it("rejects pool_authority update from wrong signer")
// Action: Random user tries to update
// Assert: Unauthorized error

it("rejects pool_authority update from pool_authority itself")
// Action: pool_authority tries to update itself
// Assert: Unauthorized (only factory_authority can)
```

#### 3.2 Update Factory Authority
**Purpose:** Test factory authority transfer
```typescript
it("allows factory_authority to transfer ownership")
// Action: factory_authority updates to new_authority
// Assert: factory.factory_authority = new_authority
// Assert: Old authority can no longer update

it("validates new factory authority is not default/system")
// Assert: InvalidAuthority errors for invalid addresses
```

#### 3.3 Authority Propagation to Pools
**Purpose:** Verify pools use current factory authority
```typescript
it("existing pools use updated factory pool_authority")
// Setup: Create pool, then update factory pool_authority
// Action: Try pool operation with old authority
// Assert: Fails
// Action: Try pool operation with new authority
// Assert: Succeeds
```

### 4. Cross-Contract Integration

#### 4.1 Pool Creation with Config
**Purpose:** Verify config parameter validation
```typescript
it("created pool respects ProtocolConfig bounds")
// Setup: Initialize ProtocolConfig with bounds
// Action: Create pool through factory
// Assert: Pool parameters validated against config
```

#### 4.2 Multiple Pool Creation
**Purpose:** Test scalability
```typescript
it("handles creation of many pools")
// Action: Create 100 pools with unique post_ids
// Assert: total_pools = 100
// Assert: Each pool has unique PDA
// Assert: Each registry entry is correct
```

### 5. Edge Cases and Security

#### 5.1 Post ID Uniqueness
**Purpose:** Prevent duplicate pools
```typescript
it("prevents duplicate pools for same post_id")
// Action: Create pool, then try again with same post_id
// Assert: Pool already exists error
```

#### 5.2 Invalid Post ID
**Purpose:** Validate post_id format
```typescript
it("rejects pool creation with zero post_id")
// Action: Try post_id = [0; 32]
// Assert: InvalidPostId error
```

#### 5.3 Account Size Limits
**Purpose:** Verify account sizes
```typescript
it("verifies factory account size")
// Assert: PoolFactory = 81 bytes exactly
it("verifies registry account size")
// Assert: PoolRegistry = 81 bytes exactly
```

### 6. State Consistency

#### 6.1 Total Pools Counter
**Purpose:** Ensure accurate tracking
```typescript
it("increments total_pools atomically")
// Create pools in rapid succession
// Assert: No lost increments
// Assert: total_pools matches actual pool count
```

#### 6.2 Registry PDA Derivation
**Purpose:** Verify deterministic addresses
```typescript
it("derives registry PDA correctly")
// For each created pool:
// Assert: Registry PDA = derive(["registry", post_id])
// Assert: Can read registry at expected address
```

### 7. Authority Scenarios

#### 7.1 Authority Recovery
**Purpose:** Test authority handover
```typescript
it("handles authority transfer scenario")
// Simulate: Original authority becomes compromised
// Action: Transfer to new authority while still valid
// Assert: New authority has full control
// Assert: Old authority locked out
```

#### 7.2 Split Authority Benefits
**Purpose:** Validate dual authority model
```typescript
it("demonstrates factory/pool authority separation")
// Setup: Different factory and pool authorities
// Show: pool_authority can operate pools but not update authorities
// Show: factory_authority can update both but might not operate pools
// Assert: Separation of concerns maintained
```

## Attack Vector Tests

### 1. Authority Spoofing
```typescript
it("prevents fake factory references in pools")
// Try to create pool with spoofed factory reference
// Assert: Factory must sign the transaction
```

### 2. Registry Manipulation
```typescript
it("prevents registry tampering")
// Try to modify existing registry entry
// Assert: Only program can modify
```

### 3. Factory State Tampering
```typescript
it("prevents unauthorized factory modifications")
// Try to directly modify total_pools
// Assert: Only program can modify through instructions
```

## Performance Tests

### Compute Units
```typescript
it("measures CU usage for operations")
// Initialize factory: < 150K CUs
// Create pool: < 400K CUs (includes pool + registry)
// Update authority: < 100K CUs
```

### Concurrent Operations
```typescript
it("handles concurrent pool creations")
// Submit 10 pool creations in same block
// Assert: All succeed or fail deterministically
// Assert: total_pools reflects all successful creates
```

## Migration and Upgrade Tests

### Factory Upgrade Scenario
```typescript
it("simulates factory upgrade with existing pools")
// Deploy V1, create pools
// Upgrade program (if upgradeable)
// Assert: Existing pools still reference factory
// Assert: New pools work with upgraded logic
```

## Test Data Configuration

### Mock Factories
```typescript
const TEST_FACTORY_AUTHORITY = Keypair.generate();
const TEST_POOL_AUTHORITY = Keypair.generate();
const TEST_POST_IDS = Array(10).fill(0).map((_, i) =>
  crypto.createHash('sha256').update(`post_${i}`).digest()
);
```

### Error Scenarios to Test
- InvalidAuthority
- Unauthorized
- PoolAlreadyExists
- InvalidPostId
- AccountAlreadyInitialized

## Integration Test Suite

### Full Factory Lifecycle
```typescript
it("executes complete factory lifecycle")
// 1. Initialize factory
// 2. Create multiple pools
// 3. Update pool authority
// 4. Verify pools use new authority
// 5. Update factory authority
// 6. Create more pools with new authority
// Assert: All state transitions correct
```

## Coverage Requirements
- Line Coverage: > 95%
- Branch Coverage: > 90%
- Authority paths: 100%
- Error conditions: 100%