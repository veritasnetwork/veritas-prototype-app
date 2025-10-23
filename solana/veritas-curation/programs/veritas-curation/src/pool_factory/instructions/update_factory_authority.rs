use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::{
    state::{PoolFactory, FACTORY_SEED},
    events::FactoryAuthorityUpdatedEvent,
    errors::FactoryError,
};

/// Transfers factory ownership
pub fn update_factory_authority(
    ctx: Context<UpdateFactoryAuthority>,
    new_factory_authority: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let clock = Clock::get()?;

    require!(
        new_factory_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        new_factory_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );

    let old_authority = factory.factory_authority;
    factory.factory_authority = new_factory_authority;

    emit!(FactoryAuthorityUpdatedEvent {
        factory: factory.key(),
        old_authority,
        new_authority: new_factory_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateFactoryAuthority<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump,
        constraint = authority.key() == factory.factory_authority @ FactoryError::Unauthorized
    )]
    pub factory: Account<'info, PoolFactory>,

    pub authority: Signer<'info>,
}