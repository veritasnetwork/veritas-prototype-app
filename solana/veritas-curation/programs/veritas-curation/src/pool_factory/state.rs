use anchor_lang::prelude::*;

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