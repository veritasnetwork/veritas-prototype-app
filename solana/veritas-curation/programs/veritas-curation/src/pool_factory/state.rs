use anchor_lang::prelude::*;

#[account]
pub struct PoolFactory {
    // Authority (64 bytes)
    pub factory_authority: Pubkey,    // Can update both authorities (32 bytes)
    pub pool_authority: Pubkey,       // Authority for pool operations (32 bytes)

    // Stats (8 bytes)
    pub total_pools: u64,             // Total pools created (8 bytes)

    // Default ICBS Parameters (14 bytes)
    pub default_f: u16,               // Default growth exponent (2 bytes)
    pub default_beta_num: u16,        // Default β numerator (2 bytes)
    pub default_beta_den: u16,        // Default β denominator (2 bytes)
    pub default_p0: u64,              // Default initial price in lamports (8 bytes)

    // Limits (16 bytes)
    pub min_initial_deposit: u64,     // Minimum deployment amount (8 bytes)
    pub min_settle_interval: i64,     // Default settlement cooldown (8 bytes)

    // Custodian Reference (32 bytes)
    pub custodian: Pubkey,            // VeritasCustodian address (32 bytes)

    // PDA (1 byte)
    pub bump: u8,                     // PDA bump seed (1 byte)
}

impl PoolFactory {
    pub const LEN: usize = 32 + 32 + 8 + 2 + 2 + 2 + 8 + 8 + 8 + 32 + 1; // 135 bytes
}

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

impl PoolRegistry {
    pub const LEN: usize = 32 + 32 + 32 + 8 + 1; // 105 bytes
}

// Seeds
pub const FACTORY_SEED: &[u8] = b"factory";
pub const REGISTRY_SEED: &[u8] = b"registry";

// Default ICBS Parameters
pub const DEFAULT_F: u16 = 1;  // Reduced from 3 to avoid numerical overflow
pub const DEFAULT_BETA_NUM: u16 = 1;
pub const DEFAULT_BETA_DEN: u16 = 2;  // β = 0.5
pub const DEFAULT_P0: u64 = 1_000_000;  // 1.0 USDC per token (in micro-USDC, 6 decimals)

// Default Limits
pub const DEFAULT_MIN_INITIAL_DEPOSIT: u64 = 50_000_000;  // 50 USDC
pub const DEFAULT_MIN_SETTLE_INTERVAL: i64 = 7200;         // 2 hours (increased from 5 minutes)

// Validation Bounds
pub const MIN_F: u16 = 1;
pub const MAX_F: u16 = 10;
pub const MIN_BETA: f64 = 0.1;
pub const MAX_BETA: f64 = 0.9;