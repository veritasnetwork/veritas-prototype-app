use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::state::{PoolFactory, FACTORY_SEED};
use crate::errors::ErrorCode;

/// Updates authority used by all pools for operations
pub fn update_pool_authority(
    ctx: Context<UpdatePoolAuthority>,
    new_pool_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    // Validate authority
    require!(ctx.accounts.authority.key() == factory.factory_authority, ErrorCode::Unauthorized);
    require!(new_pool_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_pool_authority != system_program::ID, ErrorCode::InvalidAuthority);

    let old_authority = factory.pool_authority;
    factory.pool_authority = new_pool_authority;

    msg!("Pool authority updated: old={}, new={}", old_authority, new_pool_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePoolAuthority<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}