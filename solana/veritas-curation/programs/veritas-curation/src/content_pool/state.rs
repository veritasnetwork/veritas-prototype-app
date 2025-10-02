use anchor_lang::prelude::*;

#[account]
pub struct ContentPool {
    // Identification (32 bytes)
    pub post_id: [u8; 32],      // Hash identifier of content (unique key)

    // Bonding Curve Parameters (32 bytes)
    pub k_quadratic: u128,      // Quadratic coefficient (mutable via elastic-k)
    pub supply_cap: u128,       // Transition point (mutable via setter)
    // Note: k_linear is derived as k_quadratic × supply_cap (not stored)

    // Current State (32 bytes)
    pub token_supply: u128,     // Total tokens in circulation
    pub reserve: u128,          // Total USDC in pool (6 decimals)

    // Accounts (64 bytes)
    pub usdc_vault: Pubkey,     // Associated token account for USDC
    pub factory: Pubkey,        // Reference to PoolFactory (authority source of truth)

    // PDA (1 byte)
    pub bump: u8,               // PDA bump seed
}
// Total: 161 bytes + 8 discriminator = 169 bytes

#[account]
pub struct ProtocolConfig {
    // Authority (33 bytes)
    pub authority: Pubkey,              // 32 bytes
    pub bump: u8,                       // 1 byte

    // Default curve parameters (32 bytes)
    pub default_k_quadratic: u128,      // 16 bytes
    pub default_supply_cap: u128,       // 16 bytes

    // Validation bounds (64 bytes)
    pub min_k_quadratic: u128,          // 16 bytes
    pub max_k_quadratic: u128,          // 16 bytes
    pub min_supply_cap: u128,           // 16 bytes
    pub max_supply_cap: u128,           // 16 bytes

    // Trading limits (8 bytes)
    pub min_trade_amount: u64,          // 8 bytes

    // Reserved for future use (64 bytes)
    pub reserved: [u64; 8],             // 64 bytes
}
// Total: 185 bytes + 8 discriminator = 193 bytes
