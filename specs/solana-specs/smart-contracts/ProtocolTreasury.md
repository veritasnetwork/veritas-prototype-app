# ProtocolTreasury Smart Contract

Zero-sum intermediary for epoch settlements. Collects penalties from declining pools and redistributes to rising pools via ContentPool elastic-k operations.

## Core Mechanism

### Two-Phase Epoch Settlement
Treasury acts as clearing house for parimutuel redistribution:

**Phase 1: Penalty Collection**
- Pools with Δr < 0: Pay penalties scaled by |Δr| × uncertainty
- Pools with Δr = 0: Pay base skim rate
- Treasury accumulates total penalty pot

**Phase 2: Reward Distribution**
- Treasury distributes to pools with Δr > 0
- Proportional to normalized Δr values
- Treasury balance returns to zero

### Zero-Sum Property
$$\sum \text{penalties} = \sum \text{rewards}$$

## Purpose
Ensures fair redistribution without creating or destroying value. All operations are authority-controlled and auditable.

---

# ProtocolTreasury Implementation

**Program:** `veritas-curation`
**Module:** `protocol_treasury`
**Singleton:** Yes (treasury PDA)

## Account Structure

```rust
#[account]
pub struct ProtocolTreasury {
    pub authority: Pubkey,      // Protocol authority (32 bytes)
    pub usdc_vault: Pubkey,     // USDC vault address (32 bytes)
    pub bump: u8,               // PDA bump seed (1 byte)
}
// Total: 65 bytes + 8 discriminator = 73 bytes
```

## Instructions

### 1. Initialize Treasury

Creates singleton treasury PDA with USDC vault.

**Validation:**
```rust
// Validate authority
require!(authority.key() != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(authority.key() != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Initialization:**
```rust
treasury.authority = authority.key();
treasury.usdc_vault = usdc_vault.key();
treasury.bump = bump;
```

**Context:**
```rust
#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 65,
        seeds = [b"treasury"],
        bump
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = treasury,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    pub usdc_mint: Account<'info, Mint>,
    pub authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
```

---

### 2. Update Authority

Updates treasury authority for management.

**Validation:**
```rust
require!(authority.key() == treasury.authority, ErrorCode::Unauthorized);
require!(new_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
require!(new_authority != system_program::ID, ErrorCode::InvalidAuthority);
```

**State Update:**
```rust
let old_authority = treasury.authority;
treasury.authority = new_authority;
msg!("Treasury authority updated: old={}, new={}", old_authority, new_authority);
```

**Context:**
```rust
#[derive(Accounts)]
pub struct UpdateAuthority<'info> {
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    pub authority: Signer<'info>,
}
```

---

## Integration with ContentPool

Treasury doesn't have its own transfer instructions. Instead:

### Phase 1: Penalties (ContentPool → Treasury)
```rust
// In ContentPool::apply_pool_penalty
Transfer {
    from: pool_usdc_vault,
    to: treasury_usdc_vault,  // Treasury receives
    authority: pool (PDA)
}
```

### Phase 2: Rewards (Treasury → ContentPool)
```rust
// In ContentPool::apply_pool_reward
Transfer {
    from: treasury_usdc_vault,  // Treasury sends
    to: pool_usdc_vault,
    authority: treasury (PDA)
}

// Note: Backend must handle rounding dust
// If total_rewards < total_penalties due to rounding,
// the dust remains in treasury for next epoch
```

## Transaction Flow

```
Epoch Settlement:
┌─────────────────────────────────────┐
│ Phase 1: Collect Penalties          │
├─────────────────────────────────────┤
│ Pool A (Δr=-0.5) → Treasury: $500  │
│ Pool B (Δr=-0.3) → Treasury: $300  │
│ Pool C (Δr=0.0)  → Treasury: $100  │
├─────────────────────────────────────┤
│ Treasury Balance: $900              │
└─────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────┐
│ Phase 2: Distribute Rewards         │
├─────────────────────────────────────┤
│ Treasury → Pool D (Δr=+0.7): $630  │
│ Treasury → Pool E (Δr=+0.3): $270  │
├─────────────────────────────────────┤
│ Treasury Balance: $0                │
└─────────────────────────────────────┘
```

## Error Codes

```rust
#[error_code]
pub enum TreasuryError {
    #[msg("Treasury already initialized")]
    AlreadyInitialized,

    #[msg("Insufficient treasury balance")]
    InsufficientBalance,

    #[msg("Invalid authority address")]
    InvalidAuthority,

    #[msg("Unauthorized")]
    Unauthorized,
}
```

## Constants

```rust
// Seeds
pub const TREASURY_SEED: &[u8] = b"treasury";

// No balance requirements - expected to zero out each epoch
```

## Security Notes

- **Authority Control:** Only protocol backend can trigger settlements
- **PDA Signing:** Treasury signs its own transfers via PDA
- **Atomic Settlement:** Penalties collected before rewards distributed
- **Audit Trail:** All transfers on-chain and verifiable

## Implementation Notes

1. **Struct definition**: The `ProtocolTreasury` struct must be defined in `src/protocol_treasury/state.rs`, not just imported from content_pool. This was initially missed.

2. **Module structure**: Implementation is in `src/protocol_treasury/` with:
   - `state.rs` - ProtocolTreasury struct and constants
   - `instructions/initialize_treasury.rs`
   - `instructions/update_authority.rs`

3. **Cross-module imports**: Other modules (like ContentPool) can import via `crate::protocol_treasury::state::ProtocolTreasury`.

4. **Update authority**: The spec should include an `update_authority` instruction for treasury management (similar to other contracts).