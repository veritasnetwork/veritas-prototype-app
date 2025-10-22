//! Time-based decay implementation for ContentPool
//!
//! Decay reduces pool reserves after expiration, naturally lowering relevance scores
//! of old content. Uses settlement-style reserve scaling to maintain market invariants.

use anchor_lang::prelude::*;
use super::state::{ContentPool, TokenSide, Q32_ONE, DECAY_TIER_1_BPS, DECAY_TIER_2_BPS, DECAY_TIER_3_BPS, DECAY_MIN_Q_BPS, SECONDS_PER_DAY};
use super::errors::ContentPoolError;
use super::curve::ICBSCurve;

/// Calculate decayed reserves based on elapsed time since expiration
///
/// Returns (r_long_decayed, r_short_decayed)
///
/// Formula:
///   1. Calculate current q = R_L / (R_L + R_S)
///   2. Calculate days expired since expiration_timestamp
///   3. Determine decay rate tier based on days expired
///   4. Calculate target q: x_decay = max(0.1, q - (days × decay_rate))
///   5. Calculate scaling factors: f_L = x_decay / q, f_S = (1 - x_decay) / (1 - q)
///   6. Apply scaling: R_L' = R_L × f_L, R_S' = R_S × f_S
pub fn calculate_decayed_reserves(
    pool: &ContentPool,
    current_timestamp: i64
) -> Result<(u64, u64)> {
    // No decay before expiration
    if current_timestamp <= pool.expiration_timestamp {
        return Ok((pool.r_long, pool.r_short));
    }

    // Calculate days since expiration (truncated to integer days)
    let seconds_expired = current_timestamp
        .checked_sub(pool.expiration_timestamp)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let days_expired = seconds_expired / SECONDS_PER_DAY;

    // No decay if less than 1 day has passed
    if days_expired == 0 {
        return Ok((pool.r_long, pool.r_short));
    }

    // Calculate current q (relevance score)
    let total_reserves = (pool.r_long as u128)
        .checked_add(pool.r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Handle edge case: empty pool
    if total_reserves == 0 {
        return Ok((0, 0));
    }

    // q in Q32 format
    let q_u128 = (pool.r_long as u128)
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(total_reserves)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let q = q_u128 as u64;

    // Determine decay rate based on tier
    // Tier 1: days 0-6 (i.e., days_expired < 7) = 1% per day
    // Tier 2: days 7-29 (i.e., days_expired < 30) = 2% per day
    // Tier 3: days 30+ = 3% per day
    let decay_rate_bps: u64 = if days_expired < 7 {
        DECAY_TIER_1_BPS
    } else if days_expired < 30 {
        DECAY_TIER_2_BPS
    } else {
        DECAY_TIER_3_BPS
    };

    // Calculate x_decay (target q after decay) in basis points
    // q_bps = q * 10000 / Q32_ONE (convert Q32 to basis points)
    let q_bps = (q as u128)
        .checked_mul(10000)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // total_decay_bps = days_expired * decay_rate_bps
    let total_decay_bps = (days_expired as u128)
        .checked_mul(decay_rate_bps as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // x_decay_bps = max(DECAY_MIN_Q_BPS, q_bps - total_decay_bps)
    let x_decay_bps = q_bps
        .saturating_sub(total_decay_bps)
        .max(DECAY_MIN_Q_BPS as u128);

    // Convert x_decay back to Q32 format
    let x_decay = (x_decay_bps
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(10000)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    // Calculate scaling factors (settlement-style)
    // f_L = x_decay / q (both in Q32)
    // f_S = (Q32_ONE - x_decay) / (Q32_ONE - q)

    let f_long = (x_decay as u128)
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(q as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let numerator_short = (Q32_ONE as u128)
        .checked_sub(x_decay as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_mul(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let denominator_short = (Q32_ONE as u128)
        .checked_sub(q as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let f_short = numerator_short
        .checked_div(denominator_short)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // Apply scaling to reserves
    let r_long_decayed = ((pool.r_long as u128)
        .checked_mul(f_long)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    let r_short_decayed = ((pool.r_short as u128)
        .checked_mul(f_short)
        .ok_or(ContentPoolError::NumericalOverflow)?
        .checked_div(Q32_ONE as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?) as u64;

    Ok((r_long_decayed, r_short_decayed))
}

/// Apply decay to pool state (mutates reserves and prices)
///
/// Only applies if:
/// - Current time > expiration_timestamp
/// - At least 1 day has passed since last_decay_update
///
/// Updates:
/// - pool.r_long
/// - pool.r_short
/// - pool.sqrt_price_long_x96
/// - pool.sqrt_price_short_x96
/// - pool.last_decay_update
///
/// Emits: DecayAppliedEvent
pub fn apply_decay_if_needed(pool: &mut ContentPool, pool_key: Pubkey, current_timestamp: i64) -> Result<bool> {
    // Check if at least 1 day has passed since last update
    let days_since_update = (current_timestamp
        .checked_sub(pool.last_decay_update)
        .ok_or(ContentPoolError::NumericalOverflow)?) / SECONDS_PER_DAY;

    if days_since_update < 1 {
        return Ok(false); // No decay applied
    }

    // Store old values for event
    let r_long_before = pool.r_long;
    let r_short_before = pool.r_short;

    // Calculate decayed reserves
    let (r_long_decayed, r_short_decayed) = calculate_decayed_reserves(pool, current_timestamp)?;

    // Apply to pool state
    pool.r_long = r_long_decayed;
    pool.r_short = r_short_decayed;
    pool.last_decay_update = current_timestamp;

    // Recalculate sqrt prices from new reserves
    // Note: We don't change lambda or supplies, only reserves
    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price(
        pool.s_long,
        pool.s_short,
        TokenSide::Long,
        pool.sqrt_lambda_long_x96,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price(
        pool.s_long,
        pool.s_short,
        TokenSide::Short,
        pool.sqrt_lambda_short_x96,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    // Emit event
    emit!(DecayAppliedEvent {
        pool: pool_key,
        days_applied: days_since_update,
        r_long_before,
        r_short_before,
        r_long_after: r_long_decayed,
        r_short_after: r_short_decayed,
        timestamp: current_timestamp,
    });

    Ok(true) // Decay was applied
}

/// Event emitted when decay is applied on-chain
#[event]
pub struct DecayAppliedEvent {
    pub pool: Pubkey,
    pub days_applied: i64,
    pub r_long_before: u64,
    pub r_short_before: u64,
    pub r_long_after: u64,
    pub r_short_after: u64,
    pub timestamp: i64,
}
