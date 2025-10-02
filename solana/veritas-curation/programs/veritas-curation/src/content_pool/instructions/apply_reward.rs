use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::content_pool::state::ContentPool;
use crate::pool_factory::state::PoolFactory;
use crate::protocol_treasury::state::ProtocolTreasury;
use crate::constants::RATIO_PRECISION;
use crate::errors::ErrorCode;

/// Apply reward to pool (momentum payout)
pub fn apply_pool_reward(
    ctx: Context<ApplyPoolReward>,
    reward_amount: u64,
) -> Result<()> {
    // Validate authority via PoolFactory
    let pool = &ctx.accounts.pool;
    let factory = &ctx.accounts.factory;
    require!(pool.factory == factory.key(), ErrorCode::InvalidFactory);
    require!(ctx.accounts.authority.key() == factory.pool_authority, ErrorCode::Unauthorized);

    require!(reward_amount > 0, ErrorCode::InvalidAmount);

    let pool = &mut ctx.accounts.pool;
    let old_reserve = pool.reserve;

    // Transfer USDC from treasury to pool
    let treasury = &ctx.accounts.treasury;
    let treasury_bump = &[treasury.bump];
    let seeds: &[&[u8]] = &[
        b"treasury",
        treasury_bump,
    ];
    let signer = &[seeds];

    let transfer_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.treasury_usdc_vault.to_account_info(),
            to: ctx.accounts.pool_usdc_vault.to_account_info(),
            authority: ctx.accounts.treasury.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, reward_amount)?;

    // Update reserve
    let new_reserve = old_reserve
        .checked_add(reward_amount as u128)
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

    msg!("Reward applied: amount={}, new_reserve={}", reward_amount, pool.reserve);
    Ok(())
}

#[derive(Accounts)]
pub struct ApplyPoolReward<'info> {
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

    #[account(
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, ProtocolTreasury>,

    #[account(
        mut,
        constraint = treasury_usdc_vault.key() == treasury.usdc_vault
    )]
    pub treasury_usdc_vault: Account<'info, TokenAccount>,

    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
