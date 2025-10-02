use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::state::{PoolFactory, FACTORY_SEED};
use crate::errors::ErrorCode;

/// Transfers factory ownership
pub fn update_factory_authority(
    ctx: Context<UpdateFactoryAuthority>,
    new_factory_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;

    // Validate authority
    require!(ctx.accounts.authority.key() == factory.factory_authority, ErrorCode::Unauthorized);
    require!(new_factory_authority != Pubkey::default(), ErrorCode::InvalidAuthority);
    require!(new_factory_authority != system_program::ID, ErrorCode::InvalidAuthority);

    let old_authority = factory.factory_authority;
    factory.factory_authority = new_factory_authority;

    msg!("Factory authority updated: old={}, new={}", old_authority, new_factory_authority);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateFactoryAuthority<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}