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

/// Initialize the singleton factory PDA with dual authority model
pub fn initialize_factory(
    ctx: Context<InitializeFactory>,
    factory_authority: Pubkey,
    pool_authority: Pubkey,
    custodian: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let clock = Clock::get()?;

    // Validate authorities
    require!(
        factory_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        pool_authority != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        custodian != Pubkey::default(),
        FactoryError::InvalidAuthority
    );
    require!(
        factory_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );
    require!(
        pool_authority != system_program::ID,
        FactoryError::InvalidAuthority
    );

    // Initialize state
    factory.factory_authority = factory_authority;
    factory.pool_authority = pool_authority;
    factory.total_pools = 0;
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
        factory_authority,
        pool_authority,
        custodian,
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

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}