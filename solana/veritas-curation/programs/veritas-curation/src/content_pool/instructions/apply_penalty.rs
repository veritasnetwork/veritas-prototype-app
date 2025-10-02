use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::content_pool::state::ContentPool;
use crate::pool_factory::state::PoolFactory;
use crate::constants::RATIO_PRECISION;
use crate::errors::ErrorCode;

/// Apply penalty to pool (skim for epoch processing)
pub fn apply_pool_penalty(
    ctx: Context<ApplyPoolPenalty>,
    penalty_amount: u64,
) -> Result<()> {
    // Validate authority via PoolFactory
    let pool = &ctx.accounts.pool;
    let factory = &ctx.accounts.factory;
    require!(pool.factory == factory.key(), ErrorCode::InvalidFactory);
    require!(ctx.accounts.authority.key() == factory.pool_authority, ErrorCode::Unauthorized);

    require!(penalty_amount > 0, ErrorCode::InvalidAmount);

    let pool = &mut ctx.accounts.pool;

    // Critical: Check reserve can be safely converted to u64
    let reserve_u64 = u64::try_from(pool.reserve)
        .map_err(|_| ErrorCode::NumericalOverflow)?;
    require!(penalty_amount <= reserve_u64, ErrorCode::InsufficientReserve);

    // Prevent draining pool completely (leave dust for rounding)
    require!(penalty_amount < reserve_u64, ErrorCode::InsufficientReserve);

    let old_reserve = pool.reserve;

    // Transfer USDC from pool to treasury
    let post_id = pool.post_id;
    let bump = pool.bump;
    let seeds = &[
        b"pool".as_ref(),
        post_id.as_ref(),
        &[bump],
    ];
    let signer = &[&seeds[..]];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.pool_usdc_vault.to_account_info(),
            to: ctx.accounts.treasury_usdc_vault.to_account_info(),
            authority: pool.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, penalty_amount)?;

    // Update reserve
    let new_reserve = old_reserve
        .checked_sub(penalty_amount as u128)
        .ok_or(ErrorCode::NumericalOverflow)?;
    pool.reserve = new_reserve;

    // Apply elastic-k scaling
    // Critical: Check old_reserve isn't zero (should never happen if validations pass)
    require!(old_reserve > 0, ErrorCode::InvalidAmount);

    // ratio = new_reserve / old_reserve (with precision)
    let ratio = new_reserve
        .checked_mul(RATIO_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(old_reserve)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Scale k_quadratic (k_linear derived automatically as k_quadratic × supply_cap)
    pool.k_quadratic = pool.k_quadratic
        .checked_mul(ratio)
        .ok_or(ErrorCode::NumericalOverflow)?
        .checked_div(RATIO_PRECISION)
        .ok_or(ErrorCode::NumericalOverflow)?;

    msg!("Penalty applied: amount={}, new_reserve={}", penalty_amount, pool.reserve);
    Ok(())
}

#[derive(Accounts)]
pub struct ApplyPoolPenalty<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.post_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        seeds = [b"factory"],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        mut,
        constraint = pool_usdc_vault.key() == pool.usdc_vault
    )]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub treasury_usdc_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
