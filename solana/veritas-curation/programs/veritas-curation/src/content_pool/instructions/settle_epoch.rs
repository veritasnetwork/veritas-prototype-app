use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;
use crate::pool_factory::state::PoolFactory;
use crate::content_pool::{
    state::*,
    events::SettlementEvent,
    errors::ContentPoolError,
    math::{renormalize_scales, mul_div_u128, ceil_div},
    curve::{ICBSCurve, Q96},
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
        constraint = protocol_authority.key() == factory.protocol_authority @ ContentPoolError::UnauthorizedProtocol
    )]
    pub protocol_authority: Signer<'info>,

    pub settler: Signer<'info>,

    /// Vault token account (needed for λ derivation to update prices)
    #[account(
        constraint = vault.key() == pool.vault @ ContentPoolError::InvalidVault
    )]
    pub vault: Account<'info, TokenAccount>,
}

pub fn handler(
    ctx: Context<SettleEpoch>,
    bd_score: u32,  // BD score in millionths format [0, 1_000_000] where 500_000 = 50%
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

    // Calculate raw settlement factors
    // f_L = x / q
    let f_long_raw = ((bd_score as u128 * 1_000_000) / q_clamped as u128) as u64;

    // f_S = (1 - x) / (1 - q)
    let one_minus_x = 1_000_000u64.saturating_sub(bd_score as u64);
    let one_minus_q = 1_000_000u64.saturating_sub(q_clamped);
    let f_short_raw = ((one_minus_x as u128 * 1_000_000) / one_minus_q as u128) as u64;

    // Hard-cap factors to [0.01, 100] to prevent unbounded drift
    let f_long = f_long_raw.clamp(F_MIN, F_MAX);
    let f_short = f_short_raw.clamp(F_MIN, F_MAX);

    // Store old scales for event
    let scale_long_before = pool.s_scale_long_q64;
    let scale_short_before = pool.s_scale_short_q64;

    // Update scales (Q64 conversion)
    let f_long_q64 = ((f_long as u128) << 64) / 1_000_000;
    let f_short_q64 = ((f_short as u128) << 64) / 1_000_000;

    // --- SAFE σ UPDATE (avoid u128 overflow) ---
    // Use mul_div_u128 instead of direct multiplication to prevent overflow
    // when σ ≈ 2^96 and f ≈ 2^64. Floor rounding is fine; renormalize_scales will correct.
    pool.s_scale_long_q64 = mul_div_u128(pool.s_scale_long_q64, f_long_q64, Q64)?;
    pool.s_scale_short_q64 = mul_div_u128(pool.s_scale_short_q64, f_short_q64, Q64)?;

    // Renormalize scales to keep both sigma and virtual norm in safe range
    {
        let mut sigma_long = pool.s_scale_long_q64;
        let mut sigma_short = pool.s_scale_short_q64;
        let s_long = pool.s_long;
        let s_short = pool.s_short;
        renormalize_scales(
            &mut sigma_long,
            &mut sigma_short,
            s_long,
            s_short,
        );
        pool.s_scale_long_q64 = sigma_long;
        pool.s_scale_short_q64 = sigma_short;
    }

    // --- SAFE RESERVE UPDATE ---
    // Use mul_div_u128 to prevent overflow during reserve scaling
    pool.r_long = mul_div_u128(pool.r_long as u128, f_long as u128, 1_000_000u128)? as u64;
    pool.r_short = mul_div_u128(pool.r_short as u128, f_short as u128, 1_000_000u128)? as u64;

    // --- INVARIANT RECOUPLE: r_L + r_S == vault_balance ---
    // After scaling by capped factors, reserves may drift from vault due to clamping/rounding.
    // Proportionally adjust reserves to maintain the invariant.
    let total_after = (pool.r_long as u128)
        .checked_add(pool.r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    if total_after > 0 {
        let target = pool.vault_balance as u128;
        if total_after != target {
            // Proportional recouple: scale both reserves to sum to vault_balance
            let r_long_new = mul_div_u128(pool.r_long as u128, target, total_after)?;
            pool.r_long = r_long_new as u64;
            pool.r_short = (target.saturating_sub(r_long_new)) as u64;
        }
    }

    // DO NOT UPDATE vault_balance, s_long, s_short here!
    //
    // NOTE ON λ ARCHITECTURE:
    // λ is NOT stored in pool state. It's derived from (vault, σ, s_v) via the invariant:
    // vault_balance = λ × ||ŝ_v|| where ŝ_v = s_display / σ
    //
    // This means λ automatically adjusts after settlements to maintain the invariant.
    // The old sqrt_lambda_* fields are deprecated but kept for backward compatibility.

    // --- PRICE RECOMPUTATION (recommended for UX) ---
    // Settlement changed σ, which affects virtual supplies and thus display prices.
    // Recompute prices now to keep UI consistent until the next trade.

    // Compute virtual supplies with ceiling division (same as derive_lambda)
    let s_long_v = if pool.s_long > 0 {
        ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1) as u64
    } else {
        0
    };

    let s_short_v = if pool.s_short > 0 {
        ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1) as u64
    } else {
        0
    };

    // Derive λ with current σ (vault unchanged)
    let lambda_q96 = derive_lambda(&ctx.accounts.vault, &pool)?;

    // Store display-token sqrt prices (consistent with trade.rs)
    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
        s_long_v,
        s_short_v,
        TokenSide::Long,
        lambda_q96,
        pool.s_scale_long_q64,
        pool.s_scale_short_q64,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
        s_long_v,
        s_short_v,
        TokenSide::Short,
        lambda_q96,
        pool.s_scale_long_q64,
        pool.s_scale_short_q64,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    // Update last settlement timestamp and increment pool epoch
    pool.last_settle_ts = clock.unix_timestamp;
    pool.current_epoch = pool.current_epoch.checked_add(1).ok_or(ContentPoolError::NumericalOverflow)?;

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
        s_scale_long_before: scale_long_before,
        s_scale_long_after: pool.s_scale_long_q64,
        s_scale_short_before: scale_short_before,
        s_scale_short_after: pool.s_scale_short_q64,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

// Helper functions

/// Integer square root for u128 (floor)
fn isqrt_u128(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Derive λ from current pool state (vault, σ, s_v)
///
/// λ is NOT stored; it's derived fresh each time from the invariant:
/// vault_balance = λ × ||ŝ_v||
///
/// This ensures λ automatically adjusts to keep the invariant after trades/settlements.
fn derive_lambda(vault: &Account<TokenAccount>, pool: &ContentPool) -> Result<u128> {
    // 1. Compute virtual supplies with CEILING division to prevent zero
    let s_long_virtual = if pool.s_long > 0 {
        ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1)
    } else {
        0
    };

    let s_short_virtual = if pool.s_short > 0 {
        ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1)
    } else {
        0
    };

    // 2. CRITICAL: Virtual supplies must fit u64 for curve
    require!(
        s_long_virtual <= u64::MAX as u128,
        ContentPoolError::VirtualSupplyOverflow
    );
    require!(
        s_short_virtual <= u64::MAX as u128,
        ContentPoolError::VirtualSupplyOverflow
    );

    // 3. Compute norm: ||ŝ|| = sqrt(ŝ_L² + ŝ_S²)
    let norm_sq = s_long_virtual
        .checked_mul(s_long_virtual)
        .and_then(|v| v.checked_add(s_short_virtual.checked_mul(s_short_virtual)?))
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let norm = isqrt_u128(norm_sq).max(1); // min 1 to avoid div-by-zero

    // 4. Derive λ using DIVISION-FIRST to avoid overflow
    // Instead of: lambda_q96 = (vault * Q96) / norm  (can overflow at multiply)
    // We do: lambda_q96 = (vault / norm) * Q96 + (vault % norm * Q96) / norm
    let vault_balance = vault.amount;
    let a = vault_balance as u128;
    let d = norm;
    let q = a / d;
    let r = a % d;

    let term1 = q.checked_mul(Q96)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let term2_num = r.checked_mul(Q96)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let term2 = term2_num / d;

    let lambda_q96 = term1.checked_add(term2)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    Ok(lambda_q96)
}