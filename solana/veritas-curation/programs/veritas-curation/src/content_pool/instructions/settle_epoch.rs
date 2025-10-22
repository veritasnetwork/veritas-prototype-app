use anchor_lang::prelude::*;
use crate::pool_factory::state::PoolFactory;
use crate::content_pool::{
    state::*,
    events::SettlementEvent,
    errors::ContentPoolError,
    curve::ICBSCurve,
};

#[derive(Accounts)]
pub struct SettleEpoch<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        constraint = factory.key() == pool.factory @ ContentPoolError::InvalidFactory
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        constraint = protocol_authority.key() == factory.pool_authority @ ContentPoolError::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    pub settler: Signer<'info>,
}

pub fn handler(
    ctx: Context<SettleEpoch>,
    bd_score: u32,  // BD score in Q32.32 format [0, 2^32]
) -> Result<()> {
    let pool = &mut ctx.accounts.pool;
    let clock = Clock::get()?;

    // Check settlement cooldown
    if pool.last_settle_ts > 0 {
        let elapsed = clock.unix_timestamp - pool.last_settle_ts;
        require!(
            elapsed >= pool.min_settle_interval,
            ContentPoolError::SettlementCooldown
        );
    }

    // Validate BD score (0 to 1 million = 0% to 100%)
    require!(
        bd_score <= 1_000_000,
        ContentPoolError::InvalidBDScore
    );

    // Store old reserves for settlement
    let r_long_before = pool.r_long;
    let r_short_before = pool.r_short;

    // Calculate current market prediction q from stored reserves
    // q = R_L / (R_L + R_S)
    let total_reserves = (pool.r_long as u128)
        .checked_add(pool.r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    let q = if total_reserves == 0 {
        500_000 // Default to 50% if no reserves
    } else {
        ((pool.r_long as u128 * 1_000_000) / total_reserves) as u64
    };

    // Clamp q to prevent division issues (1000 = 0.1%, 999000 = 99.9%)
    let q_clamped = if q < 1000 {
        1000
    } else if q > 999_000 {
        999_000
    } else {
        q
    };

    // Calculate settlement factors
    // f_L = x / q
    let f_long = ((bd_score as u128 * 1_000_000) / q_clamped as u128) as u64;

    // f_S = (1 - x) / (1 - q)
    let one_minus_x = 1_000_000u64.saturating_sub(bd_score as u64);
    let one_minus_q = 1_000_000u64.saturating_sub(q_clamped);
    let f_short = ((one_minus_x as u128 * 1_000_000) / one_minus_q as u128) as u64;

    // Apply settlement factors to reserves (THE KEY ICBS MECHANISM!)
    // R_L' = R_L × f_L
    // R_S' = R_S × f_S
    pool.r_long = ((pool.r_long as u128 * f_long as u128) / 1_000_000) as u64;
    pool.r_short = ((pool.r_short as u128 * f_short as u128) / 1_000_000) as u64;

    // Update sqrt lambda to reflect the reserve changes
    // Since R = s × p and s is unchanged, we need to adjust lambda (price scaling)
    // New lambda = old lambda × f
    let sqrt_f_long_x96 = integer_sqrt((f_long as u128 * Q96_ONE * Q96_ONE) / 1_000_000)?;
    let sqrt_f_short_x96 = integer_sqrt((f_short as u128 * Q96_ONE * Q96_ONE) / 1_000_000)?;

    pool.sqrt_lambda_long_x96 = mul_x96(pool.sqrt_lambda_long_x96, sqrt_f_long_x96)?;
    pool.sqrt_lambda_short_x96 = mul_x96(pool.sqrt_lambda_short_x96, sqrt_f_short_x96)?;

    // Update last settlement timestamp and increment pool epoch
    pool.last_settle_ts = clock.unix_timestamp;
    pool.current_epoch = pool.current_epoch.checked_add(1).ok_or(ContentPoolError::NumericalOverflow)?;

    // Recalculate prices after lambda update
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
    emit!(SettlementEvent {
        pool: pool.key(),
        settler: ctx.accounts.settler.key(),
        epoch: pool.current_epoch,
        bd_score,
        market_prediction_q: q as u128,
        f_long: f_long as u128,
        f_short: f_short as u128,
        r_long_before: r_long_before as u128,
        r_short_before: r_short_before as u128,
        r_long_after: pool.r_long as u128,
        r_short_after: pool.r_short as u128,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// Helper functions
fn integer_sqrt(n: u128) -> Result<u128> {
    if n == 0 {
        return Ok(0);
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    Ok(x)
}

fn mul_x96(a: u128, b: u128) -> Result<u128> {
    let product = (a as u128)
        .checked_mul(b as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    Ok(product / Q96_ONE)
}