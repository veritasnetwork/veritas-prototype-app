# PoolFactory Smart Contract

Permissionless deployment of ContentPool contracts with centralized authority management. Anyone can create pools, but protocol operations require authority.

## Core Mechanism

### Dual Authority Model
Factory maintains two authority levels:
- **Factory Authority:** Can update both authorities
- **Pool Authority:** Used by all pools for operations

### Permissionless Pool Creation
Anyone can create pools for any post_id. Pools reference factory for authority validation.

### Pool Registry
Central tracking of all deployed pools for discovery and management.

## Purpose
Enables permissionless pool creation while maintaining protocol control over epoch operations (penalties, rewards, supply cap adjustments).

---

# PoolFactory Implementation

**Program:** `veritas-curation`
**Module:** `pool_factory`
**Singleton:** Yes (factory PDA)

## Account Structure

```rust
#[account]
pub struct PoolFactory {
    pub factory_authority: Pubkey,    // Can update both authorities (32 bytes)
    pub pool_authority: Pubkey,       // Authority for pool operations (32 bytes)
    pub total_pools: u64,             // Total pools created (8 bytes)
    pub bump: u8,                     // PDA bump seed (1 byte)
}
// Total: 73 bytes + 8 discriminator = 81 bytes

#[account]
pub struct PoolRegistry {
    pub post_id: [u8; 32],           // Content identifier (32 bytes)
    pub pool_address: Pubkey,        // Pool PDA address (32 bytes)
    pub created_at: i64,             // Timestamp (8 bytes)
    pub bump: u8,                    // PDA bump seed (1 byte)
}
// Total: 73 bytes + 8 discriminator = 81 bytes
```

## Instructions

### 1. Initialize Factory

Creates singleton factory PDA with dual authority model.

**Parameters:**
- `factory_authority: Pubkey` - Can update both authorities
- `pool_authority: Pubkey` - Used by all pools for operations

**Validation:**
```rust
// Validate authorities
require!(factory_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(pool_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(factory_authority != system_program::ID, ErrorCode::InvalidAuthority);
require!(pool_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Updates:**
```rust
factory.factory_authority = factory_authority;
factory.pool_authority = pool_authority;
factory.total_pools = 0;
factory.bump = bump;
```

**Context:**
```rust
#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 73,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

---

### 2. Create Pool

Permissionless pool creation with registry tracking.

**Validation:**
```rust
// Validate post_id
require!(post_id != [0u8; 32], ErrorCode::InvalidPostId);

// Optional: Validate parameters against config
if let Some(config) = ctx.accounts.config.as_ref() {
    require!(initial_k_quadratic >= config.min_k_quadratic, ErrorCode::InvalidParameters);
    require!(initial_k_quadratic <= config.max_k_quadratic, ErrorCode::InvalidParameters);
    require!(supply_cap >= config.min_supply_cap, ErrorCode::InvalidParameters);
    require!(supply_cap <= config.max_supply_cap, ErrorCode::InvalidParameters);
}

// Prevent duplicates
require!(!registry.is_initialized(), ErrorCode::PoolAlreadyExists);
```

**Pool Initialization:**
```rust
// Initialize ContentPool
pool.post_id = post_id;
pool.factory = factory.key();  // Reference to factory
pool.k_quadratic = initial_k_quadratic;
pool.supply_cap = supply_cap;
pool.token_supply = 0;
pool.reserve = 0;
pool.usdc_vault = usdc_vault.key();
pool.bump = bump;
```

**Registry Creation:**
```rust
registry.post_id = post_id;
registry.pool_address = pool.key();
registry.created_at = Clock::get()?.unix_timestamp;
registry.bump = bump;

// Safe increment with overflow check
factory.total_pools = factory.total_pools
    .checked_add(1)
    .ok_or(ErrorCode::NumericalOverflow)?;
```

**Context:**
```rust
#[derive(Accounts)]
#[instruction(post_id: [u8; 32])]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        init,
        payer = payer,
        space = 8 + 161,
        seeds = [b"pool", post_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
    )]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        space = 8 + 73,
        seeds = [b"registry", post_id.as_ref()],
        bump
    )]
    pub registry: Account<'info, PoolRegistry>,

    // Optional config for validation
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub usdc_mint: Account<'info, Mint>,
    pub creator: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
```

---

### 3. Update Pool Authority

Updates authority used by all pools for operations.

**Validation:**
```rust
require!(authority.key() == factory.factory_authority, ErrorCode::Unauthorized);
require!(new_pool_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(new_pool_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Update:**
```rust
let old_authority = factory.pool_authority;
factory.pool_authority = new_pool_authority;
msg!("Pool authority updated: old={}, new={}", old_authority, new_pool_authority);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdatePoolAuthority<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}
```

---

### 4. Update Factory Authority

Transfers factory ownership.

**Validation:**
```rust
require!(authority.key() == factory.factory_authority, ErrorCode::Unauthorized);
require!(new_factory_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(new_factory_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Update:**
```rust
let old_authority = factory.factory_authority;
factory.factory_authority = new_factory_authority;
msg!("Factory authority updated: old={}, new={}", old_authority, new_factory_authority);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdateFactoryAuthority<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}
```

---

## View Functions

```rust
// Get pool address for post_id
pub fn get_pool_address(post_id: [u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"pool", post_id.as_ref()],
        &ID
    )
}

// Get registry address for post_id
pub fn get_registry_address(post_id: [u8; 32]) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"registry", post_id.as_ref()],
        &ID
    )
}
```

## Error Codes

```rust
#[error_code]
pub enum FactoryError {
    #[msg("Factory already initialized")]
    AlreadyInitialized,

    #[msg("Pool already exists for post_id")]
    PoolAlreadyExists,

    #[msg("Invalid parameters")]
    InvalidParameters,

    #[msg("Invalid authority address")]
    InvalidAuthority,

    #[msg("Invalid post ID")]
    InvalidPostId,

    #[msg("Numerical overflow")]
    NumericalOverflow,

    #[msg("Unauthorized")]
    Unauthorized,
}
```

## Constants

```rust
// Seeds
pub const FACTORY_SEED: &[u8] = b"factory";
pub const POOL_SEED: &[u8] = b"pool";
pub const REGISTRY_SEED: &[u8] = b"registry";

// Default curve parameters (if no config)
pub const DEFAULT_K_QUADRATIC: u128 = 1_000_000;       // 1e-6 with precision
pub const DEFAULT_SUPPLY_CAP: u128 = 100_000_000_000;  // 100k tokens

// Minimum bounds
pub const MIN_K_QUADRATIC: u128 = 1_000;              // 1e-9
pub const MIN_SUPPLY_CAP: u128 = 1_000_000_000;       // 1k tokens
```

## Integration Flow

```
1. Initialize Factory (once)
   - Set factory_authority and pool_authority

2. Create Pools (permissionless)
   - Anyone can create for any post_id
   - Parameters validated against optional config
   - Registry tracks all pools

3. Pool Operations (authority required)
   - Pools check factory.pool_authority dynamically
   - Single authority update affects all pools

4. Authority Management
   - Factory authority can update both authorities
   - Allows delegation without losing control
```

## Implementation Notes

1. **Function signature**: `initialize_factory` takes TWO parameters (factory_authority and pool_authority), not one. This was missed in initial spec.

2. **Module structure**: Implementation is in `src/pool_factory/` with:
   - `state.rs` - Account structs and constants
   - `instructions/initialize_factory.rs`
   - `instructions/create_pool.rs`
   - `instructions/update_pool_authority.rs`
   - `instructions/update_factory_authority.rs`

3. **Cross-module imports**: Other modules can import `PoolFactory` via `crate::pool_factory::state::PoolFactory`. ContentPool references the factory for authority validation.