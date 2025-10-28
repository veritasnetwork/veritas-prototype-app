use anchor_lang::prelude::*;

use crate::pool_factory::{
    state::{PoolFactory, FACTORY_SEED},
    events::FeeConfigUpdatedEvent,
    errors::FactoryError,
};
use crate::program::VeritasCuration;

/// Update fee configuration
/// Only callable by upgrade authority (governance)
pub fn update_fee_config(
    ctx: Context<UpdateFeeConfig>,
    new_total_fee_bps: Option<u16>,
    new_creator_split_bps: Option<u16>,
    update_treasury: bool,
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

    // Update total fee if provided
    if let Some(fee) = new_total_fee_bps {
        factory.total_fee_bps = fee;
    }

    // Update creator split if provided
    if let Some(split) = new_creator_split_bps {
        require!(split <= 10000, FactoryError::InvalidCreatorSplit);
        factory.creator_split_bps = split;
    }

    // Update treasury if requested
    if update_treasury {
        factory.protocol_treasury = ctx.accounts.new_protocol_treasury.key();
    }

    emit!(FeeConfigUpdatedEvent {
        factory: factory.key(),
        total_fee_bps: factory.total_fee_bps,
        creator_split_bps: factory.creator_split_bps,
        protocol_treasury: factory.protocol_treasury,
        updated_by: ctx.accounts.upgrade_authority.key(),
        timestamp: Clock::get()?.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateFeeConfig<'info> {
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

    /// CHECK: New treasury address (only used if update_treasury = true)
    pub new_protocol_treasury: UncheckedAccount<'info>,
}
