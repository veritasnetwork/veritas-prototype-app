use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::constants::*;
use crate::errors::ErrorCode;

/// Initialize a new content pool with piecewise bonding curve and SPL token
pub fn initialize_pool(
    ctx: Context<InitializePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    reserve_cap: u128,
    token_name: String,
    token_symbol: String,
) -> Result<()> {
    // Load config (may not exist for first pool - use defaults)
    let config = ctx.accounts.config.as_ref();

    let min_k = config.map_or(DEFAULT_MIN_K_QUADRATIC, |c| c.min_k_quadratic);
    let max_k = config.map_or(DEFAULT_MAX_K_QUADRATIC, |c| c.max_k_quadratic);
    let min_cap = config.map_or(DEFAULT_MIN_RESERVE_CAP, |c| c.min_reserve_cap);
    let max_cap = config.map_or(DEFAULT_MAX_RESERVE_CAP, |c| c.max_reserve_cap);
    let default_linear_slope = config.map_or(DEFAULT_LINEAR_SLOPE, |c| c.default_linear_slope);
    let default_virtual_liquidity = config.map_or(DEFAULT_VIRTUAL_LIQUIDITY, |c| c.default_virtual_liquidity);

    // Validate against bounds
    require!(initial_k_quadratic >= min_k, ErrorCode::InvalidParameters);
    require!(initial_k_quadratic <= max_k, ErrorCode::InvalidParameters);
    require!(reserve_cap >= min_cap, ErrorCode::InvalidParameters);
    require!(reserve_cap <= max_cap, ErrorCode::InvalidParameters);

    // Validate token metadata
    require!(token_name.len() <= 32, ErrorCode::InvalidParameters);
    require!(token_symbol.len() <= 10, ErrorCode::InvalidParameters);
    require!(!token_name.is_empty(), ErrorCode::InvalidParameters);
    require!(!token_symbol.is_empty(), ErrorCode::InvalidParameters);

    let pool = &mut ctx.accounts.pool;

    // Initialize pool state with reserve-based transition
    pool.post_id = post_id;
    pool.k_quadratic = initial_k_quadratic;
    pool.reserve_cap = reserve_cap;
    pool.linear_slope = default_linear_slope;
    pool.virtual_liquidity = default_virtual_liquidity;
    pool.token_supply = 0;
    pool.reserve = 0;
    pool.token_mint = ctx.accounts.token_mint.key();

    // Store token metadata
    let mut name_bytes = [0u8; 32];
    let name_slice = token_name.as_bytes();
    name_bytes[..name_slice.len()].copy_from_slice(name_slice);
    pool.token_name = name_bytes;

    let mut symbol_bytes = [0u8; 10];
    let symbol_slice = token_symbol.as_bytes();
    symbol_bytes[..symbol_slice.len()].copy_from_slice(symbol_slice);
    pool.token_symbol = symbol_bytes;

    pool.token_decimals = 6; // Always 6 decimals to match USDC

    pool.usdc_vault = ctx.accounts.usdc_vault.key();
    pool.factory = ctx.accounts.factory.key();
    pool.bump = ctx.bumps.pool;

    msg!("ContentPool initialized: post_id={:?}, token_name={}, token_symbol={}",
         post_id, token_name, token_symbol);
    Ok(())
}

#[derive(Accounts)]
#[instruction(post_id: [u8; 32], initial_k_quadratic: u128, reserve_cap: u128, token_name: String, token_symbol: String)]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 268,  // Updated size for linear region fields (increased from 236)
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
