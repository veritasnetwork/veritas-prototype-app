use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::pool_factory::state::{PoolFactory, PoolRegistry, FACTORY_SEED, POOL_SEED, REGISTRY_SEED};
use crate::errors::ErrorCode;

/// Permissionless pool creation with registry tracking and SPL token
pub fn create_pool(
    ctx: Context<CreatePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    reserve_cap: u128,
    token_name: String,
    token_symbol: String,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let pool = &mut ctx.accounts.pool;
    let registry = &mut ctx.accounts.registry;

    // Validate post_id
    require!(post_id != [0u8; 32], ErrorCode::InvalidPostId);

    // Optional: Validate parameters against config
    if let Some(config) = ctx.accounts.config.as_ref() {
        require!(initial_k_quadratic >= config.min_k_quadratic, ErrorCode::InvalidParameters);
        require!(initial_k_quadratic <= config.max_k_quadratic, ErrorCode::InvalidParameters);
        require!(reserve_cap >= config.min_reserve_cap, ErrorCode::InvalidParameters);
        require!(reserve_cap <= config.max_reserve_cap, ErrorCode::InvalidParameters);
    }

    // Validate token metadata
    require!(token_name.len() <= 32, ErrorCode::InvalidParameters);
    require!(token_symbol.len() <= 10, ErrorCode::InvalidParameters);
    require!(!token_name.is_empty(), ErrorCode::InvalidParameters);
    require!(!token_symbol.is_empty(), ErrorCode::InvalidParameters);

    // Get default linear parameters from config or use defaults
    let config = ctx.accounts.config.as_ref();
    let default_linear_slope = config.map_or(crate::constants::DEFAULT_LINEAR_SLOPE, |c| c.default_linear_slope);
    let default_virtual_liquidity = config.map_or(crate::constants::DEFAULT_VIRTUAL_LIQUIDITY, |c| c.default_virtual_liquidity);

    // Initialize ContentPool
    pool.post_id = post_id;
    pool.factory = factory.key();  // Reference to factory for authority
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

    pool.usdc_vault = ctx.accounts.pool_usdc_vault.key();
    pool.bump = ctx.bumps.pool;

    // Create registry entry
    registry.post_id = post_id;
    registry.pool_address = pool.key();
    registry.created_at = Clock::get()?.unix_timestamp;
    registry.bump = ctx.bumps.registry;

    // Safe increment with overflow check
    factory.total_pools = factory.total_pools
        .checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?;

    msg!("Pool created for post_id={:?}, pool_address={}",
         post_id, pool.key());
    Ok(())
}

#[derive(Accounts)]
#[instruction(post_id: [u8; 32], initial_k_quadratic: u128, reserve_cap: u128, token_name: String, token_symbol: String)]
pub struct CreatePool<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(
        init,
        payer = payer,
        space = 8 + 268,  // Updated size for linear region fields (increased from 236)
        seeds = [POOL_SEED, post_id.as_ref()],
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
    pub pool_usdc_vault: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = payer,
        space = 8 + 73,
        seeds = [REGISTRY_SEED, post_id.as_ref()],
        bump
    )]
    pub registry: Account<'info, PoolRegistry>,

    // Optional config for validation
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Option<Account<'info, ProtocolConfig>>,

    pub usdc_mint: Account<'info, Mint>,
    pub creator: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}