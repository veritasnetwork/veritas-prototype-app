use anchor_lang::prelude::*;

/// Primary account structure for ContentPool
/// Total size: 432 bytes + 8 discriminator = 440 bytes
#[account]
#[derive(Debug)]
pub struct ContentPool {
    // Identity (96 bytes)
    /// Post/belief identifier (32 bytes)
    pub content_id: Pubkey,
    /// Pool creator (32 bytes)
    pub creator: Pubkey,
    /// First trader who deployed market (32 bytes)
    pub market_deployer: Pubkey,

    // Mints (64 bytes)
    /// SPL token mint for LONG side (32 bytes)
    pub long_mint: Pubkey,
    /// SPL token mint for SHORT side (32 bytes)
    pub short_mint: Pubkey,

    // Vaults (64 bytes)
    /// USDC vault for this pool (32 bytes)
    pub vault: Pubkey,
    /// Global stake vault (VeritasCustodian) (32 bytes)
    pub stake_vault: Pubkey,

    // ICBS Parameters (16 bytes)
    /// Growth exponent (default: 3)
    pub f: u16,
    /// β numerator (default: 1)
    pub beta_num: u16,
    /// β denominator (default: 2, so β = 0.5)
    pub beta_den: u16,
    /// Alignment padding
    pub _padding1: [u8; 10],

    // Token Supplies - Integer (16 bytes)
    /// LONG token supply (integer, 6 decimals)
    pub s_long: u64,
    /// SHORT token supply (integer, 6 decimals)
    pub s_short: u64,

    // Virtual Reserves - Integer (16 bytes) - ESSENTIAL FOR SETTLEMENT
    /// LONG virtual reserve (R_L = s_L × p_L)
    pub r_long: u64,
    /// SHORT virtual reserve (R_S = s_S × p_S)
    pub r_short: u64,

    // Square Root Prices - X96 (32 bytes)
    /// sqrt(price_long) * 2^96
    pub sqrt_price_long_x96: u128,
    /// sqrt(price_short) * 2^96
    pub sqrt_price_short_x96: u128,

    // Square Root Lambda Scale - X96 (32 bytes)
    /// sqrt(λ_L) * 2^96
    pub sqrt_lambda_long_x96: u128,
    /// sqrt(λ_S) * 2^96
    pub sqrt_lambda_short_x96: u128,

    // Settlement (40 bytes)
    /// Last settlement timestamp (8 bytes)
    pub last_settle_ts: i64,
    /// Cooldown between settlements (default: 300s)
    pub min_settle_interval: i64,
    /// Current epoch for this pool (independent per-pool epoch counter)
    pub current_epoch: u64,
    /// When belief expires - decay starts after this timestamp (8 bytes)
    pub expiration_timestamp: i64,
    /// Last time decay was applied on-chain (8 bytes)
    pub last_decay_update: i64,

    // Stats (16 bytes)
    /// Actual USDC in vault (for invariant checking)
    pub vault_balance: u64,
    /// Initial q set by deployer (Q32.32)
    pub initial_q: u64,

    // Factory Reference (32 bytes)
    /// PoolFactory that created this pool
    pub factory: Pubkey,

    // Bump (1 byte + 7 padding)
    /// PDA bump seed
    pub bump: u8,
    /// Alignment
    pub _padding2: [u8; 7],
}

impl ContentPool {
    pub const LEN: usize = 432;

    /// Seeds for PDA derivation
    pub fn seeds(&self) -> Vec<Vec<u8>> {
        vec![
            b"content_pool".to_vec(),
            self.content_id.to_bytes().to_vec(),
        ]
    }
}

/// Token side for trading
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum TokenSide {
    Long,
    Short,
}

/// Trade type
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq)]
pub enum TradeType {
    Buy,
    Sell,
}

// Constants
pub const MAX_SAFE_SUPPLY: u64 = 1_000_000_000_000;  // 1 trillion tokens (with 6 decimals)
pub const MIN_TRADE_SIZE: u64 = 1_000;               // 0.001 USDC
pub const MAX_TRADE_SIZE: u64 = 1_000_000_000_000;   // 1M USDC

// Initial Deposit Limits
pub const MIN_INITIAL_DEPOSIT: u64 = 100_000_000;  // 100 USDC (6 decimals)
pub const MAX_INITIAL_DEPOSIT: u64 = 10_000_000_000; // 10K USDC (6 decimals)

// Price Bounds (in micro-USDC per token)
pub const MIN_PRICE_MICRO: u64 = 1;                  // 0.000001 USDC/token
pub const MAX_PRICE_MICRO: u64 = 1_000_000_000_000;  // 1M USDC/token

// Settlement
pub const MIN_PREDICTION_BPS: u16 = 100;      // 1% in basis points
pub const MAX_PREDICTION_BPS: u16 = 9900;     // 99% in basis points
pub const MIN_SETTLE_INTERVAL: i64 = 300;     // 5 minutes

// Fixed-Point for X96 format
pub const Q96_ONE: u128 = 1 << 96;        // 1.0 in X96
pub const Q32_ONE: u64 = 1 << 32;         // 1.0 in Q32.32 (for BD scores)

// Q64.64 constants (for settlement logic)
pub const Q64_ONE: u128 = 1 << 64;
pub const Q64_MIN_PREDICTION: u128 = Q64_ONE / 100;      // 1%
pub const Q64_MAX_PREDICTION: u128 = Q64_ONE * 99 / 100; // 99%
pub const ROUNDING_TOLERANCE: u128 = 1000;

// Decimals
pub const USDC_DECIMALS: u8 = 6;
pub const TOKEN_DECIMALS: u8 = 6;  // Changed from 9 to match USDC

// Flat Rate (Market Deployment) - in micro-USDC
pub const FLAT_RATE: u64 = 1_000_000;  // 1 USDC per token initial price

// Default ICBS Parameters
pub const DEFAULT_F: u16 = 2;  // Growth exponent (changed from 3 to reduce slippage)
pub const DEFAULT_BETA_NUM: u16 = 1;
pub const DEFAULT_BETA_DEN: u16 = 2;  // β = 0.5

// Time-Based Decay Constants
// Decay rates are in basis points per day (10000 = 100%)
pub const DECAY_TIER_1_BPS: u64 = 100;     // 1% per day (days 0-7)
pub const DECAY_TIER_2_BPS: u64 = 200;     // 2% per day (days 7-30)
pub const DECAY_TIER_3_BPS: u64 = 300;     // 3% per day (days 30+)
pub const DECAY_MIN_Q_BPS: u64 = 1000;     // Minimum q after decay: 10% (don't let pools die completely)
pub const SECONDS_PER_DAY: i64 = 86400;    // 24 * 60 * 60
pub const BELIEF_DURATION_HOURS: u32 = 720; // 30 days (30 * 24)