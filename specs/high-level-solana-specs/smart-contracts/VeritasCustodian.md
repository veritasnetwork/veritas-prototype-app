# VeritasCustodian Smart Contract

Pooled custody vault for Veritas protocol stake management. All user deposits flow into a single pool, with individual balances tracked off-chain by the protocol.

## Core Mechanism

### Pooled Custody Model
- All USDC deposits go into single protocol-owned pool
- No on-chain tracking of individual balances
- Protocol authority manages withdrawals on behalf of users
- Enables profit redistribution beyond initial deposits

### Off-Chain Integration
- Backend indexes deposit events by wallet
- Protocol tracks individual stakes (including profits/losses)
- Only protocol authority can execute withdrawals

## Purpose
Provides a flexible pooled custody system that enables the zero-sum redistribution mechanics of the protocol while maintaining simple on-chain logic.

---

# VeritasCustodian Implementation

**Program:** `veritas-curation`
**Module:** `veritas_custodian`
**Singleton:** Yes (custodian PDA)

## Account Structure

```rust
#[account]
pub struct VeritasCustodian {
    pub owner: Pubkey,              // Can update protocol_authority (32 bytes)
    pub protocol_authority: Pubkey, // Can withdraw on behalf of users (32 bytes)
    pub usdc_vault: Pubkey,         // Pooled USDC vault (32 bytes)
    pub total_deposits: u128,       // Total lifetime deposits (16 bytes)
    pub total_withdrawals: u128,    // Total lifetime withdrawals (16 bytes)
    pub emergency_pause: bool,      // Pause withdrawals in emergency (1 byte)
    pub bump: u8,                   // PDA bump seed (1 byte)
}
// Total: 130 bytes + 8 discriminator = 138 bytes

// No UserStake accounts - all tracking is off-chain
```

## Instructions

### 1. Initialize Custodian

Creates singleton custodian PDA with pooled USDC vault.

**Parameters:**
- `owner: Pubkey` - Can update protocol_authority
- `protocol_authority: Pubkey` - Can withdraw on behalf of users

**Validation:**
```rust
// Validate authorities
require!(owner != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(protocol_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(owner != system_program::ID, ErrorCode::InvalidAuthority);
require!(protocol_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Initialization:**
```rust
custodian.owner = owner;
custodian.protocol_authority = protocol_authority;
custodian.usdc_vault = usdc_vault.key();
custodian.total_deposits = 0;
custodian.total_withdrawals = 0;
custodian.emergency_pause = false;
custodian.bump = bump;
```

**Context:**
```rust
#[derive(Accounts)]
pub struct InitializeCustodian<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 130,
        seeds = [b"custodian"],
        bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = custodian,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

---

### 2. Deposit

Anyone can deposit USDC into the protocol pool. The depositor is tracked via events for off-chain indexing.

**Validation:**
```rust
require!(amount > 0, ErrorCode::InvalidAmount);
require!(amount >= MIN_DEPOSIT, ErrorCode::BelowMinimum);
```

**State Updates:**
```rust
// Transfer USDC from depositor to pool
token::transfer(
    CpiContext::new(
        token_program.to_account_info(),
        Transfer {
            from: depositor_usdc_account,
            to: custodian_usdc_vault,
            authority: depositor,
        },
    ),
    amount,
)?;

// Track total deposits
custodian.total_deposits = custodian.total_deposits
    .checked_add(amount as u128)
    .ok_or(ErrorCode::NumericalOverflow)?;

// Emit event for off-chain indexing
emit!(DepositEvent {
    depositor: depositor.key(),
    amount,
    timestamp: Clock::get()?.unix_timestamp,
});
```

**Context:**
```rust
#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"custodian"],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    #[account(
        mut,
        constraint = custodian_usdc_vault.key() == custodian.usdc_vault @ ErrorCode::InvalidVault
    )]
    pub custodian_usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub depositor_usdc_account: Account<'info, TokenAccount>,

    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
```

---

### 3. Withdraw

Protocol authority withdraws USDC from the pool on behalf of a user. Only the protocol can execute withdrawals.

**Parameters:**
- `amount: u64` - Amount to withdraw
- `recipient: Pubkey` - Recipient wallet address

**Validation:**
```rust
// Emergency pause check
require!(!custodian.emergency_pause, ErrorCode::SystemPaused);

// Only protocol authority can withdraw
require!(
    authority.key() == custodian.protocol_authority,
    ErrorCode::Unauthorized
);

require!(amount > 0, ErrorCode::InvalidAmount);
require!(amount >= MIN_WITHDRAWAL, ErrorCode::BelowMinimum);

// Verify vault has sufficient USDC
require!(amount <= custodian_usdc_vault.amount, ErrorCode::InsufficientVaultBalance);
```

**State Updates:**
```rust
// Track total withdrawals (can exceed deposits due to protocol profits)
custodian.total_withdrawals = custodian.total_withdrawals
    .checked_add(amount as u128)
    .ok_or(ErrorCode::NumericalOverflow)?;

// Emit event for off-chain tracking
emit!(WithdrawEvent {
    recipient,
    amount,
    authority: authority.key(),
    timestamp: Clock::get()?.unix_timestamp,
});
```

**Transfer with PDA:**
```rust
// Custodian signs transfer as PDA
let seeds = &[
    b"custodian",
    &[custodian.bump],
];
let signer = &[&seeds[..]];

token::transfer(
    CpiContext::new_with_signer(
        token_program.to_account_info(),
        Transfer {
            from: custodian_usdc_vault,
            to: recipient_usdc_account,
            authority: custodian,
        },
        signer,
    ),
    amount,
)?;
```

**Context:**
```rust
#[derive(Accounts)]
#[instruction(amount: u64, recipient: Pubkey)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"custodian"],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    #[account(
        mut,
        constraint = custodian_usdc_vault.key() == custodian.usdc_vault @ ErrorCode::InvalidVault
    )]
    pub custodian_usdc_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_usdc_account.owner == recipient @ ErrorCode::InvalidRecipient,
        constraint = recipient_usdc_account.mint == custodian_usdc_vault.mint @ ErrorCode::InvalidMint
    )]
    pub recipient_usdc_account: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}
```

---

### 4. Update Protocol Authority

Owner updates the protocol authority that can execute withdrawals.

**Validation:**
```rust
require!(authority.key() == custodian.owner, ErrorCode::Unauthorized);
require!(new_protocol_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(new_protocol_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Update:**
```rust
let old_authority = custodian.protocol_authority;
custodian.protocol_authority = new_protocol_authority;
msg!("Protocol authority updated: old={}, new={}", old_authority, new_protocol_authority);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdateProtocolAuthority<'info> {
    #[account(
        mut,
        seeds = [b"custodian"],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,  // Must be owner
}
```

---

### 5. Update Owner

Transfers ownership of the custodian contract.

**Validation:**
```rust
require!(authority.key() == custodian.owner, ErrorCode::Unauthorized);
require!(new_owner != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(new_owner != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Update:**
```rust
let old_owner = custodian.owner;
custodian.owner = new_owner;
msg!("Owner updated: old={}, new={}", old_owner, new_owner);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdateOwner<'info> {
    #[account(
        mut,
        seeds = [b"custodian"],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,  // Must be current owner
}
```

---

### 6. Toggle Emergency Pause

Owner can pause/unpause withdrawals in case of emergency.

**Parameters:**
- `paused: bool` - True to pause, false to unpause

**Validation:**
```rust
require!(authority.key() == custodian.owner, ErrorCode::Unauthorized);
```

**State Update:**
```rust
let old_state = custodian.emergency_pause;
custodian.emergency_pause = paused;
msg!("Emergency pause toggled: old={}, new={}", old_state, paused);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct ToggleEmergencyPause<'info> {
    #[account(
        mut,
        seeds = [b"custodian"],
        bump = custodian.bump
    )]
    pub custodian: Account<'info, VeritasCustodian>,

    pub authority: Signer<'info>,  // Must be owner
}
```

---

## Events

```rust
#[event]
pub struct DepositEvent {
    pub depositor: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct WithdrawEvent {
    pub recipient: Pubkey,
    pub amount: u64,
    pub authority: Pubkey,
    pub timestamp: i64,
}
```

## View Functions

```rust
// Get custodian address
pub fn get_custodian_address() -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"custodian"],
        &ID
    )
}
```

## Invariants

```rust
// The only on-chain invariant is vault balance
// Withdrawal validation: amount <= custodian_usdc_vault.amount

// Off-chain invariant (backend enforces):
// Sum of all agents.protocol_stake in database should match vault balance
// Note: total_withdrawals CAN exceed total_deposits because users withdraw profits

// Example showing why deposits < withdrawals is valid:
// - User A deposits $1000
// - User B deposits $1000
// - After epochs, User A stake grows to $1500 (took from User B)
// - User A withdraws $1500
// - Result: total_deposits = $2000, total_withdrawals = $1500
// - This is correct! User A extracted their profit.
```

## Error Codes

```rust
#[error_code]
pub enum CustodianError {
    #[msg("Invalid amount")]
    InvalidAmount,

    #[msg("Below minimum amount")]
    BelowMinimum,

    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,

    #[msg("Invalid authority address")]
    InvalidAuthority,

    #[msg("Numerical overflow")]
    NumericalOverflow,

    #[msg("Unauthorized")]
    Unauthorized,
}
```

## Constants

```rust
// Seeds
pub const CUSTODIAN_SEED: &[u8] = b"custodian";

// Minimums (in USDC with 6 decimals)
pub const MIN_DEPOSIT: u64 = 1_000_000;     // 1 USDC
pub const MIN_WITHDRAWAL: u64 = 1_000_000;  // 1 USDC

// USDC has 6 decimals
pub const USDC_DECIMALS: u8 = 6;
```

## Integration Flow

```
1. User Deposit (Permissionless)
   - User deposits USDC directly to pool
   - Backend indexes DepositEvent
   - Creates/updates veritas_agent with wallet address
   - Protocol tracks stake off-chain

2. Protocol Participation
   - Backend reads protocol_stake from database
   - User submits beliefs weighted by stake
   - Stake changes each epoch based on performance

3. User Withdrawal (Via UI)
   - User requests withdrawal through UI
   - Backend validates against protocol_stake
   - Backend calls withdraw with protocol_authority
   - Updates database to reflect new balance

4. Key Insight: Asymmetric Control
   - Deposits: Permissionless (anyone can add to pool)
   - Withdrawals: Permissioned (only protocol authority)
   - This prevents users from withdrawing without protocol consent
```

## Off-Chain Database Schema

```sql
-- Core table: Agent stake tracking
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    wallet_address TEXT UNIQUE NOT NULL,
    protocol_stake NUMERIC DEFAULT 0,      -- Current stake (changes with epochs)
    total_deposited NUMERIC DEFAULT 0,     -- Audit trail
    total_withdrawn NUMERIC DEFAULT 0,     -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_synced_at TIMESTAMPTZ
);

-- Custodian deposits (indexed from events - pooled on-chain)
CREATE TABLE custodian_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    wallet_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    block_time TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending'
);

-- Custodian withdrawals (protocol-controlled)
CREATE TABLE custodian_withdrawals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id),
    amount_usdc NUMERIC NOT NULL,           -- Validated against agent's current stake
    recipient_address TEXT NOT NULL,        -- Recipient wallet
    tx_signature TEXT UNIQUE,               -- Set when protocol authority executes
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    block_time TIMESTAMPTZ,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'completed')) DEFAULT 'pending',
    rejection_reason TEXT
);

-- Unallocated deposits (deposits without agent mapping)
CREATE TABLE unallocated_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_signature TEXT UNIQUE NOT NULL,
    depositor_address TEXT NOT NULL,
    amount_usdc NUMERIC NOT NULL,
    block_time TIMESTAMPTZ,
    indexed_at TIMESTAMPTZ DEFAULT NOW(),
    allocated BOOLEAN DEFAULT FALSE,
    notes TEXT
);
```

## Critical Design Decisions

1. **Pooled Model**: All deposits go into single pool, enabling profit redistribution beyond initial deposits.

2. **No On-Chain User Tracking**: Individual balances exist only in database, not on-chain.

3. **Protocol Authority Control**: Only backend can execute withdrawals, ensuring consistency with off-chain stake tracking.

4. **Zero-Sum Redistribution**: Pool naturally handles the zero-sum nature of the protocol - winners can withdraw losers' stakes.

## Implementation Notes

1. **Simplified from original design**: No more UserStake accounts or per-user tracking on-chain.

2. **Module structure**: Implementation is in `src/veritas_custodian/` with:
   - `state.rs` - VeritasCustodian struct, events, and constants
   - `instructions/initialize_custodian.rs`
   - `instructions/deposit.rs`
   - `instructions/withdraw.rs`
   - `instructions/update_protocol_authority.rs`
   - `instructions/update_owner.rs`
   - `instructions/toggle_emergency_pause.rs`

3. **Event indexing required**: Backend MUST index DepositEvent to track who deposited what.

4. **Security features added**:
   - Vault validation ensures correct USDC vault is used
   - Recipient verification prevents sending to wrong address or wrong mint
   - Emergency pause allows owner to halt withdrawals if needed
   - Only vault balance check needed (withdrawals CAN exceed deposits due to profits)