use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, Burn};

use crate::content_pool::state::ContentPool;
use crate::content_pool::curve::calculate_sell_payout;
use crate::errors::ErrorCode;

/// Sell tokens for USDC by burning SPL tokens
pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
    require!(token_amount > 0, ErrorCode::InvalidAmount);

    let pool = &mut ctx.accounts.pool;
    let token_amount_u128 = token_amount as u128;

    // Verify user has enough tokens to sell
    require!(
        ctx.accounts.user_token_account.amount >= token_amount,
        ErrorCode::InsufficientBalance
    );

    require!(
        token_amount_u128 <= pool.token_supply,
        ErrorCode::InsufficientBalance
    );

    let s0 = pool.token_supply;
    let s1 = s0.checked_sub(token_amount_u128).ok_or(ErrorCode::NumericalOverflow)?;
    let reserve0 = pool.reserve;
    let k_quad = pool.k_quadratic;

    // Calculate USDC payout based on pure quadratic curve with price floor
    let payout_u128 = calculate_sell_payout(s0, s1, reserve0, k_quad)?;

    // Convert to USDC decimals (payout is in u128, need u64)
    let usdc_out = u64::try_from(payout_u128)?;
    require!(usdc_out <= ctx.accounts.pool_usdc_vault.amount, ErrorCode::InsufficientReserve);
    require!(payout_u128 <= pool.reserve, ErrorCode::InsufficientReserve);

    // Burn the SPL tokens from user's account
    let burn_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Burn {
            mint: ctx.accounts.token_mint.to_account_info(),
            from: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::burn(burn_ctx, token_amount)?;

    // Transfer USDC from pool vault to user using PDA signer
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
            to: ctx.accounts.user_usdc_account.to_account_info(),
            authority: pool.to_account_info(),
        },
        signer,
    );
    token::transfer(transfer_ctx, usdc_out)?;

    // Update pool state
    pool.token_supply = s1;
    pool.reserve = pool
        .reserve
        .checked_sub(payout_u128)
        .ok_or(ErrorCode::NumericalOverflow)?;

    msg!("Sell executed: tokens_burned={}, usdc_received={}", token_amount, usdc_out);
    Ok(())
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(
        mut,
        seeds = [b"pool", pool.post_id.as_ref()],
        bump = pool.bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        mut,
        constraint = token_mint.key() == pool.token_mint
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = pool_usdc_vault.key() == pool.usdc_vault
    )]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    // User's token account to burn tokens from
    #[account(
        mut,
        constraint = user_token_account.mint == token_mint.key(),
        constraint = user_token_account.owner == user.key(),
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}
