use anchor_lang::prelude::*;

use crate::pool_factory::{
    state::{PoolFactory, FACTORY_SEED, MIN_F, MAX_F, MIN_BETA, MAX_BETA},
    events::DefaultsUpdatedEvent,
    errors::FactoryError,
};
use crate::program::VeritasCuration;

/// Update default ICBS parameters and limits for new pools
/// Only callable by upgrade authority (governance)
pub fn update_defaults(
    ctx: Context<UpdateDefaults>,
    default_f: Option<u16>,
    default_beta_num: Option<u16>,
    default_beta_den: Option<u16>,
    default_p0: Option<u64>,
    min_initial_deposit: Option<u64>,
    min_settle_interval: Option<i64>,
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

    // Update F if provided
    if let Some(f) = default_f {
        require!(f >= MIN_F && f <= MAX_F, FactoryError::InvalidF);
        factory.default_f = f;
    }

    // Update β numerator if provided
    if let Some(num) = default_beta_num {
        require!(num > 0, FactoryError::InvalidBeta);
        factory.default_beta_num = num;
    }

    // Update β denominator if provided
    if let Some(den) = default_beta_den {
        require!(den > 0, FactoryError::InvalidBeta);
        factory.default_beta_den = den;
    }

    // Validate β range after any updates
    let beta = (factory.default_beta_num as f64) / (factory.default_beta_den as f64);
    require!(beta >= MIN_BETA && beta <= MAX_BETA, FactoryError::InvalidBeta);

    // Update p0 if provided
    if let Some(p0) = default_p0 {
        require!(p0 > 0, FactoryError::InvalidParameters);
        factory.default_p0 = p0;
    }

    // Update min deposit if provided
    if let Some(min_deposit) = min_initial_deposit {
        require!(min_deposit > 0, FactoryError::InvalidMinDeposit);
        factory.min_initial_deposit = min_deposit;
    }

    // Update settle interval if provided
    if let Some(interval) = min_settle_interval {
        require!(interval > 0, FactoryError::InvalidSettleInterval);
        factory.min_settle_interval = interval;
    }

    emit!(DefaultsUpdatedEvent {
        factory: factory.key(),
        default_f: factory.default_f,
        default_beta_num: factory.default_beta_num,
        default_beta_den: factory.default_beta_den,
        default_p0: factory.default_p0,
        min_initial_deposit: factory.min_initial_deposit,
        min_settle_interval: factory.min_settle_interval,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateDefaults<'info> {
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
