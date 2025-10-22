use anchor_lang::prelude::*;
use crate::content_pool::{
    state::ContentPool,
    events::PoolInitializedEvent,
};
use crate::pool_factory::{
    state::{PoolFactory, PoolRegistry, REGISTRY_SEED, MIN_F, MAX_F, MIN_BETA, MAX_BETA},
    events::PoolCreatedEvent,
    errors::FactoryError,
};
use crate::veritas_custodian::state::VeritasCustodian;

/// Create a new ContentPool via PoolFactory
/// Users can create pools but parameters are controlled by the factory authority
pub fn create_pool(
    ctx: Context<CreatePool>,
    content_id: Pubkey,
) -> Result<()> {
    let factory = &mut ctx.accounts.factory;
    let pool = &mut ctx.accounts.pool;
    let registry = &mut ctx.accounts.registry;
    let clock = Clock::get()?;

    // Always use factory defaults - users cannot override
    let f = factory.default_f;
    let beta_num = factory.default_beta_num;
    let beta_den = factory.default_beta_den;

    // Initialize pool state
    pool.content_id = content_id;
    pool.creator = ctx.accounts.creator.key();
    pool.market_deployer = Pubkey::default(); // Not yet deployed

    // Mints will be set during deploy_market
    pool.long_mint = Pubkey::default();
    pool.short_mint = Pubkey::default();

    // Vaults will be set during deploy_market
    pool.vault = Pubkey::default();
    pool.stake_vault = ctx.accounts.custodian.usdc_vault; // Reference to custodian's USDC vault

    // ICBS parameters
    pool.f = f;
    pool.beta_num = beta_num;
    pool.beta_den = beta_den;
    pool._padding1 = [0; 10];

    // Initial supplies and reserves (all zero)
    pool.s_long = 0;
    pool.s_short = 0;
    pool.r_long = 0;
    pool.r_short = 0;

    // Sqrt prices and lambdas will be set during deploy_market
    pool.sqrt_price_long_x96 = 0;
    pool.sqrt_price_short_x96 = 0;
    pool.sqrt_lambda_long_x96 = 0;
    pool.sqrt_lambda_short_x96 = 0;

    // Settlement parameters
    pool.last_settle_ts = 0;
    pool.min_settle_interval = factory.min_settle_interval;
    pool.current_epoch = 0;

    // Decay parameters
    let current_time = clock.unix_timestamp;
    pool.expiration_timestamp = current_time + (crate::content_pool::state::BELIEF_DURATION_HOURS as i64 * 3600);
    pool.last_decay_update = pool.expiration_timestamp; // Start tracking from expiration

    // Stats
    pool.vault_balance = 0;
    pool.initial_q = 0;

    // Factory reference
    pool.factory = factory.key();

    // PDA bump
    pool.bump = ctx.bumps.pool;
    pool._padding2 = [0; 7];

    // Create registry entry
    registry.content_id = content_id;
    registry.pool_address = pool.key();
    registry.creator = ctx.accounts.creator.key();
    registry.created_at = clock.unix_timestamp;
    registry.bump = ctx.bumps.registry;

    // Update factory stats
    factory.total_pools = factory
        .total_pools
        .checked_add(1)
        .ok_or(FactoryError::InvalidParameters)?;

    // Emit events
    emit!(PoolInitializedEvent {
        pool: pool.key(),
        content_id,
        creator: pool.creator,
        f: pool.f,
        beta_num: pool.beta_num,
        beta_den: pool.beta_den,
        timestamp: clock.unix_timestamp,
    });

    emit!(PoolCreatedEvent {
        pool: pool.key(),
        content_id,
        creator: ctx.accounts.creator.key(),
        f,
        beta_num,
        beta_den,
        registry: registry.key(),
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(content_id: Pubkey)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub factory: Account<'info, PoolFactory>,

    /// The pool to be created
    #[account(
        init,
        payer = payer,
        space = 8 + ContentPool::LEN,
        seeds = [b"content_pool", content_id.as_ref()],
        bump
    )]
    pub pool: Account<'info, ContentPool>,

    /// Registry entry for this pool (prevents duplicates)
    #[account(
        init,
        payer = payer,
        space = 8 + PoolRegistry::LEN,
        seeds = [REGISTRY_SEED, content_id.as_ref()],
        bump
    )]
    pub registry: Account<'info, PoolRegistry>,

    /// VeritasCustodian (for stake vault reference)
    pub custodian: Account<'info, VeritasCustodian>,

    /// Pool creator
    pub creator: Signer<'info>,

    /// Payer for account creation
    #[account(mut)]
    pub payer: Signer<'info>,


    /// System program for account creation
    pub system_program: Program<'info, System>,
}