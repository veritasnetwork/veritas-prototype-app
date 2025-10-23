use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::{
    state::{PoolFactory, FACTORY_SEED},
    events::PoolAuthorityUpdatedEvent,
    errors::FactoryError,
};

/// Updates authority used by all pools for operations
pub fn update_pool_authority(
    ctx: Context<UpdatePoolAuthority>,
    new_pool_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let clock = Clock::get()?;

    require!(
        new_pool_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        new_pool_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );

    let old_authority = factory.pool_authority;
    factory.pool_authority = new_pool_authority;

    emit!(PoolAuthorityUpdatedEvent {
        factory: factory.key(),
        old_authority,
        new_authority: new_pool_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdatePoolAuthority<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = authority.key() == factory.factory_authority @ FactoryError::Unauthorized
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}