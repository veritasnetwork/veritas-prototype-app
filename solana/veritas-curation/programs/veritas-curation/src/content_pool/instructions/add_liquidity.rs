use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, MintTo};

use crate::content_pool::state::*;
use crate::content_pool::errors::ContentPoolError;
use crate::content_pool::events::LiquidityAdded;
use crate::content_pool::curve::ICBSCurve;
// Safe math helpers
use crate::content_pool::math::{div_256_by_128, mul_shift_right_96};

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

    // --------- Helper: tokens_out_at_price(usdc, sqrt_price_x96) ----------
    // tokens = floor( (usdc << 96) / price_q96 ), where price_q96 = (sqrt_price_x96^2) >> 96
    // Use 256/128 division to avoid overflow.
    let tokens_out_at_price = |usdc: u64, sqrt_price_x96: u128| -> Result<u64> {
        // price in Q96
        let price_q96 = mul_shift_right_96(sqrt_price_x96, sqrt_price_x96)?;
        require!(price_q96 > 0, ContentPoolError::NumericalOverflow);

        // numerator = (usdc << 96) as 256-bit (hi, lo)
        // For a 128-bit view of 'usdc', (usdc << 96) => hi = usdc >> 32, lo = usdc << 96
        let usdc_u128 = usdc as u128;
        let hi = usdc_u128 >> 32;
        let lo = usdc_u128 << 96;

        let tokens_u128 = div_256_by_128(hi, lo, price_q96)?;
        require!(tokens_u128 <= u64::MAX as u128, ContentPoolError::NumericalOverflow);
        Ok(tokens_u128 as u64) // floor (pool-favourable)
    };

    // --------- Bootstrap price from λ for zero-supply sides ----------
    // For F=1, β=0.5: p = λ * s / ||s||
    // If s=0 but we know λ, derive initial price to avoid arbitrage gap:
    // Use λ directly scaled to match the deployed market's pricing intent
    let bootstrap_tokens = |usdc: u64, sqrt_lambda_x96: u128| -> Result<u64> {
        // Use λ as the bootstrap price (λ represents price scaling factor)
        // For initial liquidity: tokens ≈ usdc / (λ in USDC terms)
        // Since λ is in Q96 and represents the price coefficient,
        // we derive: tokens = (usdc << 96) / lambda
        let usdc_u128 = usdc as u128;
        let hi = usdc_u128 >> 32;
        let lo = usdc_u128 << 96;

        let lambda_q96 = sqrt_lambda_x96
            .checked_mul(sqrt_lambda_x96)
            .ok_or(ContentPoolError::NumericalOverflow)?;

        require!(lambda_q96 > 0, ContentPoolError::InvalidParameter);

        let tokens_u128 = div_256_by_128(hi, lo, lambda_q96)?;
        require!(tokens_u128 <= u64::MAX as u128, ContentPoolError::NumericalOverflow);
        Ok(tokens_u128 as u64)
    };

    // --------- Compute tokens to mint on each side ----------
    let long_tokens_out = if pool.s_long > 0 {
        tokens_out_at_price(long_usdc, pool.sqrt_price_long_x96)?
    } else {
        // Bootstrap from λ to avoid arbitrage gap
        bootstrap_tokens(long_usdc, pool.sqrt_lambda_long_x96)?
    };

    let short_tokens_out = if pool.s_short > 0 {
        tokens_out_at_price(short_usdc, pool.sqrt_price_short_x96)?
    } else {
        // Bootstrap from λ to avoid arbitrage gap
        bootstrap_tokens(short_usdc, pool.sqrt_lambda_short_x96)?
    };

    // --------- Transfer USDC from user to pool reserve ----------
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

    // --------- Mint LONG / SHORT tokens to user ----------
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
        long_tokens_out,
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
        short_tokens_out,
    )?;

    // --------- Update pool state ----------
    pool.s_long = pool
        .s_long
        .checked_add(long_tokens_out)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    pool.s_short = pool
        .s_short
        .checked_add(short_tokens_out)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    pool.vault_balance = pool
        .vault_balance
        .checked_add(usdc_amount)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    pool.r_long = pool
        .r_long
        .checked_add(long_usdc)
        .ok_or(ContentPoolError::NumericalOverflow)?;
    pool.r_short = pool
        .r_short
        .checked_add(short_usdc)
        .ok_or(ContentPoolError::NumericalOverflow)?;

    // --------- Recompute sqrt prices (F=1, β=1/2 path) ----------
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

    emit!(LiquidityAdded {
        pool: pool.key(),
        user: ctx.accounts.user.key(),
        usdc_amount,
        long_tokens_out,
        short_tokens_out,
        new_r_long: pool.r_long,
        new_r_short: pool.r_short,
        new_s_long: pool.s_long,
        new_s_short: pool.s_short,
    });

    Ok(())
}
