use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::constants::*;
use crate::errors::ErrorCode;

/// Initialize a new content pool with piecewise bonding curve
pub fn initialize_pool(
    ctx: Context<InitializePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    supply_cap: u128,
) -> Result<()> {
    // Load config (may not exist for first pool - use defaults)
    let config = ctx.accounts.config.as_ref();

    let min_k = config.map_or(DEFAULT_MIN_K_QUADRATIC, |c| c.min_k_quadratic);
    let max_k = config.map_or(DEFAULT_MAX_K_QUADRATIC, |c| c.max_k_quadratic);
    let min_cap = config.map_or(DEFAULT_MIN_SUPPLY_CAP, |c| c.min_supply_cap);
    let max_cap = config.map_or(DEFAULT_MAX_SUPPLY_CAP, |c| c.max_supply_cap);

    // Validate against bounds
    require!(initial_k_quadratic >= min_k, ErrorCode::InvalidParameters);
    require!(initial_k_quadratic <= max_k, ErrorCode::InvalidParameters);
    require!(supply_cap >= min_cap, ErrorCode::InvalidParameters);
    require!(supply_cap <= max_cap, ErrorCode::InvalidParameters);

    let pool = &mut ctx.accounts.pool;

    // Initialize pool state (k_linear not stored, will be derived)
    pool.post_id = post_id;
    pool.k_quadratic = initial_k_quadratic;
    pool.supply_cap = supply_cap;
    pool.token_supply = 0;
    pool.reserve = 0;
    pool.usdc_vault = ctx.accounts.usdc_vault.key();
    pool.factory = ctx.accounts.factory.key();
    pool.bump = ctx.bumps.pool;

    msg!("ContentPool initialized: post_id={:?}", post_id);
    Ok(())
}

#[derive(Accounts)]
#[instruction(post_id: [u8; 32])]
pub struct InitializePool<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 161,
        seeds = [b"pool", post_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
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
