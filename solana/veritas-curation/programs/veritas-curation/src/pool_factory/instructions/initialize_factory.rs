use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::state::{PoolFactory, FACTORY_SEED};
use crate::errors::ErrorCode;

/// Initialize the singleton factory PDA with dual authority model
pub fn initialize_factory(
    ctx: Context<InitializeFactory>,
    factory_authority: Pubkey,
    pool_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    // Validate authorities
    require!(factory_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(pool_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(factory_authority != system_program::ID, ErrorCode::InvalidAuthority);
    require!(pool_authority != system_program::ID, ErrorCode::InvalidAuthority);

    // Initialize state
    factory.factory_authority = factory_authority;
    factory.pool_authority = pool_authority;
    factory.total_pools = 0;
    factory.bump = ctx.bumps.factory;

    msg!("PoolFactory initialized with factory_authority={}, pool_authority={}",
         factory_authority, pool_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 73,
        seeds = [FACTORY_SEED],
        bump
    )]
    pub factory: Account<'info, PoolFactory>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}