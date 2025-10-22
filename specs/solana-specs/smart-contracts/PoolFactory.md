# PoolFactory Smart Contract

## High-Level Overview

### Purpose
PoolFactory enables permissionless deployment of ContentPool contracts with centralized authority management. Anyone can create pools for valid content, but protocol operations require authority validation. The factory maintains a dual authority model and on-chain registry for pool discovery.

### Core Innovation: Dual Authority Model
Factory maintains two separate authority levels:
- **Factory Authority**: Can update both authorities and manage factory configuration
- **Pool Authority**: Used by all pools for protocol operations (trades, settlements, withdrawals)

This separation allows the protocol to delegate operational authority without losing administrative control.

### Economic Flow
1. **Factory initialization** - Protocol deploys singleton factory with dual authority
2. **Pool creation** - Anyone creates pool for valid content_id (backend validates before signing)
3. **Registry tracking** - On-chain registry enables pool discovery and management
4. **Authority delegation** - Single authority update affects all pools simultaneously

---

## Low-Level Implementation Specification

### Data Structures

#### Primary Account: PoolFactory

```rust
#[account]
pub struct PoolFactory {
    // Authority (64 bytes)
    pub factory_authority: Pubkey,    // Can update both authorities (32 bytes)
    pub pool_authority: Pubkey,       // Authority for pool operations (32 bytes)

    // Stats (8 bytes)
    pub total_pools: u64,             // Total pools created (8 bytes)

    // Default ICBS Parameters (8 bytes)
    pub default_F: u16,               // Default growth exponent (2 bytes)
    pub default_beta_num: u16,        // Default β numerator (2 bytes)
    pub default_beta_den: u16,        // Default β denominator (2 bytes)

    // Limits (16 bytes)
    pub min_initial_deposit: u64,     // Minimum deployment amount (8 bytes)
    pub min_settle_interval: i64,     // Default settlement cooldown (8 bytes)

    // Custodian Reference (32 bytes)
    pub custodian: Pubkey,            // VeritasCustodian address (32 bytes)

    // PDA (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}
// Total: 129 bytes + 8 discriminator = 137 bytes
```

**PDA Derivation:**
```rust
seeds = [b"factory"]
(address, bump) = Pubkey::find_program_address(seeds, program_id)
```

#### Registry Account: PoolRegistry

```rust
#[account]
pub struct PoolRegistry {
    // Identity (64 bytes)
    pub content_id: Pubkey,           // Content identifier (32 bytes)
    pub pool_address: Pubkey,         // Pool PDA address (32 bytes)

    // Metadata (40 bytes)
    pub creator: Pubkey,              // Pool creator (32 bytes)
    pub created_at: i64,              // Timestamp (8 bytes)

    // PDA (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}
// Total: 105 bytes + 8 discriminator = 113 bytes
```

**PDA Derivation:**
```rust
seeds = [b"registry", content_id.as_ref()]
(address, bump) = Pubkey::find_program_address(seeds, program_id)
```

#### Constants

```rust
// Seeds
pub const FACTORY_SEED: &[u8] = b"factory";
pub const REGISTRY_SEED: &[u8] = b"registry";

// Default ICBS Parameters
pub const DEFAULT_F: u16 = 1;  // Reduced from 3 to avoid numerical overflow
pub const DEFAULT_BETA_NUM: u16 = 1;
pub const DEFAULT_BETA_DEN: u16 = 2;  // β = 0.5

// Default Limits
pub const DEFAULT_MIN_INITIAL_DEPOSIT: u64 = 100_000_000;  // 100 USDC
pub const DEFAULT_MIN_SETTLE_INTERVAL: i64 = 300;          // 5 minutes

// Validation Bounds
pub const MIN_F: u16 = 1;
pub const MAX_F: u16 = 10;
pub const MIN_BETA: f64 = 0.1;
pub const MAX_BETA: f64 = 0.9;
```

### Function Signatures

#### State Modifying Functions

```rust
// 1. Initialize factory (one-time setup)
pub fn initialize_factory(
    ctx: Context<InitializeFactory>,
    factory_authority: Pubkey,
    pool_authority: Pubkey,
    custodian: Pubkey,
) -> Result<()>

// 2. Create new pool
pub fn create_pool(
    ctx: Context<CreatePool>,
    content_id: Pubkey,
    F: u16,                          // Optional: uses default if not provided
    beta_num: u16,                   // Optional: uses default if not provided
    beta_den: u16,                   // Optional: uses default if not provided
) -> Result<()>

// 3. Update pool authority
pub fn update_pool_authority(
    ctx: Context<UpdatePoolAuthority>,
    new_pool_authority: Pubkey,
) -> Result<()>

// 4. Update factory authority
pub fn update_factory_authority(
    ctx: Context<UpdateFactoryAuthority>,
    new_factory_authority: Pubkey,
) -> Result<()>

// 5. Update default parameters
pub fn update_defaults(
    ctx: Context<UpdateDefaults>,
    default_F: Option<u16>,
    default_beta_num: Option<u16>,
    default_beta_den: Option<u16>,
    min_initial_deposit: Option<u64>,
    min_settle_interval: Option<i64>,
) -> Result<()>
```

#### View Functions

```rust
// Factory state (Solana accounts are readable by default)
// Clients read PoolFactory account directly
//
// Get pool address for content_id:
// seeds = [b"content_pool", content_id.as_ref()]
// (pool_address, _) = Pubkey::find_program_address(seeds, program_id)
//
// Get registry address for content_id:
// seeds = [b"registry", content_id.as_ref()]
// (registry_address, _) = Pubkey::find_program_address(seeds, program_id)
```

### Instruction Contexts

```rust
#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 129,
        seeds = [b"factory"],
        bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(content_id: Pubkey)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,

    /// CHECK: ContentPool program will validate this
    #[account(
        mut,
        seeds = [b"content_pool", content_id.as_ref()],
        bump,
        seeds::program = content_pool_program.key()
    )]
    pub pool: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + 105,
        seeds = [b"registry", content_id.as_ref()],
        bump
    )]
    pub registry: Account<'info, PoolRegistry>,

    /// CHECK: Backend validates this exists in database
    pub content_id: UncheckedAccount<'info>,

    /// VeritasCustodian (for stake vault reference)
    pub custodian: Account<'info, VeritasCustodian>,

    pub creator: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Protocol authority must sign to prove backend validated content_id
    #[account(
        constraint = protocol_authority.key() == factory.pool_authority @ ErrorCode::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    /// ContentPool program
    /// CHECK: This is the ContentPool program ID
    pub content_pool_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePoolAuthority<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
        constraint = authority.key() == factory.factory_authority @ ErrorCode::Unauthorized
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateFactoryAuthority<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
        constraint = authority.key() == factory.factory_authority @ ErrorCode::Unauthorized
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateDefaults<'info> {
    #[account(
        mut,
        seeds = [b"factory"],
        bump = factory.bump,
        constraint = authority.key() == factory.factory_authority @ ErrorCode::Unauthorized
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}
```

### Events

```rust
#[event]
pub struct FactoryInitializedEvent {
    pub factory: Pubkey,
    pub factory_authority: Pubkey,
    pub pool_authority: Pubkey,
    pub custodian: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolCreatedEvent {
    pub pool: Pubkey,
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub F: u16,
    pub beta_num: u16,
    pub beta_den: u16,
    pub registry: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PoolAuthorityUpdatedEvent {
    pub factory: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct FactoryAuthorityUpdatedEvent {
    pub factory: Pubkey,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct DefaultsUpdatedEvent {
    pub factory: Pubkey,
    pub default_F: u16,
    pub default_beta_num: u16,
    pub default_beta_den: u16,
    pub min_initial_deposit: u64,
    pub min_settle_interval: i64,
    pub timestamp: i64,
}
```

### Error Codes

```rust
#[error_code]
pub enum FactoryError {
    // Initialization (7000-7009)
    #[msg("Factory already initialized")]
    AlreadyInitialized,
    #[msg("Invalid authority address")]
    InvalidAuthority,

    // Pool creation (7010-7019)
    #[msg("Pool already exists for content_id")]
    PoolAlreadyExists,
    #[msg("Invalid content_id")]
    InvalidContentId,
    #[msg("Invalid ICBS parameters")]
    InvalidParameters,

    // Authority (7020-7029)
    #[msg("Unauthorized (not factory authority)")]
    Unauthorized,
    #[msg("Unauthorized protocol authority")]
    UnauthorizedProtocol,

    // Parameters (7030-7039)
    #[msg("Invalid growth exponent F")]
    InvalidF,
    #[msg("Invalid coupling coefficient β")]
    InvalidBeta,
    #[msg("Invalid minimum deposit")]
    InvalidMinDeposit,
    #[msg("Invalid settle interval")]
    InvalidSettleInterval,
}
```

---

## Integration Points

### ContentPool
- Factory creates pools via CPI to ContentPool program
- Pool stores factory address for authority validation
- Factory provides default ICBS parameters
- Factory validates content_id before pool creation

### VeritasCustodian
- Factory stores custodian address
- Passes custodian to ContentPool during creation
- ContentPool references custodian for stake vault

### Backend (Protocol Authority)
- Backend validates content_id exists in database
- Backend signs create_pool with pool_authority
- User also signs create_pool (pays for pool creation)
- Dual signature pattern ensures validation + permissionless creation

### Database
- Event indexer syncs PoolCreatedEvent → pool_deployments
- Registry provides on-chain discovery
- Backend maintains off-chain mapping: content_id → pool_address

---

## Pool Creation Flow

### Backend Validation Flow

```
1. User requests pool creation for content_id
   ↓
2. Frontend calls: POST /api/pool/create
   { content_id, creator_wallet }
   ↓
3. Backend validates content_id:
   - Check posts or beliefs table
   - Ensure content_id exists
   - Ensure pool doesn't already exist
   ↓
4. Backend builds transaction:
   - Call PoolFactory::create_pool(content_id, default F, default β)
   - Set creator as fee payer
   - Sign with pool_authority (proves validation)
   ↓
5. Return transaction to frontend
   ↓
6. User signs transaction (confirms + pays)
   ↓
7. Transaction executes:
   - Factory creates registry
   - Factory calls ContentPool::initialize_pool via CPI
   - ContentPool created with factory's default params
   ↓
8. Event indexer processes PoolCreatedEvent:
   - INSERT INTO pool_deployments
   - Map content_id → pool_address
```

### On-Chain Flow

```rust
pub fn create_pool(
    ctx: Context<CreatePool>,
    content_id: Pubkey,
    F: u16,
    beta_num: u16,
    beta_den: u16,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    // 1. Validate parameters
    require!(F >= MIN_F && F <= MAX_F, ErrorCode::InvalidF);
    require!(beta_num > 0 && beta_den > 0, ErrorCode::InvalidBeta);

    let beta = (beta_num as f64) / (beta_den as f64);
    require!(beta >= MIN_BETA && beta <= MAX_BETA, ErrorCode::InvalidBeta);

    // 2. Create registry entry
    let registry = &mut ctx.accounts.registry;
    registry.content_id = content_id;
    registry.pool_address = ctx.accounts.pool.key();
    registry.creator = ctx.accounts.creator.key();
    registry.created_at = Clock::get()?.unix_timestamp;
    registry.bump = ctx.bumps.registry;

    // 3. CPI to ContentPool::initialize_pool
    let cpi_program = ctx.accounts.content_pool_program.to_account_info();
    let cpi_accounts = content_pool::cpi::accounts::InitializePool {
        pool: ctx.accounts.pool.to_account_info(),
        content_id: ctx.accounts.content_id.to_account_info(),
        factory: factory.to_account_info(),
        creator: ctx.accounts.creator.to_account_info(),
        payer: ctx.accounts.payer.to_account_info(),
        system_program: ctx.accounts.system_program.to_account_info(),
    };

    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

    content_pool::cpi::initialize_pool(
        cpi_ctx,
        content_id,
        F,
        beta_num,
        beta_den,
    )?;

    // 4. Update factory stats
    factory.total_pools = factory.total_pools
        .checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // 5. Emit event
    emit!(PoolCreatedEvent {
        pool: ctx.accounts.pool.key(),
        content_id,
        creator: ctx.accounts.creator.key(),
        F,
        beta_num,
        beta_den,
        registry: ctx.accounts.registry.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

---

## Authority Management

### Dual Authority Rationale

**Why two authorities?**

1. **Separation of concerns**:
   - Factory authority: Administrative (update config, transfer ownership)
   - Pool authority: Operational (sign trades, settlements, withdrawals)

2. **Security**:
   - Factory authority can be cold wallet (rarely used)
   - Pool authority can be hot wallet (backend service)
   - Compromise of pool authority doesn't affect factory ownership

3. **Flexibility**:
   - Can rotate pool authority without changing factory ownership
   - Can delegate operations to different services
   - Single update affects all pools simultaneously

### Authority Update Flow

**Update pool authority** (affects all pools):
```rust
pub fn update_pool_authority(
    ctx: Context<UpdatePoolAuthority>,
    new_pool_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    require!(
        new_pool_authority != Pubkey::default(),
        ErrorCode::InvalidAuthority
    );

    let old_authority = factory.pool_authority;
    factory.pool_authority = new_pool_authority;

    emit!(PoolAuthorityUpdatedEvent {
        factory: factory.key(),
        old_authority,
        new_authority: new_pool_authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

**Update factory authority** (transfer ownership):
```rust
pub fn update_factory_authority(
    ctx: Context<UpdateFactoryAuthority>,
    new_factory_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    require!(
        new_factory_authority != Pubkey::default(),
        ErrorCode::InvalidAuthority
    );

    let old_authority = factory.factory_authority;
    factory.factory_authority = new_factory_authority;

    emit!(FactoryAuthorityUpdatedEvent {
        factory: factory.key(),
        old_authority,
        new_authority: new_factory_authority,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

---

## Default Parameters

### Update Defaults

Factory authority can update default ICBS parameters for all new pools:

```rust
pub fn update_defaults(
    ctx: Context<UpdateDefaults>,
    default_F: Option<u16>,
    default_beta_num: Option<u16>,
    default_beta_den: Option<u16>,
    min_initial_deposit: Option<u64>,
    min_settle_interval: Option<i64>,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    // Update F if provided
    if let Some(F) = default_F {
        require!(F >= MIN_F && F <= MAX_F, ErrorCode::InvalidF);
        factory.default_F = F;
    }

    // Update β if provided
    if let Some(num) = default_beta_num {
        require!(num > 0, ErrorCode::InvalidBeta);
        factory.default_beta_num = num;
    }

    if let Some(den) = default_beta_den {
        require!(den > 0, ErrorCode::InvalidBeta);
        factory.default_beta_den = den;
    }

    // Validate β range
    let beta = (factory.default_beta_num as f64) / (factory.default_beta_den as f64);
    require!(beta >= MIN_BETA && beta <= MAX_BETA, ErrorCode::InvalidBeta);

    // Update limits if provided
    if let Some(min_deposit) = min_initial_deposit {
        require!(min_deposit > 0, ErrorCode::InvalidMinDeposit);
        factory.min_initial_deposit = min_deposit;
    }

    if let Some(interval) = min_settle_interval {
        require!(interval > 0, ErrorCode::InvalidSettleInterval);
        factory.min_settle_interval = interval;
    }

    emit!(DefaultsUpdatedEvent {
        factory: factory.key(),
        default_F: factory.default_F,
        default_beta_num: factory.default_beta_num,
        default_beta_den: factory.default_beta_den,
        min_initial_deposit: factory.min_initial_deposit,
        min_settle_interval: factory.min_settle_interval,
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
```

**Note**: Updating defaults only affects **new pools**. Existing pools keep their original parameters.

---

## Registry Usage

### On-Chain Pool Discovery

The registry enables on-chain lookup of pools by content_id:

```typescript
// Get pool address for content_id
const [poolAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("content_pool"), contentId.toBuffer()],
    CONTENT_POOL_PROGRAM_ID
);

// Get registry for additional metadata
const [registryAddress] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry"), contentId.toBuffer()],
    POOL_FACTORY_PROGRAM_ID
);

const registry = await program.account.poolRegistry.fetch(registryAddress);
// registry.creator, registry.created_at, registry.pool_address
```

### Preventing Duplicate Pools

Registry prevents duplicate pool creation:

```rust
// In create_pool context
#[account(
    init,  // Will fail if registry already exists
    payer = payer,
    space = 8 + 105,
    seeds = [b"registry", content_id.as_ref()],
    bump
)]
pub registry: Account<'info, PoolRegistry>,
```

If a pool already exists for content_id, the `init` constraint will fail with "Account already exists".

---

**Related Specifications:**
- [ContentPool.md](ContentPool.md) - Pool implementation that factory creates
- [VeritasCustodian.md](archive/VeritasCustodian.md) - Stake custody referenced by pools
- [implementation-guidance.md](implementation-guidance.md) - Detailed implementation guidance

**Implementation Notes:**
- Factory is a singleton (one per program deployment)
- Registry entries are permanent (no delete instruction)
- Authority updates take effect immediately for all pools
- Default parameters only affect new pools, not existing ones
