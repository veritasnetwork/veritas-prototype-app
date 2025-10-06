use anchor_lang::prelude::*;

#[account]
pub struct ContentPool {
    // Identification (32 bytes)
    pub post_id: [u8; 32],      // Hash identifier of content (unique key)

    // Bonding Curve Parameters (64 bytes)
    pub k_quadratic: u128,      // Quadratic coefficient (mutable via elastic-k)
    pub reserve_cap: u128,      // Reserve amount at linear transition (e.g. $5K USDC)
    pub linear_slope: u128,     // Slope in linear region (dampened by L/(L+s))
    pub virtual_liquidity: u128, // Virtual liquidity L for dampening factor

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
// Total: 268 bytes + 8 discriminator = 276 bytes

#[account]
pub struct ProtocolConfig {
    // Authority (33 bytes)
    pub authority: Pubkey,              // 32 bytes
    pub bump: u8,                       // 1 byte

    // Default curve parameters (64 bytes)
    pub default_k_quadratic: u128,      // 16 bytes
    pub default_reserve_cap: u128,      // 16 bytes - e.g. $5K USDC
    pub default_linear_slope: u128,     // 16 bytes - slope in linear region
    pub default_virtual_liquidity: u128, // 16 bytes - dampening parameter

    // Validation bounds (96 bytes)
    pub min_k_quadratic: u128,          // 16 bytes
    pub max_k_quadratic: u128,          // 16 bytes
    pub min_reserve_cap: u128,          // 16 bytes - e.g. $1K minimum
    pub max_reserve_cap: u128,          // 16 bytes - e.g. $1M maximum
    pub min_linear_slope: u128,         // 16 bytes
    pub max_linear_slope: u128,         // 16 bytes

    // Trading limits (8 bytes)
    pub min_trade_amount: u64,          // 8 bytes

    // Reserved for future use (32 bytes)
    pub reserved: [u64; 4],             // 32 bytes - reduced to make room
}
// Total: 233 bytes + 8 discriminator = 241 bytes
