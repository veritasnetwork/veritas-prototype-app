use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer, MintTo};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::content_pool::curve::calculate_buy_supply;
use crate::constants::*;
use crate::errors::ErrorCode;

/// Buy tokens using USDC
pub fn buy(ctx: Context<Buy>, usdc_amount: u64) -> Result<()> {
    // Load config (may not exist - use default)
    let config = ctx.accounts.config.as_ref();
    let min_trade = config.map_or(DEFAULT_MIN_TRADE_AMOUNT, |c| c.min_trade_amount);

    require!(usdc_amount >= min_trade, ErrorCode::InvalidAmount);

    let pool = &mut ctx.accounts.pool;
    let s0 = pool.token_supply;
    let reserve0 = pool.reserve;
    let k_quad = pool.k_quadratic;

    // Convert USDC amount to u128 for calculations
    let usdc_amount_u128 = usdc_amount as u128;

    // Calculate tokens to mint based on pure quadratic curve with price floor
    let s1 = calculate_buy_supply(s0, reserve0, usdc_amount_u128, k_quad)?;
    let tokens_to_mint = s1.checked_sub(s0).ok_or(ErrorCode::NumericalOverflow)?;

    // Transfer USDC from user to pool vault
    let transfer_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.pool_usdc_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        },
    );
    token::transfer(transfer_ctx, usdc_amount)?;

    // Store values before doing CPI
    let post_id = pool.post_id;
    let bump = pool.bump;

    // Update pool state first (before any CPIs that might need to borrow pool)
    pool.token_supply = s1;
    pool.reserve = pool
        .reserve
        .checked_add(usdc_amount_u128)
        .ok_or(ErrorCode::NumericalOverflow)?;

    // Now do the mint CPI
    let pool_seeds = &[
        b"pool",
        post_id.as_ref(),
        &[bump],
    ];
    let pool_signer = &[&pool_seeds[..]];

    let mint_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.token_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.pool.to_account_info(),
        },
        pool_signer,
    );
    token::mint_to(mint_ctx, tokens_to_mint as u64)?;

    msg!("Buy executed: tokens_minted={}, usdc_spent={}", tokens_to_mint, usdc_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
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

    // User's token account (may be created if it doesn't exist)
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    // Optional: May not exist
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
