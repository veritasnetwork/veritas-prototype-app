use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::constants::*;
use crate::errors::ErrorCode;

/// Initialize a new content pool with pure quadratic bonding curve and SPL token
pub fn initialize_pool(
    ctx: Context<InitializePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    token_name: [u8; 32],
    token_symbol: [u8; 10],
) -> Result<()> {
    // Load config (may not exist for first pool - use defaults)
    let config = ctx.accounts.config.as_ref();

    let min_k = config.map_or(DEFAULT_MIN_K_QUADRATIC, |c| c.min_k_quadratic);
    let max_k = config.map_or(DEFAULT_MAX_K_QUADRATIC, |c| c.max_k_quadratic);

    // Validate against bounds
    require!(initial_k_quadratic >= min_k, ErrorCode::InvalidParameters);
    require!(initial_k_quadratic <= max_k, ErrorCode::InvalidParameters);

    // Validate token metadata (check not all zeros)
    require!(token_name != [0u8; 32], ErrorCode::InvalidParameters);
    require!(token_symbol != [0u8; 10], ErrorCode::InvalidParameters);

    let pool = &mut ctx.accounts.pool;

    // Initialize pool state with pure quadratic curve
    pool.post_id = post_id;
    pool.k_quadratic = initial_k_quadratic;
    pool.token_supply = 0;
    pool.reserve = 0;
    pool.token_mint = ctx.accounts.token_mint.key();

    // Store token metadata (already in correct format)
    pool.token_name = token_name;
    pool.token_symbol = token_symbol;

    pool.token_decimals = 6; // Always 6 decimals to match USDC

    pool.usdc_vault = ctx.accounts.usdc_vault.key();
    pool.factory = ctx.accounts.factory.key();
    pool.bump = ctx.bumps.pool;

    msg!("ContentPool initialized: post_id={:?}, token_name={:?}, token_symbol={:?}",
         post_id, token_name, token_symbol);
    Ok(())
}

#[derive(Accounts)]
#[instruction(post_id: [u8; 32], initial_k_quadratic: u128, token_name: [u8; 32], token_symbol: [u8; 10])]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 220,  // Pure quadratic curve, no linear region
        seeds = [b"pool", post_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    // SPL token mint for this pool
    #[account(
        init,
        payer = payer,
        mint::decimals = 6,
        mint::authority = pool,
        seeds = [b"mint", post_id.as_ref()],
        bump,
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
        seeds = [b"vault", post_id.as_ref()],
        bump,
    )]
    pub usdc_vault: Account<'info, TokenAccount>,

    // Optional: May not exist for first pools
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub usdc_mint: Account<'info, Mint>,

    /// CHECK: PoolFactory account - will be validated when factory module is implemented
    pub factory: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}
