use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use anchor_spl::associated_token::AssociatedToken;

use crate::content_pool::state::{ContentPool, ProtocolConfig};
use crate::pool_factory::state::{PoolFactory, PoolRegistry, FACTORY_SEED, POOL_SEED, REGISTRY_SEED};
use crate::errors::ErrorCode;

/// Permissionless pool creation with registry tracking
pub fn create_pool(
    ctx: Context<CreatePool>,
    post_id: [u8; 32],
    initial_k_quadratic: u128,
    supply_cap: u128,
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
        require!(supply_cap >= config.min_supply_cap, ErrorCode::InvalidParameters);
        require!(supply_cap <= config.max_supply_cap, ErrorCode::InvalidParameters);
    }

    // Initialize ContentPool
    pool.post_id = post_id;
    pool.factory = factory.key();  // Reference to factory for authority
    pool.k_quadratic = initial_k_quadratic;
    pool.supply_cap = supply_cap;
    pool.token_supply = 0;
    pool.reserve = 0;
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
#[instruction(post_id: [u8; 32])]
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
        space = 8 + 161,
        seeds = [POOL_SEED, post_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    #[account(
        init,
        payer = payer,
        token::mint = usdc_mint,
        token::authority = pool,
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