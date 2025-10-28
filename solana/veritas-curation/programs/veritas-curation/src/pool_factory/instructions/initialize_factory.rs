use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::pool_factory::{
    state::{
        PoolFactory,
        FACTORY_SEED,
        DEFAULT_F,
        DEFAULT_BETA_NUM,
        DEFAULT_BETA_DEN,
        DEFAULT_P0,
        DEFAULT_MIN_INITIAL_DEPOSIT,
        DEFAULT_MIN_SETTLE_INTERVAL,
    },
    events::FactoryInitializedEvent,
    errors::FactoryError,
};
use crate::program::VeritasCuration;

/// Initialize the singleton factory PDA with protocol authority and fee configuration
pub fn initialize_factory(
    ctx: Context<InitializeFactory>,
    protocol_authority: Pubkey,
    custodian: Pubkey,
    total_fee_bps: u16,
    creator_split_bps: u16,
    protocol_treasury: Pubkey,
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

    // Validate authorities
    require!(
        protocol_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        custodian != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        protocol_treasury != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        protocol_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );
    require!(
        protocol_treasury != system_program::ID,
        FactoryError::InvalidAuthority
    );

    // Validate fee configuration
    require!(
        creator_split_bps <= 10000,
        FactoryError::InvalidCreatorSplit
    );

    // Initialize state
    factory.protocol_authority = protocol_authority;
    factory.total_pools = 0;
    factory.total_fee_bps = total_fee_bps;
    factory.creator_split_bps = creator_split_bps;
    factory.protocol_treasury = protocol_treasury;
    factory._padding_fee = [0; 2];
    factory.default_f = DEFAULT_F;
    factory.default_beta_num = DEFAULT_BETA_NUM;
    factory.default_beta_den = DEFAULT_BETA_DEN;
    factory.default_p0 = DEFAULT_P0;
    factory.min_initial_deposit = DEFAULT_MIN_INITIAL_DEPOSIT;
    factory.min_settle_interval = DEFAULT_MIN_SETTLE_INTERVAL;
    factory.custodian = custodian;
    factory.bump = ctx.bumps.factory;

    emit!(FactoryInitializedEvent {
        factory: factory.key(),
        protocol_authority,
        custodian,
        total_fee_bps,
        creator_split_bps,
        protocol_treasury,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct InitializeFactory<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + PoolFactory::LEN,
        seeds = [FACTORY_SEED],
        bump
    )]
    pub factory: Account<'info, PoolFactory>,

    pub upgrade_authority: Signer<'info>,

    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, VeritasCuration>,

    /// CHECK: Program data account validated in handler
    pub program_data: AccountInfo<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}