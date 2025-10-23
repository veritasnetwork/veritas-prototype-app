# PoolFactory Test Specification

## Test Environment
- **Framework:** Anchor Test Suite
- **Runtime:** Solana Test Validator (localnet)
- **Language:** TypeScript
- **Location:** `/solana/veritas-curation/tests/`

## Overview
PoolFactory is a singleton contract that manages ContentPool creation with:
- Dual authority model (factory authority + pool authority)
- Permissionless pool creation with backend validation
- On-chain registry for pool discovery
- Default ICBS parameters for new pools
- Global custodian reference

## Test Categories

### 1. Factory Initialization

#### 1.1 Singleton Creation
**Purpose:** Verify one-time factory setup
```typescript
it("initializes factory with correct authorities")
// Action: Initialize factory with factory_authority, pool_authority, custodian
// Assert:
//   - factory.factory_authority = expected
//   - factory.pool_authority = expected
//   - factory.custodian = expected
//   - factory.total_pools = 0
//   - Default parameters set correctly (F=2, β=0.5)
//   - PDA derived correctly from seeds ["factory"]

it("prevents duplicate factory initialization")
// Try to initialize factory again
// Assert: Error code 7000 (AlreadyInitialized)
```

#### 1.2 Default Parameters
**Purpose:** Verify default ICBS parameters
```typescript
it("sets correct default ICBS parameters")
// After initialization
// Assert: default_f = 3
// Assert: default_beta_num = 1
// Assert: default_beta_den = 2 (β = 0.5)
// Assert: min_initial_deposit = 100 USDC
// Assert: min_settle_interval = 300 seconds
```

### 2. Pool Creation

#### 2.1 Permissionless Creation
**Purpose:** Test that any user can create pools
```typescript
it("allows any user to create a pool")
// Setup: Random user (not authority)
// Action: User calls create_pool (no protocol_authority needed)
// Assert:
//   - Pool created at expected PDA
//   - Registry entry created
//   - factory.total_pools incremented
//   - Pool contains factory reference
//   - Pool uses factory default parameters

it("does not require protocol authority signature")
// User creates pool without protocol_authority signing
// Assert: Pool created successfully
// Note: Backend validation happens before transaction reaches chain
```

#### 2.2 Registry Management
**Purpose:** Verify registry entries
```typescript
it("creates registry entry for each pool")
// Create pool for content_id
// Assert:
//   - Registry PDA exists at ["registry", content_id]
//   - registry.content_id matches
//   - registry.pool_address correct
//   - registry.creator set
//   - registry.created_at > 0

it("prevents duplicate pools for same content_id")
// Create pool for content_id
// Try to create another pool for same content_id
// Assert: Registry init fails (account exists)
```

#### 2.3 Parameter Inheritance
**Purpose:** Test pool inherits factory defaults
```typescript
it("creates pool with factory default parameters")
// Create pool (no parameters can be specified)
// Fetch created pool account
// Assert: Pool F = factory.default_f
// Assert: Pool beta matches factory defaults
// Assert: Pool min_settle_interval = factory default

it("enforces factory defaults for all pools")
// Try to create pool with custom parameters (not possible in new architecture)
// Assert: Pool always uses factory defaults
// Note: Only factory authority can change defaults via update_defaults
// Validate: F in [1, 10], β in [0.1, 0.9]

it("rejects invalid custom parameters")
// Try F=0 or F=11 - should fail
// Try β=0.05 or β=0.95 - should fail
// Assert: Error code 7030 (InvalidF) or 7031 (InvalidBeta)
```

#### 2.4 CPI to ContentPool
**Purpose:** Verify cross-program invocation
```typescript
it("successfully calls ContentPool::initialize_pool via CPI")
// Create pool through factory
// Assert: ContentPool account exists
// Assert: ContentPool initialized correctly
// Assert: Pool.factory references this factory
```

### 3. Authority Management

#### 3.1 Pool Authority Updates
**Purpose:** Test operational authority changes
```typescript
it("allows factory_authority to update pool_authority")
// Setup: New pool authority keypair
// Action: factory_authority calls update_pool_authority
// Assert: factory.pool_authority = new_authority
// Assert: Event emitted with old and new authorities

it("rejects pool_authority update from unauthorized signer")
// Random user tries to update pool_authority
// Assert: Unauthorized error

it("rejects pool_authority update from pool_authority itself")
// pool_authority tries to update itself
// Assert: Unauthorized error (only factory_authority can)

it("validates new pool_authority is not default pubkey")
// Try to set pool_authority to Pubkey::default()
// Assert: InvalidAuthority error
```

#### 3.2 Factory Authority Transfer
**Purpose:** Test ownership transfer
```typescript
it("allows factory_authority to transfer ownership")
// Setup: New factory authority
// Action: Current factory_authority transfers ownership
// Assert: factory.factory_authority = new_authority
// Test: Old authority can no longer make changes

it("rejects factory_authority update from unauthorized")
// Random user tries to update factory_authority
// Assert: Unauthorized error

it("validates new factory_authority is not default pubkey")
// Try to set factory_authority to Pubkey::default()
// Assert: InvalidAuthority error
```

#### 3.3 Authority Propagation
**Purpose:** Verify pools use current factory authorities
```typescript
it("existing pools use updated pool_authority")
// Create pool1
// Update factory.pool_authority
// Create pool2
// Pool1 operations should use new pool_authority
// Pool2 operations should use new pool_authority
// Note: Pools reference factory, check factory.pool_authority dynamically
```

### 4. Default Parameter Updates

#### 4.1 Update Default ICBS Parameters
**Purpose:** Test default parameter changes
```typescript
it("allows factory_authority to update default_f")
// Update default_f from 3 to 5
// Assert: factory.default_f = 5
// Create new pool
// Assert: New pool has F = 5

it("allows factory_authority to update default_beta")
// Update beta_num=2, beta_den=5 (β=0.4)
// Assert: Factory defaults updated
// Create new pool
// Assert: New pool has β = 0.4

it("validates parameter bounds on update")
// Try to set F = 15 (above max)
// Assert: InvalidF error
// Try to set β = 0.05 (below min)
// Assert: InvalidBeta error
```

#### 4.2 Update Operational Limits
**Purpose:** Test limit modifications
```typescript
it("allows update of min_initial_deposit")
// Update from 100 USDC to 200 USDC
// Assert: factory.min_initial_deposit = 200 USDC
// New pools require 200 USDC minimum

it("allows update of min_settle_interval")
// Update from 300 to 600 seconds
// Assert: factory.min_settle_interval = 600
// New pools have 10-minute cooldown
```

#### 4.3 Defaults Only Affect New Pools
**Purpose:** Verify existing pools unchanged
```typescript
it("existing pools retain original parameters after default update")
// Create pool1 with default F=2
// Update factory default_f to 5
// Create pool2
// Assert: pool1 still has F=2
// Assert: pool2 has F=5
```

### 5. State Consistency

#### 5.1 Pool Counter
**Purpose:** Verify accurate pool counting
```typescript
it("increments total_pools atomically")
// Initial: factory.total_pools = 0
// Create 5 pools rapidly
// Assert: factory.total_pools = 5
// No lost increments

it("handles concurrent pool creation")
// Submit multiple create_pool transactions
// All should succeed with unique content_ids
// Counter should match total created
```

#### 5.2 PDA Derivation
**Purpose:** Verify deterministic addresses
```typescript
it("derives consistent PDAs for factory")
// Factory PDA = ["factory"]
// Verify matches on-chain address

it("derives consistent PDAs for registries")
// Registry PDA = ["registry", content_id]
// Create pool and verify registry address

it("derives consistent PDAs for pools")
// Pool PDA = ["content_pool", content_id]
// Verify pool created at expected address
```

### 6. Custodian Integration

#### 6.1 Custodian Reference
**Purpose:** Verify custodian linkage
```typescript
it("stores custodian reference in factory")
// Initialize with custodian address
// Assert: factory.custodian = expected

it("passes custodian to created pools")
// Create pool through factory
// Assert: Pool references same custodian
// Pool will use custodian.stake_vault for skims
```

### 7. Error Handling

#### 7.1 Input Validation
**Purpose:** Test error conditions
```typescript
it("rejects invalid content_id (default pubkey)")
// Try to create pool with Pubkey::default()
// Assert: InvalidContentId error

it("rejects pool creation without required signatures")
// Missing user signature
// Assert: Signature verification failed
// Missing protocol signature
// Assert: UnauthorizedProtocol error
```

#### 7.2 Account Validation
**Purpose:** Verify account checks
```typescript
it("validates content_pool_program in create_pool")
// Pass wrong program ID
// Assert: Constraint violation or CPI error

it("validates custodian account exists")
// Pass invalid custodian
// Assert: Account validation fails
```

### 8. Events

#### 8.1 Event Emission
**Purpose:** Verify events for indexing
```typescript
it("emits FactoryInitializedEvent on init")
// Initialize factory
// Assert: Event contains authorities, custodian, timestamp

it("emits PoolCreatedEvent on pool creation")
// Create pool
// Assert: Event contains pool, content_id, creator, params

it("emits authority update events")
// Update authorities
// Assert: Events contain old and new values
```

## Test Data Configuration

### Constants
```typescript
// Seeds
const FACTORY_SEED = "factory";
const REGISTRY_SEED = "registry";
const CONTENT_POOL_SEED = "content_pool";

// Default parameters
const DEFAULT_F = 2;
const DEFAULT_BETA_NUM = 1;
const DEFAULT_BETA_DEN = 2;

// Limits
const DEFAULT_MIN_INITIAL_DEPOSIT = 100_000_000; // 100 USDC
const DEFAULT_MIN_SETTLE_INTERVAL = 300; // 5 minutes

// Bounds
const MIN_F = 1;
const MAX_F = 10;
```

### Mock Setup
```typescript
// Factory authority: Provider wallet or test keypair
// Pool authority: Deterministic test keypair
// Custodian: Mock VeritasCustodian PDA
// Content IDs: SHA-256 hashes for uniqueness
// Random users: Generated keypairs with SOL airdrops
```

## Implementation Priority

### Phase 1: Core Functionality (Must Have)
1. Factory initialization
2. Pool creation with registry
3. Authority management (both types)
4. Duplicate prevention
5. Parameter validation

### Phase 2: Advanced Features (Should Have)
1. Default parameter updates
2. Custodian integration
3. Event emission
4. Authority propagation testing
5. Concurrent operation handling

### Phase 3: Edge Cases (Nice to Have)
1. Invalid input handling
2. Account validation errors
3. CPI failure scenarios
4. Extreme parameter testing

## Integration Points

### With ContentPool
- Factory creates pools via CPI
- Pools store factory reference
- Pools check factory.pool_authority for operations

### With VeritasCustodian
- Factory stores custodian address
- Passes to pools during creation
- Pools use custodian.stake_vault

### With Backend
- Backend validates content_id exists
- Backend signs with pool_authority
- User signs as fee payer

## Test Count Summary

### Total Tests: 35
- **Factory Initialization:** 3 tests
- **Pool Creation:** 8 tests
- **Authority Management:** 7 tests
- **Default Parameters:** 6 tests
- **State Consistency:** 3 tests
- **Custodian Integration:** 2 tests
- **Error Handling:** 3 tests
- **Events:** 3 tests

### Critical Tests (MUST PASS)
1. ✅ Factory singleton initialization
2. ✅ Pool creation with registry
3. ✅ Duplicate prevention via registry
4. ✅ Authority updates (both types)
5. ✅ CPI to ContentPool
6. ✅ Parameter validation
7. ✅ Protocol authority validation

## Success Criteria
- All 7 critical tests passing
- 90%+ of all tests passing (32/35)
- Factory singleton properly initialized
- Authority model working as designed
- Registry prevents duplicates
- Events properly emitted for indexing