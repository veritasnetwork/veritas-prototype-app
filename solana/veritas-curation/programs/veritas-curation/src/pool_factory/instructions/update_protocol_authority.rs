use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::{
    state::{PoolFactory, FACTORY_SEED},
    events::ProtocolAuthorityUpdatedEvent,
    errors::FactoryError,
};
use crate::program::VeritasCuration;

/// Updates protocol authority used by all pools for operations
/// Only callable by upgrade authority (governance)
pub fn update_protocol_authority(
    ctx: Context<UpdateProtocolAuthority>,
    new_authority: Pubkey,
) -> Result<()> {
    // Validate upgrade authority
    let program_data_bytes = ctx.accounts.program_data.try_borrow_data()?;
    if program_data_bytes.len() < 45 {
        return Err(FactoryError::InvalidProgramData.into());
    }

    // Deserialize: first 4 bytes = discriminator, next 8 = slot, next 1 = Option tag, next 32 = Pubkey
    let upgrade_authority_option = if program_data_bytes[12] == 0 {
        None
    } else {
        let mut pubkey_bytes = [0u8; 32];
        pubkey_bytes.copy_from_slice(&program_data_bytes[13..45]);
        Some(Pubkey::new_from_array(pubkey_bytes))
    };

    require!(
        upgrade_authority_option == Some(ctx.accounts.upgrade_authority.key()),
        FactoryError::InvalidUpgradeAuthority
    );

    let factory = &mut ctx.accounts.factory;
    let clock = Clock::get()?;

    require!(
        new_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        new_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );

    let old_authority = factory.protocol_authority;
    factory.protocol_authority = new_authority;

    emit!(ProtocolAuthorityUpdatedEvent {
        factory: factory.key(),
        old_authority,
        new_authority,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateProtocolAuthority<'info> {
    #[account(
        mut,
        seeds = [FACTORY_SEED],
        bump = factory.bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub upgrade_authority: Signer<'info>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, VeritasCuration>,

    /// CHECK: Program data account validated in handler
    pub program_data: AccountInfo<'info>,
}