//! View-only instruction: Returns current pool state
//!
//! Does NOT mutate on-chain state - purely for reading current values.
//! Used by: UI display, feed ranking, analytics

use anchor_lang::prelude::*;
use crate::content_pool::state::{ContentPool, Q32_ONE};
use crate::content_pool::errors::ContentPoolError;

#[derive(Accounts)]
pub struct GetCurrentState<'info> {
    /// CHECK: Read-only account, no validation needed
    pub pool: Account<'info, ContentPool>,
}

pub fn handler(ctx: Context<GetCurrentState>) -> Result<CurrentPoolState> {
    let pool = &ctx.accounts.pool;
    let current_time = Clock::get()?.unix_timestamp;

    // Use actual reserves (no decay calculation)
    let r_long = pool.r_long;
    let r_short = pool.r_short;

    // Calculate total reserves
    let total = (r_long as u128)
        .checked_add(r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Calculate relevance score (q value)
    let q = if total > 0 {
        let q_u128 = (r_long as u128)
            .checked_mul(Q32_ONE as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(total)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        q_u128 as u64
    } else {
        Q32_ONE / 2 // Default to 0.5 if pool is empty
    };

    // Calculate human-readable prices (micro-USDC per token)
    // price = reserve / supply
    let price_long = if pool.s_long > 0 {
        let price_u128 = (r_long as u128)
            .checked_mul(1_000_000) // Convert to micro-USDC
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(pool.s_long as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        price_u128 as u64
    } else {
        1_000_000 // 1.0 USDC default
    };

    let price_short = if pool.s_short > 0 {
        let price_u128 = (r_short as u128)
            .checked_mul(1_000_000)
            .ok_or(ContentPoolError::NumericalOverflow)?
            .checked_div(pool.s_short as u128)
            .ok_or(ContentPoolError::NumericalOverflow)?;
        price_u128 as u64
    } else {
        1_000_000 // 1.0 USDC default
    };

    // Decay fields unused (kept for backward compatibility)
    let days_expired = 0;
    let days_since_last_update = 0;
    let decay_pending = false;

    Ok(CurrentPoolState {
        r_long,
        r_short,
        q,
        price_long,
        price_short,
        s_long: pool.s_long,
        s_short: pool.s_short,
        sqrt_price_long_x96: pool.sqrt_price_long_x96,
        sqrt_price_short_x96: pool.sqrt_price_short_x96,
        days_expired,
        days_since_last_update,
        decay_pending,
        expiration_timestamp: pool.expiration_timestamp,
        last_decay_update: pool.last_decay_update,
    })
}

/// Return type for get_current_state view function
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct CurrentPoolState {
    /// Decayed LONG reserves (micro-USDC)
    pub r_long: u64,
    /// Decayed SHORT reserves (micro-USDC)
    pub r_short: u64,
    /// Relevance score in Q32 format (use q / Q32_ONE to get 0.0-1.0 value)
    pub q: u64,
    /// LONG price in micro-USDC per token
    pub price_long: u64,
    /// SHORT price in micro-USDC per token
    pub price_short: u64,
    /// LONG supply (unchanged by decay)
    pub s_long: u64,
    /// SHORT supply (unchanged by decay)
    pub s_short: u64,
    /// Square root of LONG price in X96 format
    pub sqrt_price_long_x96: u128,
    /// Square root of SHORT price in X96 format
    pub sqrt_price_short_x96: u128,
    /// Days since expiration (0 if not expired)
    pub days_expired: i64,
    /// Days since last on-chain decay update
    pub days_since_last_update: i64,
    /// True if decay will be applied on next trade
    pub decay_pending: bool,
    /// Timestamp when decay starts
    pub expiration_timestamp: i64,
    /// Timestamp of last on-chain decay execution
    pub last_decay_update: i64,
}
