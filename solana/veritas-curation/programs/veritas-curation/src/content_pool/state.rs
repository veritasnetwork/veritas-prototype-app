use anchor_lang::prelude::*;

#[account]
pub struct ContentPool {
    // Identification (32 bytes)
    pub post_id: [u8; 32],      // Hash identifier of content (unique key)

    // Bonding Curve Parameters (16 bytes)
    pub k_quadratic: u128,      // Quadratic coefficient (mutable via elastic-k)

    // Current State (32 bytes)
    pub token_supply: u128,     // Total SPL tokens minted
    pub reserve: u128,          // Total USDC in pool (6 decimals)

    // Token Information (75 bytes)
    pub token_mint: Pubkey,     // SPL token mint address (32 bytes)
    pub token_name: [u8; 32],   // Token name (32 bytes)
    pub token_symbol: [u8; 10], // Token symbol (10 bytes)
    pub token_decimals: u8,     // Token decimals - always 6 (1 byte)

    // Accounts (64 bytes)
    pub usdc_vault: Pubkey,     // Associated token account for USDC
    pub factory: Pubkey,        // Reference to PoolFactory (authority source of truth)

    // PDA (1 byte)
    pub bump: u8,               // PDA bump seed
}
// Total: 220 bytes + 8 discriminator = 228 bytes

#[account]
pub struct ProtocolConfig {
    // Authority (33 bytes)
    pub authority: Pubkey,              // 32 bytes
    pub bump: u8,                       // 1 byte

    // Default curve parameters (16 bytes)
    pub default_k_quadratic: u128,      // 16 bytes

    // Validation bounds (32 bytes)
    pub min_k_quadratic: u128,          // 16 bytes
    pub max_k_quadratic: u128,          // 16 bytes

    // Trading limits (8 bytes)
    pub min_trade_amount: u64,          // 8 bytes

    // Reserved for future use (16 bytes)
    pub reserved: [u64; 2],             // 16 bytes
}
// Total: 105 bytes + 8 discriminator = 113 bytes
