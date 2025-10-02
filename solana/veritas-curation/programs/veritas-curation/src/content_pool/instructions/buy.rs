use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::content_pool::curve::{calculate_buy_supply, get_k_linear};
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
    let supply_cap = pool.supply_cap;
    let k_quad = pool.k_quadratic;

    // Derive k_linear from k_quadratic × supply_cap
    let k_linear = get_k_linear(pool)?;

    // Convert USDC amount to u128 for calculations
    let usdc_amount_u128 = usdc_amount as u128;

    // Calculate tokens to mint based on piecewise curve
    let s1 = calculate_buy_supply(s0, usdc_amount_u128, supply_cap, k_quad, k_linear)?;
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

    // Update pool state
    pool.token_supply = s1;
    pool.reserve = pool
        .reserve
        .checked_add(usdc_amount_u128)
        .ok_or(ErrorCode::NumericalOverflow)?;

    msg!("Buy executed: tokens_minted={}, usdc_spent={}", tokens_to_mint, usdc_amount);
    Ok(())
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub pool: Account<'info, ContentPool>,

    #[account(
        mut,
        constraint = pool_usdc_vault.key() == pool.usdc_vault
    )]
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user_usdc_account: Account<'info, TokenAccount>,

    pub user: Signer<'info>,

    // Optional: May not exist
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub token_program: Program<'info, Token>,
}
