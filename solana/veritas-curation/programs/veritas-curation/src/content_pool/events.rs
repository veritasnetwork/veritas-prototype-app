use anchor_lang::prelude::*;
use super::state::{TokenSide, TradeType};

#[event]
pub struct LiquidityAdded {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub usdc_amount: u64,
    pub long_tokens_out: u64,
    pub short_tokens_out: u64,
    pub new_r_long: u64,
    pub new_r_short: u64,
    pub new_s_long: u64,
    pub new_s_short: u64,
}

#[event]
pub struct PoolInitializedEvent {
    pub pool: Pubkey,
    pub content_id: Pubkey,
    pub creator: Pubkey,
    pub f: u16,
    pub beta_num: u16,
    pub beta_den: u16,
    pub timestamp: i64,
}

#[event]
pub struct MarketDeployedEvent {
    pub pool: Pubkey,
    pub deployer: Pubkey,
    pub initial_deposit: u64,
    pub long_allocation: u64,
    pub short_allocation: u64,
    pub initial_q: u64,             // Q32.32
    pub long_tokens: u64,
    pub short_tokens: u64,
    pub timestamp: i64,
}

#[event]
pub struct TradeEvent {
    pub pool: Pubkey,
    pub trader: Pubkey,
    pub side: TokenSide,
    pub trade_type: TradeType,

    // Trade amounts
    pub usdc_amount: u64,           // Total USDC (including skim)
    pub usdc_to_trade: u64,         // After skim
    pub usdc_to_stake: u64,         // Skim amount
    pub tokens_traded: u64,         // Tokens bought or sold

    // ICBS State Snapshots (BEFORE trade)
    pub s_long_before: u64,
    pub s_short_before: u64,
    pub sqrt_price_long_x96_before: u128,
    pub sqrt_price_short_x96_before: u128,

    // ICBS State Snapshots (AFTER trade)
    pub s_long_after: u64,
    pub s_short_after: u64,
    pub sqrt_price_long_x96_after: u128,
    pub sqrt_price_short_x96_after: u128,

    // Virtual reserves (AFTER trade)
    pub r_long_after: u64,
    pub r_short_after: u64,
    pub vault_balance_after: u64,

    pub timestamp: i64,
}

#[event]
pub struct SettlementEvent {
    pub pool: Pubkey,
    pub settler: Pubkey,
    pub epoch: u64,                 // Pool's current epoch after settlement
    pub bd_score: u32,              // Millionths format [0, 1_000_000]
    pub market_prediction_q: u128,  // Q64.64
    pub f_long: u128,               // Q64.64
    pub f_short: u128,              // Q64.64
    pub r_long_before: u128,
    pub r_short_before: u128,
    pub r_long_after: u128,
    pub r_short_after: u128,
    pub timestamp: i64,
}

#[event]
pub struct PoolClosedEvent {
    pub pool: Pubkey,
    pub creator: Pubkey,
    pub remaining_usdc: u64,
    pub timestamp: i64,
}