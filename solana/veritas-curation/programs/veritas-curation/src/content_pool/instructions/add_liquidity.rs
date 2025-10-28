use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, MintTo};

use crate::content_pool::state::*;
use crate::content_pool::errors::ContentPoolError;
use crate::content_pool::events::LiquidityAdded;
use crate::content_pool::curve::{ICBSCurve, SUPPLY_SCALE, integer_sqrt};
// Safe math helpers
use crate::content_pool::math::{div_256_by_128, mul_div_u128, ceil_div, renormalize_scales};

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"content_pool", pool.content_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        mut,
        seeds = [b"long_mint", pool.content_id.as_ref()],
        bump
    )]
    pub long_token_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        seeds = [b"short_mint", pool.content_id.as_ref()],
        bump
    )]
    pub short_token_mint: Account<'info, token::Mint>,

    #[account(
        mut,
        seeds = [b"vault", pool.content_id.as_ref()],
        bump
    )]
    pub pool_reserve: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_long_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_short_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<AddLiquidity>, usdc_amount: u64) -> Result<()> {
    let pool = &mut ctx.accounts.pool;

    // Basic sanity
    require!(usdc_amount > 0, ContentPoolError::InvalidTradeAmount);

    // Ensure market is deployed
    require!(
        pool.market_deployer != Pubkey::default(),
        ContentPoolError::MarketNotDeployed
    );

    // 1) Ensure sigma is valid for the *current* supplies
    {
        let mut sigma_l = pool.s_scale_long_q64;
        let mut sigma_s = pool.s_scale_short_q64;
        renormalize_scales(&mut sigma_l, &mut sigma_s, pool.s_long, pool.s_short);
        pool.s_scale_long_q64 = sigma_l;
        pool.s_scale_short_q64 = sigma_s;
    }

    // 2) Compute virtual supplies (ceil to avoid zero)
    let s_long_v = if pool.s_long > 0 {
        ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1)
    } else {
        0
    };
    let s_short_v = if pool.s_short > 0 {
        ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1)
    } else {
        0
    };

    // Current market prediction q = R_L / (R_L + R_S)
    let total_reserves = (pool.r_long as u128)
        .checked_add(pool.r_short as u128)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    require!(total_reserves > 0, ContentPoolError::NoLiquidity);

    // Split USDC by current reserve ratio to avoid moving price:
    // Long gets q * amount, Short gets (1-q) * amount
    // We compute q in 1e6 micro-units to keep integer math tight.
    let q_micro = ((pool.r_long as u128) * 1_000_000)
        .checked_div(total_reserves)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    let long_usdc = ((usdc_amount as u128) * q_micro / 1_000_000) as u64;
    let short_usdc = usdc_amount
        .checked_sub(long_usdc)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // 3) IMPORTANT: move the USDC transfer *before* deriving λ, so vault reflects new funds
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_usdc_account.to_account_info(),
                to: ctx.accounts.pool_reserve.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        usdc_amount,
    )?;

    // 4) Derive λ (Q96) from the *updated* vault + (current) virtual norm
    let lambda_q96 = super::trade::derive_lambda(&ctx.accounts.pool_reserve, &pool)?;

    // 5) Get display prices from λ + virtuals (no stored price dependency)
    // For side i: p_v = (λ * s_i_v) / ||ŝ||, then p_display = p_v / σ_i
    fn price_display_q96(
        s_self_v: u128,
        s_other_v: u128,
        sigma_self_q64: u128,
        lambda_q96: u128,
    ) -> Result<u128> {
        use crate::content_pool::errors::ContentPoolError;
        use crate::content_pool::math::mul_div_u128;

        let norm_v_sq = s_self_v
            .checked_mul(s_self_v)
            .and_then(|x| x.checked_add(s_other_v.checked_mul(s_other_v)?))
            .ok_or(ContentPoolError::NumericalOverflow)?;
        let norm_v = integer_sqrt(norm_v_sq)?.max(1);

        let p_v_q96 = mul_div_u128(lambda_q96, s_self_v, norm_v)?;
        // divide by sigma to get display price
        let p_d_q96 = mul_div_u128(p_v_q96, Q64, sigma_self_q64)?;
        Ok(p_d_q96)
    }

    let p_long_d_q96 = if s_long_v > 0 {
        price_display_q96(s_long_v, s_short_v, pool.s_scale_long_q64, lambda_q96)?
    } else {
        // if zero, approximate initial price as λ / σ_L (norm≈1 for bootstrap)
        mul_div_u128(lambda_q96, Q64, pool.s_scale_long_q64)?
    };

    let p_short_d_q96 = if s_short_v > 0 {
        price_display_q96(s_short_v, s_long_v, pool.s_scale_short_q64, lambda_q96)?
    } else {
        mul_div_u128(lambda_q96, Q64, pool.s_scale_short_q64)?
    };

    // 6) Tokens (DISPLAY) = floor( (usdc<<96) / p_display_q96 )
    let to_display_tokens = |usdc: u64, p_d_q96: u128| -> Result<u64> {
        require!(p_d_q96 > 0, ContentPoolError::NumericalOverflow);
        let hi = (usdc as u128) >> 32;
        let lo = (usdc as u128) << 96;
        let t = div_256_by_128(hi, lo, p_d_q96)?;
        require!(t <= u64::MAX as u128, ContentPoolError::NumericalOverflow);
        Ok(t as u64)
    };

    let long_tokens_display = to_display_tokens(long_usdc, p_long_d_q96)?;
    let short_tokens_display = to_display_tokens(short_usdc, p_short_d_q96)?;

    // 7) Mint in atomic units (currently a bug fix)
    let long_tokens_atomic = long_tokens_display
        .checked_mul(SUPPLY_SCALE)
        .ok_or(ContentPoolError::SupplyOverflow)?;
    let short_tokens_atomic = short_tokens_display
        .checked_mul(SUPPLY_SCALE)
        .ok_or(ContentPoolError::SupplyOverflow)?;

    let seeds = &[b"content_pool", pool.content_id.as_ref(), &[pool.bump]];
    let signer = &[&seeds[..]];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.long_token_mint.to_account_info(),
                to: ctx.accounts.user_long_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer,
        ),
        long_tokens_atomic,
    )?;

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.short_token_mint.to_account_info(),
                to: ctx.accounts.user_short_account.to_account_info(),
                authority: pool.to_account_info(),
            },
            signer,
        ),
        short_tokens_atomic,
    )?;

    // 8) Update supplies in display units
    pool.s_long = pool
        .s_long
        .checked_add(long_tokens_display)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    pool.s_short = pool
        .s_short
        .checked_add(short_tokens_display)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    pool.vault_balance = pool
        .vault_balance
        .checked_add(usdc_amount)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // 9) Recompute virtual supplies AFTER mint
    let s_long_v_after = ceil_div(pool.s_long as u128 * Q64, pool.s_scale_long_q64).max(1);
    let s_short_v_after = ceil_div(pool.s_short as u128 * Q64, pool.s_scale_short_q64).max(1);

    // Re-derive λ (vault already includes usdc_amount)
    let lambda_q96_after = super::trade::derive_lambda(&ctx.accounts.pool_reserve, &pool)?;

    // 10) Recompute prices after mint using the virtual-aware function
    pool.sqrt_price_long_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
        s_long_v_after as u64,
        s_short_v_after as u64,
        TokenSide::Long,
        lambda_q96_after,
        pool.s_scale_long_q64,
        pool.s_scale_short_q64,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    pool.sqrt_price_short_x96 = ICBSCurve::sqrt_marginal_price_from_virtual(
        s_long_v_after as u64,
        s_short_v_after as u64,
        TokenSide::Short,
        lambda_q96_after,
        pool.s_scale_long_q64,
        pool.s_scale_short_q64,
        pool.f,
        pool.beta_num,
        pool.beta_den,
    )?;

    // 11) Recompute reserves from λ (don't increment by split)
    let r_long_calc = ICBSCurve::reserve_from_lambda_and_virtual(
        s_long_v_after as u64,
        s_short_v_after as u64,
        lambda_q96_after,
    )?;
    pool.r_long = r_long_calc.min(pool.vault_balance);
    pool.r_short = pool.vault_balance.saturating_sub(pool.r_long);

    emit!(LiquidityAdded {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        usdc_amount,
        long_tokens_out: long_tokens_display,
        short_tokens_out: short_tokens_display,
        new_r_long: pool.r_long,
        new_r_short: pool.r_short,
        new_s_long: pool.s_long,
        new_s_short: pool.s_short,
    });

    Ok(())
}
